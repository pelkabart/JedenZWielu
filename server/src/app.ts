import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import { createLogger } from './log';

const log = createLogger('serwer');

/** Większa wiadomość zamyka połączenie (kod 1009) – kontener ma tylko 0,5 GiB pamięci. */
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const WS_PATH = '/ws';
export const HEALTH_PATH = '/health';

export interface AppOptions {
  /** Wersja widoczna w `/health` – po wdrożeniu widać, czy działa nowy obraz. */
  version: string;
  /** Wstrzykiwany zegar (w testach stały). */
  now?: () => number;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  time: string;
}

/** Wiadomości od klienta. Na razie tylko ping; multiplayer dołoży kolejne typy. */
export type ClientMessage = { type: 'ping'; id: string | number };
export type ServerMessage =
  | { type: 'hello'; version: string }
  | { type: 'pong'; id: string | number; serverTime: number }
  | { type: 'error'; reason: string };

export interface App {
  server: Server;
  /** Uruchamia nasłuch; `port: 0` = losowy wolny port (testy). Zwraca faktyczny port. */
  listen(port: number, host?: string): Promise<number>;
  /** Zamyka WebSockety kodem 1001 („serwer odchodzi”) i przestaje przyjmować połączenia. */
  close(): Promise<void>;
  connectionCount(): number;
}

/** Sprawdza wiadomość od klienta. Zwraca opis błędu zamiast rzucać – zła wiadomość nie może wywrócić serwera. */
export function parseClientMessage(raw: string): ClientMessage | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: 'invalid-json' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { error: 'not-an-object' };
  const message = data as Record<string, unknown>;
  if (message.type === 'ping') {
    const id = message.id;
    if (typeof id !== 'string' && typeof id !== 'number') return { error: 'missing-id' };
    return { type: 'ping', id };
  }
  return { error: 'unknown-type' };
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

export function createApp({ version, now = Date.now }: AppOptions): App {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  let nextConnectionId = 1;

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
    const connectionId = nextConnectionId++;
    log.info('Nowe połączenie', { connectionId, open: wss.clients.size });
    const send = (message: ServerMessage) => ws.send(JSON.stringify(message));
    send({ type: 'hello', version });

    ws.on('message', (raw: RawData) => {
      try {
        const parsed = parseClientMessage(raw.toString());
        if ('error' in parsed) {
          log.warn('Zła wiadomość', { connectionId, reason: parsed.error });
          send({ type: 'error', reason: parsed.error });
          return;
        }
        send({ type: 'pong', id: parsed.id, serverTime: now() });
      } catch (e) {
        log.error('Błąd obsługi wiadomości', { connectionId, error: e instanceof Error ? e.message : 'unknown' });
        send({ type: 'error', reason: 'internal' });
      }
    });

    ws.on('close', (code) => log.info('Koniec połączenia', { connectionId, code }));
    // Bez tej obsługi np. przekroczony `maxPayload` byłby nieobsłużonym błędem.
    ws.on('error', (e) => log.warn('Błąd połączenia', { connectionId, error: e.message }));
  });

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
        for (const client of wss.clients) client.close(1001, 'server-shutdown');
        wss.close();
        server.close(() => resolve());
        server.closeIdleConnections();
      }),
    connectionCount: () => wss.clients.size,
  };
}
