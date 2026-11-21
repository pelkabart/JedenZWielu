import type { SocketLike } from '../RoomClient';

/** Atrapa WebSocketu: test sam decyduje, kiedy połączenie się otwiera, co przychodzi i kiedy się zamyka. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: unknown[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string) {
    if (this.readyState !== 1) throw new Error('socket not open');
    this.sent.push(JSON.parse(data));
  }

  close(code = 1000) {
    if (this.readyState >= 2) return;
    this.closedWith = code;
    this.readyState = 3;
  }

  // --- sterowanie z testu ---

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  /** Serwer albo sieć zamyka połączenie. */
  drop(code = 1006) {
    this.readyState = 3;
    this.onerror?.(new Error('dropped'));
    this.onclose?.({ code });
  }

  lastSent(): unknown {
    return this.sent[this.sent.length - 1];
  }
}

/** Fabryka zapamiętująca utworzone sockety (`sockets.at(-1)` = najnowsze połączenie). */
export function fakeSocketFactory() {
  const sockets: FakeSocket[] = [];
  const createSocket = (url: string) => {
    const socket = new FakeSocket(url);
    sockets.push(socket);
    return socket;
  };
  return { sockets, createSocket };
}
