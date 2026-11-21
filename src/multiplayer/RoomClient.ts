import { normalizeServerUrl, SERVER_TIMEOUT_MS } from '@/backend/serverHealth';
import { createLogger } from '@/lib/log';

import { parseServerMessage, type ClientMessage, type RoomView } from './protocol';

const log = createLogger('multiplayer');

/** Tyle z WebSocketu, ile używamy. React Native ma go wbudowanego; w testach podstawiamy atrapę. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
export type SocketFactory = (url: string) => SocketLike;

const OPEN = 1;

export type RoomAction = 'create' | 'join';

export type ConnectionFailure = 'no-url' | 'timeout' | 'network' | 'dropped' | 'server-restart';

export type RoomState =
  | { status: 'idle' }
  | { status: 'connecting'; action: RoomAction }
  | { status: 'in-room'; room: RoomView; youId: string }
  /** `reason`: powód od serwera (np. `room-not-found`) albo problem z połączeniem. */
  | { status: 'error'; action: RoomAction | null; reason: string; message: string };

const MESSAGES: Record<string, string> = {
  'no-url': 'Brak adresu serwera. Wpisz EXPO_PUBLIC_SERVER_URL=https://… w pliku .env.local i uruchom Expo ponownie.',
  timeout: `Serwer nie odpowiedział w ${Math.round(SERVER_TIMEOUT_MS / 1000)} s. Mógł się dopiero uruchamiać – spróbuj ponownie za chwilę.`,
  network: 'Nie udało się połączyć z serwerem. Sprawdź internet.',
  dropped: 'Połączenie z serwerem zostało przerwane.',
  'server-restart': 'Serwer został zrestartowany i pokój zniknął. Utwórz nowy.',
  'room-not-found': 'Nie ma pokoju o tym kodzie. Sprawdź kod.',
  'room-full': 'Ten pokój jest już pełny.',
  'nick-taken': 'Ktoś w tym pokoju ma już taki nick. Wybierz inny.',
  'nick-invalid': 'Nick musi mieć od 2 do 16 znaków.',
  'too-many-rooms': 'Serwer ma teraz za dużo pokoi. Spróbuj za chwilę.',
};

/** Komunikat po polsku dla powodu błędu; nieznane powody dostają ogólny tekst. */
export function messageFor(reason: string): string {
  return MESSAGES[reason] ?? 'Coś poszło nie tak po stronie serwera. Spróbuj ponownie.';
}

/** `https://x` → `wss://x/ws`. `null`, gdy adresu nie ma albo jest zły. */
export function toWebSocketUrl(serverUrl: string): string | null {
  const base = normalizeServerUrl(serverUrl);
  return base ? `${base.replace(/^http/i, 'ws')}/ws` : null;
}

export interface RoomClientOptions {
  serverUrl: string;
  createSocket: SocketFactory;
  timeoutMs?: number;
}

/**
 * Jedno połączenie z serwerem na czas pobytu w pokoju. Każda próba `create`/`join` otwiera nowe połączenie,
 * `leave` je zamyka. Zdarzenia ze starego połączenia są ignorowane (numer `generation`).
 * Stan czytają ekrany przez `useSyncExternalStore(subscribe, getState)`.
 */
export class RoomClient {
  private state: RoomState = { status: 'idle' };
  private socket: SocketLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  private readonly timeoutMs: number;

  constructor(private readonly options: RoomClientOptions) {
    this.timeoutMs = options.timeoutMs ?? SERVER_TIMEOUT_MS;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): RoomState => this.state;

  create(nick: string) {
    this.start('create', { type: 'create', nick });
  }

  join(code: string, nick: string) {
    this.start('join', { type: 'join', code, nick });
  }

  /** Wychodzi z pokoju (albo przerywa łączenie) i zamyka połączenie. Można wołać wielokrotnie. */
  leave() {
    if (!this.socket && this.state.status === 'idle') return;
    if (this.socket && this.state.status === 'in-room') this.sendRaw(this.socket, { type: 'leave' });
    log.info('Wyjście z multiplayera', { from: this.state.status });
    this.dispose();
    this.setState({ status: 'idle' });
  }

  /** Czyści komunikat o błędzie (np. gdy gracz poprawia kod). */
  clearError() {
    if (this.state.status === 'error') this.setState({ status: 'idle' });
  }

  private start(action: RoomAction, message: ClientMessage) {
    this.dispose();
    const url = toWebSocketUrl(this.options.serverUrl);
    if (!url) {
      log.warn('Brak adresu serwera');
      this.setState({ status: 'error', action, reason: 'no-url', message: messageFor('no-url') });
      return;
    }

    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.setState({ status: 'connecting', action });
    log.info('Łączenie z serwerem', { action });

    let socket: SocketLike;
    try {
      socket = this.options.createSocket(url);
    } catch (e) {
      log.warn('Nie udało się otworzyć połączenia', { error: e instanceof Error ? e.message : 'unknown' });
      this.fail(action, 'network');
      return;
    }
    this.socket = socket;
    this.timer = setTimeout(() => {
      if (!current()) return;
      log.warn('Serwer nie odpowiedział na czas', { action, timeoutMs: this.timeoutMs });
      this.fail(action, 'timeout');
    }, this.timeoutMs);

    socket.onmessage = (event) => {
      if (!current()) return;
      const parsed = parseServerMessage(event.data);
      if (!parsed) {
        log.warn('Nieznana wiadomość od serwera', { length: typeof event.data === 'string' ? event.data.length : -1 });
        return;
      }
      switch (parsed.type) {
        case 'hello':
          log.debug('Serwer przywitał', { version: parsed.version });
          this.sendRaw(socket, message);
          return;
        case 'room':
          this.clearTimer();
          if (this.state.status !== 'in-room') log.info('Jestem w pokoju', { code: parsed.room.code, players: parsed.room.players.length });
          else log.debug('Nowa lista graczy', { players: parsed.room.players.length });
          this.setState({ status: 'in-room', room: parsed.room, youId: parsed.youId });
          return;
        case 'error':
          if (this.state.status === 'connecting') {
            log.info('Serwer odmówił', { action, reason: parsed.reason });
            this.fail(action, parsed.reason);
          } else {
            log.warn('Błąd od serwera w pokoju', { reason: parsed.reason });
          }
          return;
        case 'pong':
        case 'left':
          return;
      }
    };

    socket.onerror = () => {
      if (!current()) return;
      log.warn('Błąd połączenia', { status: this.state.status });
    };

    socket.onclose = (event) => {
      if (!current()) return;
      const inRoom = this.state.status === 'in-room';
      log.warn('Połączenie zamknięte', { code: event.code, inRoom });
      // 1001 = serwer się zamyka (nowa wersja albo uśpienie kontenera), pokoje są w pamięci, więc zniknęły.
      const reason: ConnectionFailure = inRoom ? (event.code === 1001 ? 'server-restart' : 'dropped') : 'network';
      this.fail(inRoom ? null : action, reason);
    };
  }

  private fail(action: RoomAction | null, reason: string) {
    this.dispose();
    this.setState({ status: 'error', action, reason, message: messageFor(reason) });
  }

  private sendRaw(socket: SocketLike, message: ClientMessage) {
    if (socket.readyState !== OPEN) return;
    try {
      socket.send(JSON.stringify(message));
    } catch (e) {
      log.warn('Nie udało się wysłać wiadomości', { type: message.type, error: e instanceof Error ? e.message : 'unknown' });
    }
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Odpina obsługę zdarzeń i zamyka socket; spóźnione wiadomości trafią w próżnię. */
  private dispose() {
    this.generation++;
    this.clearTimer();
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close(1000);
    } catch {
      // Zamykanie zamkniętego socketu nie jest błędem, który warto pokazywać.
    }
  }

  private setState(next: RoomState) {
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
