import { WebSocket, type ClientOptions } from 'ws';

import { createApp, MAX_MESSAGE_BYTES, parseClientMessage, type App, type ServerMessage } from '../app';
import { configureLog, type LogEntry } from '../log';
import { MAX_PLAYERS } from '../rooms';

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
async function connect(path = '/ws', options?: ClientOptions, host = base) {
  const ws = new WebSocket(`ws://${host}${path}`, options);
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
    ['{"type":"create","nick":"Ala"}', { type: 'create', nick: 'Ala' }],
    ['{"type":"create"}', { error: 'missing-field' }],
    ['{"type":"create","nick":5}', { error: 'missing-field' }],
    ['{"type":"join","code":"ABCDE","nick":"Ola"}', { type: 'join', code: 'ABCDE', nick: 'Ola' }],
    ['{"type":"join","nick":"Ola"}', { error: 'missing-field' }],
    ['{"type":"join","code":"ABCDE"}', { error: 'missing-field' }],
    ['{"type":"leave"}', { type: 'leave' }],
  ])('%s', (raw, expected) => {
    expect(parseClientMessage(raw)).toEqual(expected);
  });
});

it('parseClientMessage obcina bardzo długi nick do 64 znaków (walidacja i tak go odrzuci)', () => {
  expect(parseClientMessage(JSON.stringify({ type: 'create', nick: 'x'.repeat(5000) }))).toEqual({
    type: 'create',
    nick: 'x'.repeat(64),
  });
});

type Client = Awaited<ReturnType<typeof connect>>;

/** Połączenie po powitaniu `hello`. */
async function player(): Promise<Client> {
  const client = await connect();
  expect(await client.next()).toMatchObject({ type: 'hello' });
  return client;
}

const send = (client: Client, message: object) => client.ws.send(JSON.stringify(message));

async function nextRoom(client: Client) {
  const message = await client.next();
  if (message.type !== 'room') throw new Error(`oczekiwano room, przyszło ${JSON.stringify(message)}`);
  return message;
}

const nicks = (message: { room: { players: { nick: string; host: boolean }[] } }) =>
  message.room.players.map((p) => (p.host ? `${p.nick}*` : p.nick));

async function createRoom(nick = 'Ala') {
  const host = await player();
  send(host, { type: 'create', nick });
  const message = await nextRoom(host);
  return { host, code: message.room.code, message };
}

async function joinRoom(code: string, nick: string, ...others: Client[]) {
  const guest = await player();
  send(guest, { type: 'join', code, nick });
  const view = await nextRoom(guest);
  for (const other of others) await nextRoom(other);
  return { guest, view };
}

describe('pokoje przez WebSocket', () => {
  it('create: twórca dostaje kod, siebie jako hosta i swoje id', async () => {
    const { code, message } = await createRoom('Ala');
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect(message.room.players).toEqual([{ id: message.youId, nick: 'Ala', host: true }]);
    expect(app.roomCount()).toBe(1);
  });

  it('trzech graczy: każdy po dołączeniu dostaje pełną listę, każdy ze swoim youId', async () => {
    const { host, code } = await createRoom('Ala');
    const second = await player();
    send(second, { type: 'join', code, nick: 'Ola' });
    const secondView = await nextRoom(second);
    expect(nicks(secondView)).toEqual(['Ala*', 'Ola']);
    expect(nicks(await nextRoom(host))).toEqual(['Ala*', 'Ola']);

    const third = await player();
    send(third, { type: 'join', code: code.toLowerCase(), nick: 'Ela' });
    const views = await Promise.all([nextRoom(host), nextRoom(second), nextRoom(third)]);
    for (const view of views) expect(nicks(view)).toEqual(['Ala*', 'Ola', 'Ela']);
    expect(new Set(views.map((v) => v.youId)).size).toBe(3);
    expect(views[1].youId).toBe(secondView.youId);
  });

  it('zły kod: room-not-found, połączenie dalej działa', async () => {
    const guest = await player();
    send(guest, { type: 'join', code: 'ZZZZZ', nick: 'Ola' });
    expect(await guest.next()).toEqual({ type: 'error', reason: 'room-not-found' });
    send(guest, { type: 'ping', id: 1 });
    expect(await guest.next()).toMatchObject({ type: 'pong' });
  });

  it('zajęty nick: nick-taken, a ten sam gracz może spróbować z innym', async () => {
    const { code } = await createRoom('Ala');
    const guest = await player();
    send(guest, { type: 'join', code, nick: 'ala' });
    expect(await guest.next()).toEqual({ type: 'error', reason: 'nick-taken' });
    send(guest, { type: 'join', code, nick: 'Ala2' });
    expect(nicks(await nextRoom(guest))).toEqual(['Ala*', 'Ala2']);
  });

  it('pełny pokój: room-full', async () => {
    const { host, code } = await createRoom('Host');
    const inRoom: Client[] = [host];
    for (let i = 1; i < MAX_PLAYERS; i++) inRoom.push((await joinRoom(code, `Gracz${i}`, ...inRoom)).guest);
    const late = await player();
    send(late, { type: 'join', code, nick: 'Spóźniony' });
    expect(await late.next()).toEqual({ type: 'error', reason: 'room-full' });
  });

  it('drugi create z tego samego połączenia: already-in-room', async () => {
    const { host } = await createRoom('Ala');
    send(host, { type: 'create', nick: 'Ala' });
    expect(await host.next()).toEqual({ type: 'error', reason: 'already-in-room' });
    expect(app.roomCount()).toBe(1);
  });

  it('leave: potwierdzenie left, pozostali dostają listę z nowym hostem', async () => {
    const { host, code } = await createRoom('Ala');
    const { guest } = await joinRoom(code, 'Ola', host);

    send(host, { type: 'leave' });
    expect(await host.next()).toEqual({ type: 'left' });
    expect(nicks(await nextRoom(guest))).toEqual(['Ola*']);

    send(host, { type: 'leave' });
    expect(await host.next()).toEqual({ type: 'error', reason: 'not-in-room' });
  });

  it('rozłączenie usuwa gracza z listy u pozostałych', async () => {
    const { host, code } = await createRoom('Ala');
    const { guest } = await joinRoom(code, 'Ola', host);
    guest.ws.close();
    expect(nicks(await nextRoom(host))).toEqual(['Ala*']);
  });

  it('ostatni gracz się rozłącza: pokój znika', async () => {
    const { host } = await createRoom('Ala');
    const done = closed(host.ws);
    host.ws.close();
    await done;
    // Serwer dostaje `close` chwilę po kliencie.
    await new Promise((r) => setTimeout(r, 50));
    expect(app.roomCount()).toBe(0);
  });

  it('logi pokoi mają kod i liczbę graczy, ale nie nick', async () => {
    const entries: LogEntry[] = [];
    configureLog({ sink: (e) => entries.push(e) });
    try {
      await createRoom('TajnyNick');
    } finally {
      configureLog({ sink: null });
    }
    const created = entries.find((e) => e.message === 'Nowy pokój');
    expect(created?.data).toMatchObject({ players: 1, rooms: 1 });
    expect(JSON.stringify(entries)).not.toContain('TajnyNick');
  });
});

describe('heartbeat', () => {
  it('zrywa połączenie, które nie odpowiada na ping, i zwalnia jego miejsce w pokoju', async () => {
    const fast = createApp({ version: 'hb', heartbeatMs: 40 });
    const port = await fast.listen(0, '127.0.0.1');
    try {
      const host = `127.0.0.1:${port}`;
      const alive = await connect('/ws', undefined, host);
      const dead = await connect('/ws', { autoPong: false }, host);
      await alive.next();
      await dead.next();
      dead.ws.send(JSON.stringify({ type: 'create', nick: 'Duch' }));
      await dead.next();
      expect(fast.roomCount()).toBe(1);

      expect(await closed(dead.ws)).toBe(1006);
      await new Promise((r) => setTimeout(r, 20));
      expect(fast.roomCount()).toBe(0);
      expect(fast.connectionCount()).toBe(1);
      expect(alive.ws.readyState).toBe(WebSocket.OPEN);
    } finally {
      await fast.close();
    }
  });
});
