/**
 * Wiadomości WebSocket między aplikacją a serwerem (JSON, jedna wiadomość = jeden obiekt z `type`).
 * KOPIA TYPÓW jest w aplikacji: `src/multiplayer/protocol.ts`. Zmieniaj obie naraz.
 */

export interface PlayerView {
  id: string;
  nick: string;
  host: boolean;
}

export interface RoomView {
  code: string;
  players: PlayerView[];
}

export type ErrorReason =
  | 'invalid-json'
  | 'not-an-object'
  | 'unknown-type'
  | 'missing-id'
  | 'missing-field'
  | 'nick-invalid'
  | 'nick-taken'
  | 'room-not-found'
  | 'room-full'
  | 'already-in-room'
  | 'not-in-room'
  | 'too-many-rooms'
  | 'internal';

export type ClientMessage =
  | { type: 'ping'; id: string | number }
  | { type: 'create'; nick: string }
  | { type: 'join'; code: string; nick: string }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'hello'; version: string }
  | { type: 'pong'; id: string | number; serverTime: number }
  /** Stan pokoju: po create/join do pytającego oraz do wszystkich w pokoju po każdej zmianie. */
  | { type: 'room'; room: RoomView; youId: string }
  /** Potwierdzenie `leave`: gracz nie jest już w żadnym pokoju. */
  | { type: 'left' }
  | { type: 'error'; reason: ErrorReason };

/** Teksty z sieci są obcinane, zanim trafią dalej – walidacja i tak odrzuci za długie. */
const MAX_FIELD_LENGTH = 64;

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value.slice(0, MAX_FIELD_LENGTH) : null;

/** Sprawdza wiadomość od klienta. Zwraca opis błędu zamiast rzucać – zła wiadomość nie może wywrócić serwera. */
export function parseClientMessage(raw: string): ClientMessage | { error: ErrorReason } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: 'invalid-json' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { error: 'not-an-object' };
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case 'ping': {
      const id = message.id;
      if (typeof id !== 'string' && typeof id !== 'number') return { error: 'missing-id' };
      return { type: 'ping', id };
    }
    case 'create': {
      const nick = text(message.nick);
      if (nick === null) return { error: 'missing-field' };
      return { type: 'create', nick };
    }
    case 'join': {
      const nick = text(message.nick);
      const code = text(message.code);
      if (nick === null || code === null) return { error: 'missing-field' };
      return { type: 'join', code, nick };
    }
    case 'leave':
      return { type: 'leave' };
    default:
      return { error: 'unknown-type' };
  }
}
