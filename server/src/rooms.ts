import type { ErrorReason, RoomView } from './protocol';

/** Tyle miejsc co w trybie jednoosobowym (człowiek + 4 boty), żeby potem podpiąć ten sam ekran gry. */
export const MAX_PLAYERS = 5;
export const CODE_LENGTH = 5;
/** Bez 0/O i 1/I – kod przepisuje się z ekranu kolegi. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Kontener ma 0,5 GiB pamięci; 200 pokoi po 5 graczy to i tak dużo jak na projekt. */
export const MAX_ROOMS = 200;
export const NICK_MIN = 2;
export const NICK_MAX = 16;
/** Po tylu trafieniach w zajęte kody poddajemy się zamiast kręcić się w pętli. */
const MAX_CODE_ATTEMPTS = 50;

/** Przycina i skleja spacje. Zwraca `null`, gdy nick po tym ma złą długość. KOPIA: `src/multiplayer/nick.ts`. */
export function normalizeNick(raw: string): string | null {
  const nick = raw.trim().replace(/\s+/g, ' ');
  return nick.length >= NICK_MIN && nick.length <= NICK_MAX ? nick : null;
}

/** Wielkie litery, bez spacji. KOPIA: `src/multiplayer/roomCode.ts`. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

interface Member {
  id: string;
  nick: string;
}

interface Room {
  code: string;
  /** Kolejność dołączenia; pierwszy jest hostem, więc po jego wyjściu koronę dostaje najdłużej obecny. */
  members: Member[];
}

export type Joined = { ok: true; code: string; playerId: string } | { ok: false; reason: ErrorReason };

export interface RoomRegistryOptions {
  /** Liczba z [0, 1); w testach podstawiamy przewidywalną. */
  random?: () => number;
  maxRooms?: number;
}

/** Pokoje w pamięci procesu. Bez socketów i logów – `app.ts` łączy to z połączeniami. */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  /** playerId → kod pokoju. */
  private readonly playerRoom = new Map<string, string>();
  private nextPlayerId = 1;
  private readonly random: () => number;
  private readonly maxRooms: number;

  constructor({ random = Math.random, maxRooms = MAX_ROOMS }: RoomRegistryOptions = {}) {
    this.random = random;
    this.maxRooms = maxRooms;
  }

  create(rawNick: string): Joined {
    const nick = normalizeNick(rawNick);
    if (!nick) return { ok: false, reason: 'nick-invalid' };
    if (this.rooms.size >= this.maxRooms) return { ok: false, reason: 'too-many-rooms' };
    const code = this.freeCode();
    if (!code) return { ok: false, reason: 'internal' };
    const id = this.newPlayerId();
    this.rooms.set(code, { code, members: [{ id, nick }] });
    this.playerRoom.set(id, code);
    return { ok: true, code, playerId: id };
  }

  join(rawCode: string, rawNick: string): Joined {
    const nick = normalizeNick(rawNick);
    if (!nick) return { ok: false, reason: 'nick-invalid' };
    const room = this.rooms.get(normalizeCode(rawCode));
    if (!room) return { ok: false, reason: 'room-not-found' };
    if (room.members.length >= MAX_PLAYERS) return { ok: false, reason: 'room-full' };
    const lower = nick.toLocaleLowerCase('pl');
    if (room.members.some((m) => m.nick.toLocaleLowerCase('pl') === lower)) return { ok: false, reason: 'nick-taken' };
    const id = this.newPlayerId();
    room.members.push({ id, nick });
    this.playerRoom.set(id, room.code);
    return { ok: true, code: room.code, playerId: id };
  }

  /** Usuwa gracza. Zwraca kod pokoju (albo `null`, gdy gracza nie było) i czy pokój po tym zniknął. */
  leave(playerId: string): { code: string; removed: boolean } | null {
    const code = this.playerRoom.get(playerId);
    if (!code) return null;
    this.playerRoom.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return { code, removed: true };
    room.members = room.members.filter((m) => m.id !== playerId);
    if (room.members.length === 0) {
      this.rooms.delete(code);
      return { code, removed: true };
    }
    return { code, removed: false };
  }

  view(code: string): RoomView | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return { code, players: room.members.map((m, i) => ({ id: m.id, nick: m.nick, host: i === 0 })) };
  }

  /** Id graczy w pokoju (do rozesłania stanu). */
  playerIds(code: string): string[] {
    return this.rooms.get(code)?.members.map((m) => m.id) ?? [];
  }

  roomCount(): number {
    return this.rooms.size;
  }

  private newPlayerId(): string {
    return `p${this.nextPlayerId++}`;
  }

  private freeCode(): string | null {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        const index = Math.min(CODE_ALPHABET.length - 1, Math.floor(this.random() * CODE_ALPHABET.length));
        code += CODE_ALPHABET[index];
      }
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }
}
