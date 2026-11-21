import { normalizeNick } from '../nick';
import { MAX_PLAYERS, type RoomView } from '../protocol';
import type { SocketLike } from '../RoomClient';

/**
 * Atrapa serwera pokoi do testów integracyjnych: odgrywa zachowanie `server/src/app.ts` + `rooms.ts`
 * (hello po połączeniu, create/join/leave, rozsyłanie listy, rozłączenie). Prawdziwy serwer ma własne testy
 * na prawdziwych socketach; tu chodzi o to, czy aplikacja poprawnie z nim rozmawia.
 * Wiadomości są dostarczane przez `setTimeout(0)`, jak przez sieć – testy na fake timers.
 */
export function fakeRoomServer({ version = 'test', latencyMs = 0, codes = ['ABCDE', 'FGHJK', 'LMNPQ'] } = {}) {
  type Conn = { socket: ServerSideSocket; playerId: string | null };
  const rooms = new Map<string, { code: string; members: { id: string; nick: string; conn: Conn }[] }>();
  const conns: Conn[] = [];
  let nextId = 1;
  let nextCode = 0;

  const deliver = (conn: Conn, message: object) =>
    setTimeout(() => {
      if (conn.socket.readyState === 1) conn.socket.onmessage?.({ data: JSON.stringify(message) });
    }, latencyMs);

  const view = (code: string): RoomView | null => {
    const room = rooms.get(code);
    return room ? { code, players: room.members.map((m, i) => ({ id: m.id, nick: m.nick, host: i === 0 })) } : null;
  };

  const broadcast = (code: string) => {
    const room = rooms.get(code);
    const v = view(code);
    if (!room || !v) return;
    for (const m of room.members) deliver(m.conn, { type: 'room', room: v, youId: m.id });
  };

  const leave = (conn: Conn) => {
    if (!conn.playerId) return;
    for (const room of rooms.values()) {
      const before = room.members.length;
      room.members = room.members.filter((m) => m.id !== conn.playerId);
      if (room.members.length !== before) {
        if (room.members.length === 0) rooms.delete(room.code);
        else broadcast(room.code);
      }
    }
    conn.playerId = null;
  };

  const handle = (conn: Conn, raw: string) => {
    const message = JSON.parse(raw) as { type: string; nick?: string; code?: string };
    if (message.type === 'leave') {
      leave(conn);
      deliver(conn, { type: 'left' });
      return;
    }
    if (message.type !== 'create' && message.type !== 'join') return;
    if (conn.playerId) return deliver(conn, { type: 'error', reason: 'already-in-room' });
    const nick = normalizeNick(message.nick ?? '');
    if (!nick) return deliver(conn, { type: 'error', reason: 'nick-invalid' });
    let code: string;
    if (message.type === 'create') {
      code = codes[nextCode++ % codes.length];
      rooms.set(code, { code, members: [] });
    } else {
      code = (message.code ?? '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return deliver(conn, { type: 'error', reason: 'room-not-found' });
      if (room.members.length >= MAX_PLAYERS) return deliver(conn, { type: 'error', reason: 'room-full' });
      if (room.members.some((m) => m.nick.toLowerCase() === nick.toLowerCase())) {
        return deliver(conn, { type: 'error', reason: 'nick-taken' });
      }
    }
    const id = `p${nextId++}`;
    conn.playerId = id;
    rooms.get(code)!.members.push({ id, nick, conn });
    broadcast(code);
  };

  class ServerSideSocket implements SocketLike {
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    readonly conn: Conn;

    constructor(readonly url: string) {
      this.conn = { socket: this, playerId: null };
      conns.push(this.conn);
      setTimeout(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        this.onopen?.();
        deliver(this.conn, { type: 'hello', version });
      }, latencyMs);
    }

    send(data: string) {
      if (this.readyState !== 1) throw new Error('socket not open');
      setTimeout(() => handle(this.conn, data), latencyMs);
    }

    close() {
      if (this.readyState >= 2) return;
      this.readyState = 3;
      setTimeout(() => leave(this.conn), latencyMs);
    }

    /** Sieć zrywa połączenie (bez `close` od klienta). */
    drop(code = 1006) {
      if (this.readyState >= 2) return;
      this.readyState = 3;
      leave(this.conn);
      this.onclose?.({ code });
    }
  }

  return {
    createSocket: (url: string) => new ServerSideSocket(url),
    room: (code: string) => view(code),
    roomCount: () => rooms.size,
    /** Restart kontenera: wszystkie połączenia zamknięte kodem 1001, pokoje znikają. */
    restart() {
      for (const conn of conns) conn.socket.drop(1001);
      rooms.clear();
    },
    connections: () => conns.map((c) => c.socket),
  };
}
