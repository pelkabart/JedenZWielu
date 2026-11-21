import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import { createLogger } from './log';
import { parseClientMessage, type ClientMessage, type ServerMessage } from './protocol';
import { RoomRegistry } from './rooms';

export { parseClientMessage } from './protocol';
export type { ClientMessage, ServerMessage } from './protocol';

const log = createLogger('serwer');
const roomLog = createLogger('pokoje');

/** Większa wiadomość zamyka połączenie (kod 1009) – kontener ma tylko 0,5 GiB pamięci. */
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const WS_PATH = '/ws';
export const HEALTH_PATH = '/health';
/** Co tyle serwer pinguje klientów; kto nie odpowie do następnego pinga, jest rozłączany. */
export const HEARTBEAT_MS = 30_000;

export interface AppOptions {
  /** Wersja widoczna w `/health` – po wdrożeniu widać, czy działa nowy obraz. */
  version: string;
  /** Wstrzykiwany zegar (w testach stały). */
  now?: () => number;
  /** Losowanie kodów pokoi (w testach przewidywalne). */
  random?: () => number;
  heartbeatMs?: number;
  maxRooms?: number;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  time: string;
}

export interface App {
  server: Server;
  /** Uruchamia nasłuch; `port: 0` = losowy wolny port (testy). Zwraca faktyczny port. */
  listen(port: number, host?: string): Promise<number>;
  /** Zamyka WebSockety kodem 1001 („serwer odchodzi”) i przestaje przyjmować połączenia. */
  close(): Promise<void>;
  connectionCount(): number;
  roomCount(): number;
}

interface Connection {
  id: number;
  ws: WebSocket;
  playerId: string | null;
  alive: boolean;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function pathOf(request: IncomingMessage): string {
  // Sam `url` to np. "/health?x=1"; baza jest tylko po to, żeby URL dało się sparsować.
  try {
    return new URL(request.url ?? '/', 'http://localhost').pathname;
  } catch {
    return '';
  }
}

export function createApp({ version, now = Date.now, random, heartbeatMs = HEARTBEAT_MS, maxRooms }: AppOptions): App {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const rooms = new RoomRegistry({ random, maxRooms });
  /** playerId → połączenie, żeby rozesłać stan pokoju. */
  const byPlayer = new Map<string, Connection>();
  const connections = new Set<Connection>();
  let nextConnectionId = 1;

  const send = (conn: Connection, message: ServerMessage) => {
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(message));
  };

  const broadcastRoom = (code: string) => {
    const room = rooms.view(code);
    if (!room) return;
    for (const playerId of rooms.playerIds(code)) {
      const conn = byPlayer.get(playerId);
      if (conn) send(conn, { type: 'room', room, youId: playerId });
    }
  };

  /** Wyjście z pokoju (na `leave` i przy rozłączeniu). Pozostali dostają nową listę. */
  const leaveRoom = (conn: Connection, why: 'leave' | 'disconnect') => {
    if (!conn.playerId) return;
    const result = rooms.leave(conn.playerId);
    byPlayer.delete(conn.playerId);
    conn.playerId = null;
    if (!result) return;
    roomLog.info('Gracz wyszedł z pokoju', {
      connectionId: conn.id,
      code: result.code,
      why,
      players: rooms.playerIds(result.code).length,
      removed: result.removed,
    });
    if (!result.removed) broadcastRoom(result.code);
  };

  const handle = (conn: Connection, message: ClientMessage) => {
    switch (message.type) {
      case 'ping':
        send(conn, { type: 'pong', id: message.id, serverTime: now() });
        return;
      case 'create':
      case 'join': {
        if (conn.playerId) {
          send(conn, { type: 'error', reason: 'already-in-room' });
          return;
        }
        const result = message.type === 'create' ? rooms.create(message.nick) : rooms.join(message.code, message.nick);
        if (!result.ok) {
          roomLog.info('Odmowa wejścia do pokoju', { connectionId: conn.id, action: message.type, reason: result.reason });
          send(conn, { type: 'error', reason: result.reason });
          return;
        }
        conn.playerId = result.playerId;
        byPlayer.set(result.playerId, conn);
        roomLog.info(message.type === 'create' ? 'Nowy pokój' : 'Gracz dołączył', {
          connectionId: conn.id,
          code: result.code,
          players: rooms.playerIds(result.code).length,
          rooms: rooms.roomCount(),
        });
        broadcastRoom(result.code);
        return;
      }
      case 'leave':
        if (!conn.playerId) {
          send(conn, { type: 'error', reason: 'not-in-room' });
          return;
        }
        leaveRoom(conn, 'leave');
        send(conn, { type: 'left' });
        return;
    }
  };

  const server = createServer((request, response) => {
    const path = pathOf(request);
    if (request.method === 'GET' && path === HEALTH_PATH) {
      const body: HealthResponse = { status: 'ok', version, time: new Date(now()).toISOString() };
      sendJson(response, 200, body);
      return;
    }
    log.debug('Nieznana trasa', { method: request.method, path: path.slice(0, 64) });
    sendJson(response, 404, { error: 'not-found' });
  });

  server.on('upgrade', (request, socket, head) => {
    if (pathOf(request) !== WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  wss.on('connection', (ws: WebSocket) => {
    const conn: Connection = { id: nextConnectionId++, ws, playerId: null, alive: true };
    connections.add(conn);
    log.info('Nowe połączenie', { connectionId: conn.id, open: wss.clients.size });
    send(conn, { type: 'hello', version });

    ws.on('pong', () => {
      conn.alive = true;
    });

    ws.on('message', (raw: RawData) => {
      try {
        const parsed = parseClientMessage(raw.toString());
        if ('error' in parsed) {
          log.warn('Zła wiadomość', { connectionId: conn.id, reason: parsed.error });
          send(conn, { type: 'error', reason: parsed.error });
          return;
        }
        handle(conn, parsed);
      } catch (e) {
        log.error('Błąd obsługi wiadomości', { connectionId: conn.id, error: e instanceof Error ? e.message : 'unknown' });
        send(conn, { type: 'error', reason: 'internal' });
      }
    });

    ws.on('close', (code) => {
      connections.delete(conn);
      leaveRoom(conn, 'disconnect');
      log.info('Koniec połączenia', { connectionId: conn.id, code });
    });
    // Bez tej obsługi np. przekroczony `maxPayload` byłby nieobsłużonym błędem.
    ws.on('error', (e) => log.warn('Błąd połączenia', { connectionId: conn.id, error: e.message }));
  });

  // Telefon, który stracił zasięg, nie wysyła `close` – bez pingów wisiałby w poczekalni na zawsze.
  const heartbeat = setInterval(() => {
    for (const conn of connections) {
      if (!conn.alive) {
        log.info('Brak odpowiedzi na ping – rozłączam', { connectionId: conn.id });
        conn.ws.terminate();
        continue;
      }
      conn.alive = false;
      conn.ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  return {
    server,
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve((server.address() as AddressInfo).port);
        });
      }),
    close: () =>
      new Promise((resolve) => {
        clearInterval(heartbeat);
        for (const client of wss.clients) client.close(1001, 'server-shutdown');
        wss.close();
        server.close(() => resolve());
        server.closeIdleConnections();
      }),
    connectionCount: () => wss.clients.size,
    roomCount: () => rooms.roomCount(),
  };
}
