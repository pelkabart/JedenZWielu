/**
 * Test integracyjny poczekalni: kilka prawdziwych `RoomClient` (tak jak na kilku telefonach) rozmawia z atrapą
 * serwera, która odgrywa `server/src/app.ts` + `rooms.ts`, z opóźnieniem jak w sieci. Jest fake timers.
 */
import { getLogEntries, resetLog } from '@/lib/log';

import { MAX_PLAYERS } from '../protocol';
import { RoomClient, type RoomState } from '../RoomClient';
import { fakeRoomServer } from '../testing/fakeRoomServer';

const URL = 'https://jzw-server.kindwave-1234.austriaeast.azurecontainerapps.io/';
const LATENCY = 40;

function phone(server: ReturnType<typeof fakeRoomServer>) {
  return new RoomClient({ serverUrl: URL, createSocket: server.createSocket, timeoutMs: 15_000 });
}

const settle = () => jest.advanceTimersByTime(LATENCY * 10);

function inRoom(state: RoomState) {
  if (state.status !== 'in-room') throw new Error(`oczekiwano in-room, jest ${JSON.stringify(state)}`);
  return state;
}

const nicks = (client: RoomClient) => inRoom(client.getState()).room.players.map((p) => (p.host ? `${p.nick}*` : p.nick));

beforeEach(() => {
  resetLog();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('host tworzy pokój, dwóch graczy dołącza kodem i wszyscy widzą tę samą listę', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  const ola = phone(server);
  const ela = phone(server);

  host.create('Ala');
  settle();
  const code = inRoom(host.getState()).room.code;
  expect(nicks(host)).toEqual(['Ala*']);

  ola.join(code.toLowerCase(), 'Ola');
  settle();
  ela.join(code, 'Ela');
  settle();

  for (const client of [host, ola, ela]) expect(nicks(client)).toEqual(['Ala*', 'Ola', 'Ela']);
  const ids = [host, ola, ela].map((c) => inRoom(c.getState()).youId);
  expect(new Set(ids).size).toBe(3);
});

it('zły kod i zajęty nick: komunikaty dla gracza, ponowna próba się udaje', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  const guest = phone(server);
  host.create('Ala');
  settle();
  const code = inRoom(host.getState()).room.code;

  guest.join('ZZZZZ', 'Ola');
  settle();
  expect(guest.getState()).toMatchObject({ status: 'error', reason: 'room-not-found' });

  guest.join(code, 'ALA');
  settle();
  expect(guest.getState()).toMatchObject({ status: 'error', reason: 'nick-taken' });

  guest.join(code, 'Ola');
  settle();
  expect(nicks(guest)).toEqual(['Ala*', 'Ola']);
});

it(`pełny pokój: ${MAX_PLAYERS + 1}. gracz dostaje room-full`, () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  host.create('Host');
  settle();
  const code = inRoom(host.getState()).room.code;
  for (let i = 1; i < MAX_PLAYERS; i++) {
    phone(server).join(code, `Gracz${i}`);
    settle();
  }
  expect(nicks(host)).toHaveLength(MAX_PLAYERS);
  const late = phone(server);
  late.join(code, 'Spóźniony');
  settle();
  expect(late.getState()).toMatchObject({ status: 'error', reason: 'room-full' });
});

it('wyjście hosta: korona przechodzi na następnego, ostatni gracz zamyka pokój', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  const guest = phone(server);
  host.create('Ala');
  settle();
  guest.join(inRoom(host.getState()).room.code, 'Ola');
  settle();

  host.leave();
  settle();
  expect(host.getState()).toEqual({ status: 'idle' });
  expect(nicks(guest)).toEqual(['Ola*']);

  guest.leave();
  settle();
  expect(server.roomCount()).toBe(0);
});

it('telefon traci zasięg: pozostali widzą krótszą listę, a on komunikat o zerwaniu', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  const guest = phone(server);
  host.create('Ala');
  settle();
  guest.join(inRoom(host.getState()).room.code, 'Ola');
  settle();

  server.connections()[1].drop(1006);
  settle();
  expect(guest.getState()).toMatchObject({ status: 'error', reason: 'dropped' });
  expect(nicks(host)).toEqual(['Ala*']);
});

it('restart serwera (nowa wersja kontenera): wszyscy dostają komunikat o restarcie', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  host.create('Ala');
  settle();
  server.restart();
  expect(host.getState()).toMatchObject({ status: 'error', reason: 'server-restart' });
  expect(server.roomCount()).toBe(0);
});

it('wyjście w trakcie łączenia: spóźniona odpowiedź nie zmienia stanu, gracz nie zostaje w pokoju', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  host.create('Ala');
  jest.advanceTimersByTime(LATENCY);
  host.leave();
  settle();
  expect(host.getState()).toEqual({ status: 'idle' });
  expect(server.roomCount()).toBe(0);
});

it('logi przebiegu: łączenie, wejście do pokoju, wyjście (tag multiplayer)', () => {
  const server = fakeRoomServer({ latencyMs: LATENCY });
  const host = phone(server);
  host.create('Ala');
  settle();
  host.leave();
  const messages = getLogEntries()
    .filter((e) => e.tag === 'multiplayer' && e.level !== 'debug')
    .map((e) => e.message);
  expect(messages).toEqual(['Łączenie z serwerem', 'Jestem w pokoju', 'Wyjście z multiplayera']);
});
