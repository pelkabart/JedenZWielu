import { WebSocket } from 'ws';

import { createApp, MAX_MESSAGE_BYTES, parseClientMessage, type App, type ServerMessage } from '../app';

const FIXED_NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

let app: App;
let base: string;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  app = createApp({ version: '1.2.3', now: () => FIXED_NOW });
  const port = await app.listen(0, '127.0.0.1');
  base = `127.0.0.1:${port}`;
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  await app.close();
});

/** Otwiera połączenie i zbiera wiadomości; `next()` czeka na kolejną. */
async function connect(path = '/ws') {
  const ws = new WebSocket(`ws://${base}${path}`);
  sockets.push(ws);
  const inbox: ServerMessage[] = [];
  const waiters: ((m: ServerMessage) => void)[] = [];
  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else inbox.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const next = () =>
    new Promise<ServerMessage>((resolve) => {
      const queued = inbox.shift();
      if (queued) resolve(queued);
      else waiters.push(resolve);
    });
  return { ws, next };
}

const closed = (ws: WebSocket) => new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));

describe('GET /health', () => {
  it('zwraca status ok, wersję i czas z zegara', async () => {
    const response = await fetch(`http://${base}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok', version: '1.2.3', time: '2026-11-03T12:00:00.000Z' });
  });

  it('parametry zapytania nie przeszkadzają', async () => {
    const response = await fetch(`http://${base}/health?probe=1`);
    expect(response.status).toBe(200);
  });

  it('nieznana trasa: 404', async () => {
    const response = await fetch(`http://${base}/admin`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not-found' });
  });

  it('zła metoda na /health: 404', async () => {
    const response = await fetch(`http://${base}/health`, { method: 'POST' });
    expect(response.status).toBe(404);
  });
});

describe('WebSocket /ws', () => {
  it('wita wersją i odpowiada pong na ping', async () => {
    const { ws, next } = await connect();
    expect(await next()).toEqual({ type: 'hello', version: '1.2.3' });
    ws.send(JSON.stringify({ type: 'ping', id: 7 }));
    expect(await next()).toEqual({ type: 'pong', id: 7, serverTime: FIXED_NOW });
  });

  it('zły JSON: odpowiedź error, połączenie dalej działa', async () => {
    const { ws, next } = await connect();
    await next();
    ws.send('to nie jest json');
    expect(await next()).toEqual({ type: 'error', reason: 'invalid-json' });
    ws.send(JSON.stringify({ type: 'ping', id: 'a' }));
    expect(await next()).toMatchObject({ type: 'pong', id: 'a' });
  });

  it('nieznany typ wiadomości', async () => {
    const { ws, next } = await connect();
    await next();
    ws.send(JSON.stringify({ type: 'hack' }));
    expect(await next()).toEqual({ type: 'error', reason: 'unknown-type' });
  });

  it('za duża wiadomość zamyka tylko to połączenie', async () => {
    const big = await connect();
    const other = await connect();
    await big.next();
    await other.next();
    const code = closed(big.ws);
    big.ws.send('x'.repeat(MAX_MESSAGE_BYTES + 1));
    expect(await code).toBe(1009);
    other.ws.send(JSON.stringify({ type: 'ping', id: 1 }));
    expect(await other.next()).toMatchObject({ type: 'pong', id: 1 });
  });

  it('WebSocket pod złą ścieżką jest odrzucany', async () => {
    await expect(connect('/inne')).rejects.toThrow(/404/);
  });

  it('close() zamyka otwarte połączenia kodem 1001', async () => {
    const { ws, next } = await connect();
    await next();
    expect(app.connectionCount()).toBe(1);
    const code = closed(ws);
    await app.close();
    expect(await code).toBe(1001);
    // afterEach zamyka jeszcze raz – nie może to rzucić.
    app = createApp({ version: 'x' });
    await app.listen(0, '127.0.0.1');
  });
});

describe('parseClientMessage', () => {
  it.each([
    ['{"type":"ping","id":1}', { type: 'ping', id: 1 }],
    ['{"type":"ping","id":"abc"}', { type: 'ping', id: 'abc' }],
    ['{"type":"ping"}', { error: 'missing-id' }],
    ['{"type":"ping","id":{}}', { error: 'missing-id' }],
    ['[]', { error: 'not-an-object' }],
    ['null', { error: 'not-an-object' }],
    ['42', { error: 'not-an-object' }],
    ['{', { error: 'invalid-json' }],
    ['{"type":"other"}', { error: 'unknown-type' }],
  ])('%s', (raw, expected) => {
    expect(parseClientMessage(raw)).toEqual(expected);
  });
});
