/**
 * Test działającego serwera (lokalnie albo na Azure):
 *   npm run smoke -- http://localhost:8080
 *   npm run smoke -- https://<nazwa>.<region>.azurecontainerapps.io
 * Sprawdza GET /health, WebSocket /ws (hello + 3× ping-pong) oraz pokój: jeden klient tworzy, drugi dołącza kodem.
 * Kod wyjścia 0 = wszystko działa.
 */
import { WebSocket } from 'ws';

/** Zimny start kontenera na Azure (min-replicas 0) potrafi trwać kilkanaście sekund. */
const TIMEOUT_MS = 30_000;
const PINGS = 3;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function checkHealth(base: string) {
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    fail(`GET /health: brak odpowiedzi (${e instanceof Error ? e.message : e})`);
  }
  const ms = Date.now() - started;
  if (!response.ok) fail(`GET /health: status ${response.status}`);
  const body = (await response.json().catch(() => null)) as { status?: string; version?: string } | null;
  if (body?.status !== 'ok') fail(`GET /health: nieoczekiwana odpowiedź ${JSON.stringify(body)}`);
  console.log(`✓ GET /health – wersja ${body.version}, ${ms} ms`);
}

function checkWebSocket(base: string): Promise<void> {
  const wsUrl = base.replace(/^http/, 'ws') + '/ws';
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, { handshakeTimeout: TIMEOUT_MS });
    const timer = setTimeout(() => fail(`WebSocket: brak odpowiedzi w ${TIMEOUT_MS / 1000} s`), TIMEOUT_MS);
    const sentAt = new Map<number, number>();
    let pongs = 0;

    const ping = (id: number) => {
      sentAt.set(id, Date.now());
      ws.send(JSON.stringify({ type: 'ping', id }));
    };

    ws.on('error', (e) => fail(`WebSocket ${wsUrl}: ${e.message}`));
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string; id?: number; version?: string };
      if (message.type === 'hello') {
        console.log(`✓ WebSocket ${wsUrl} – powitanie od wersji ${message.version}`);
        ping(1);
      } else if (message.type === 'pong' && typeof message.id === 'number') {
        pongs++;
        console.log(`✓ ping ${message.id} → pong w ${Date.now() - (sentAt.get(message.id) ?? 0)} ms`);
        if (pongs < PINGS) ping(message.id + 1);
        else {
          clearTimeout(timer);
          ws.close(1000);
          resolve();
        }
      } else {
        fail(`WebSocket: nieoczekiwana wiadomość ${raw.toString().slice(0, 200)}`);
      }
    });
  });
}

type RoomMessage = { type: string; room?: { code: string; players: { nick: string; host: boolean }[] }; reason?: string };

/** Otwiera WebSocket i czeka na `hello`; `next()` daje kolejną wiadomość. */
function openClient(wsUrl: string): Promise<{ ws: WebSocket; next: () => Promise<RoomMessage> }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, { handshakeTimeout: TIMEOUT_MS });
    const inbox: RoomMessage[] = [];
    const waiters: ((m: RoomMessage) => void)[] = [];
    const next = () =>
      new Promise<RoomMessage>((res) => {
        const queued = inbox.shift();
        if (queued) res(queued);
        else waiters.push(res);
      });
    ws.on('error', (e) => fail(`WebSocket ${wsUrl}: ${e.message}`));
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as RoomMessage;
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else inbox.push(message);
    });
    ws.once('open', async () => {
      const hello = await next();
      if (hello.type !== 'hello') fail(`WebSocket: zamiast hello przyszło ${JSON.stringify(hello)}`);
      resolve({ ws, next });
    });
  });
}

async function checkRoom(base: string) {
  const wsUrl = base.replace(/^http/, 'ws') + '/ws';
  const timer = setTimeout(() => fail(`Pokój: brak odpowiedzi w ${TIMEOUT_MS / 1000} s`), TIMEOUT_MS);
  const host = await openClient(wsUrl);
  host.ws.send(JSON.stringify({ type: 'create', nick: 'Smoke1' }));
  const created = await host.next();
  if (created.type !== 'room' || !created.room) fail(`create: ${JSON.stringify(created)}`);
  const code = created.room.code;
  console.log(`✓ create – pokój ${code}`);

  const guest = await openClient(wsUrl);
  guest.ws.send(JSON.stringify({ type: 'join', code, nick: 'Smoke2' }));
  const [forGuest, forHost] = await Promise.all([guest.next(), host.next()]);
  for (const message of [forGuest, forHost]) {
    if (message.type !== 'room' || message.room?.players.length !== 2) fail(`join: ${JSON.stringify(message)}`);
  }
  console.log(`✓ join – obaj widzą 2 graczy`);

  guest.ws.close(1000);
  const afterLeave = await host.next();
  if (afterLeave.type !== 'room' || afterLeave.room?.players.length !== 1) fail(`rozłączenie: ${JSON.stringify(afterLeave)}`);
  console.log('✓ rozłączenie – host widzi 1 gracza');
  host.ws.close(1000);
  clearTimeout(timer);
}

async function main() {
  const arg = process.argv[2];
  if (!arg || !/^https?:\/\//.test(arg)) fail('Podaj adres serwera, np. npm run smoke -- http://localhost:8080');
  const base = arg.replace(/\/+$/, '');
  await checkHealth(base);
  await checkWebSocket(base);
  await checkRoom(base);
  console.log('✓ Serwer działa');
}

void main();
