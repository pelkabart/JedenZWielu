/**
 * Wiadomości WebSocket między aplikacją a serwerem.
 * KOPIA TYPÓW z `server/src/protocol.ts` (serwer jest poza `tsc` aplikacji). Zmieniaj obie naraz.
 */

/** Miejsca w pokoju – tak jak `MAX_PLAYERS` w `server/src/rooms.ts`. */
export const MAX_PLAYERS = 5;

export interface PlayerView {
  id: string;
  nick: string;
  host: boolean;
}

export interface RoomView {
  code: string;
  players: PlayerView[];
}

export type ClientMessage =
  | { type: 'ping'; id: string | number }
  | { type: 'create'; nick: string }
  | { type: 'join'; code: string; nick: string }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'hello'; version: string }
  | { type: 'pong'; id: string | number; serverTime: number }
  | { type: 'room'; room: RoomView; youId: string }
  | { type: 'left' }
  /** `reason` to np. `room-not-found`; nieznane powody też przepuszczamy (starszy klient, nowszy serwer). */
  | { type: 'error'; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isPlayer(value: unknown): value is PlayerView {
  return isRecord(value) && typeof value.id === 'string' && typeof value.nick === 'string' && typeof value.host === 'boolean';
}

function isRoom(value: unknown): value is RoomView {
  return isRecord(value) && typeof value.code === 'string' && Array.isArray(value.players) && value.players.every(isPlayer);
}

/** Sprawdza wiadomość od serwera. `null` = nie do użycia (zły JSON, nieznany typ, zły kształt). Nigdy nie rzuca. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'hello':
      return typeof data.version === 'string' ? { type: 'hello', version: data.version } : null;
    case 'pong':
      return (typeof data.id === 'string' || typeof data.id === 'number') && typeof data.serverTime === 'number'
        ? { type: 'pong', id: data.id, serverTime: data.serverTime }
        : null;
    case 'room':
      return isRoom(data.room) && typeof data.youId === 'string' ? { type: 'room', room: data.room, youId: data.youId } : null;
    case 'left':
      return { type: 'left' };
    case 'error':
      return typeof data.reason === 'string' ? { type: 'error', reason: data.reason } : null;
    default:
      return null;
  }
}
