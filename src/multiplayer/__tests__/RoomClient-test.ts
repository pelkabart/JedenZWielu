import { getLogEntries, resetLog } from '@/lib/log';

import { messageFor, RoomClient, toWebSocketUrl, type RoomState } from '../RoomClient';
import { fakeSocketFactory } from '../testing/fakeSocket';

const URL = 'https://jzw.example.azurecontainerapps.io/';
const ROOM = { code: 'ABCDE', players: [{ id: 'p1', nick: 'Ala', host: true }] };

function setup(serverUrl = URL) {
  const factory = fakeSocketFactory();
  const client = new RoomClient({ serverUrl, createSocket: factory.createSocket, timeoutMs: 1000 });
  const states: RoomState['status'][] = [];
  client.subscribe(() => states.push(client.getState().status));
  return { client, sockets: factory.sockets, states, socket: () => factory.sockets[factory.sockets.length - 1] };
}

beforeEach(() => {
  resetLog();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('toWebSocketUrl', () => {
  it.each([
    ['https://x.io', 'wss://x.io/ws'],
    ['https://x.io/', 'wss://x.io/ws'],
    ['  http://192.168.0.5:8080  ', 'ws://192.168.0.5:8080/ws'],
    ['', null],
    ['x.io', null],
  ])('%j → %j', (input, expected) => {
    expect(toWebSocketUrl(input)).toBe(expected);
  });
});

describe('RoomClient', () => {
  it('create: łączy się, po hello wysyła create, po room jest w pokoju', () => {
    const { client, socket, states } = setup();
    client.create('Ala');
    expect(client.getState()).toEqual({ status: 'connecting', action: 'create' });
    expect(socket().url).toBe('wss://jzw.example.azurecontainerapps.io/ws');

    socket().open();
    expect(socket().sent).toEqual([]);
    socket().receive({ type: 'hello', version: '0.2.0' });
    expect(socket().sent).toEqual([{ type: 'create', nick: 'Ala' }]);

    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    expect(client.getState()).toEqual({ status: 'in-room', room: ROOM, youId: 'p1' });
    expect(states).toEqual(['connecting', 'in-room']);
  });

  it('join wysyła kod i nick', () => {
    const { client, socket } = setup();
    client.join('ABCDE', 'Ola');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    expect(socket().lastSent()).toEqual({ type: 'join', code: 'ABCDE', nick: 'Ola' });
  });

  it('nowa lista graczy w pokoju aktualizuje stan', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    const bigger = { code: 'ABCDE', players: [...ROOM.players, { id: 'p2', nick: 'Ola', host: false }] };
    socket().receive({ type: 'room', room: bigger, youId: 'p1' });
    expect(client.getState()).toMatchObject({ status: 'in-room', room: bigger });
  });

  it.each(['room-not-found', 'room-full', 'nick-taken', 'nick-invalid'])('odmowa %s: błąd z komunikatem, socket zamknięty', (reason) => {
    const { client, socket } = setup();
    client.join('ZZZZZ', 'Ola');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'error', reason });
    expect(client.getState()).toEqual({ status: 'error', action: 'join', reason, message: messageFor(reason) });
    expect(socket().closedWith).toBe(1000);
  });

  it('brak adresu: od razu błąd no-url, bez socketu', () => {
    const { client, sockets } = setup('');
    client.create('Ala');
    expect(client.getState()).toMatchObject({ status: 'error', reason: 'no-url' });
    expect(sockets).toHaveLength(0);
  });

  it('przekroczony czas łączenia (zimny start): błąd timeout, socket zamknięty', () => {
    const { client, socket } = setup();
    client.create('Ala');
    jest.advanceTimersByTime(999);
    expect(client.getState().status).toBe('connecting');
    jest.advanceTimersByTime(1);
    expect(client.getState()).toMatchObject({ status: 'error', action: 'create', reason: 'timeout' });
    expect(socket().closedWith).toBe(1000);
  });

  it('timeout nie działa po wejściu do pokoju', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    jest.advanceTimersByTime(10_000);
    expect(client.getState().status).toBe('in-room');
  });

  it('serwer niedostępny (zamknięcie przed wejściem): błąd network', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().drop(1006);
    expect(client.getState()).toMatchObject({ status: 'error', action: 'create', reason: 'network' });
  });

  it('zerwane połączenie w pokoju: błąd dropped bez akcji', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    socket().drop(1006);
    expect(client.getState()).toMatchObject({ status: 'error', action: null, reason: 'dropped' });
  });

  it('kod 1001 w pokoju: komunikat o restarcie serwera', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    socket().drop(1001);
    expect(client.getState()).toMatchObject({ status: 'error', reason: 'server-restart' });
  });

  it('leave w pokoju: wysyła leave, zamyka socket, stan idle', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    client.leave();
    expect(socket().lastSent()).toEqual({ type: 'leave' });
    expect(socket().closedWith).toBe(1000);
    expect(client.getState()).toEqual({ status: 'idle' });
  });

  it('leave w trakcie łączenia: spóźnione wiadomości nie zmieniają stanu', () => {
    const { client, socket, states } = setup();
    client.create('Ala');
    const old = socket();
    client.leave();
    old.receive({ type: 'room', room: ROOM, youId: 'p1' });
    old.drop();
    jest.advanceTimersByTime(5000);
    expect(client.getState()).toEqual({ status: 'idle' });
    expect(states).toEqual(['connecting', 'idle']);
  });

  it('leave bez połączenia nic nie robi (bez powiadomień)', () => {
    const { client, states } = setup();
    client.leave();
    client.leave();
    expect(states).toEqual([]);
  });

  it('nowa próba zamyka poprzednie połączenie', () => {
    const { client, sockets } = setup();
    client.join('ABCDE', 'Ola');
    client.join('FGHJK', 'Ola');
    expect(sockets).toHaveLength(2);
    expect(sockets[0].closedWith).toBe(1000);
    sockets[0].receive({ type: 'room', room: ROOM, youId: 'p1' });
    expect(client.getState()).toEqual({ status: 'connecting', action: 'join' });
  });

  it('nieznana albo zła wiadomość serwera: warn, stan bez zmian', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive('nie json');
    socket().receive({ type: 'room', room: { code: 'ABCDE' }, youId: 'p1' });
    socket().receive({ type: 'nowość' });
    expect(client.getState().status).toBe('connecting');
    expect(getLogEntries().filter((e) => e.level === 'warn' && e.message === 'Nieznana wiadomość od serwera')).toHaveLength(3);
  });

  it('błąd od serwera w pokoju nie wyrzuca z pokoju', () => {
    const { client, socket } = setup();
    client.create('Ala');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: ROOM, youId: 'p1' });
    socket().receive({ type: 'error', reason: 'already-in-room' });
    expect(client.getState().status).toBe('in-room');
  });

  it('clearError wraca do idle tylko z błędu', () => {
    const { client, socket } = setup();
    client.create('Ala');
    client.clearError();
    expect(client.getState().status).toBe('connecting');
    socket().drop();
    client.clearError();
    expect(client.getState()).toEqual({ status: 'idle' });
  });

  it('createSocket rzuca (zły adres): błąd network zamiast wyjątku', () => {
    const client = new RoomClient({
      serverUrl: URL,
      createSocket: () => {
        throw new Error('bad url');
      },
    });
    expect(() => client.create('Ala')).not.toThrow();
    expect(client.getState()).toMatchObject({ status: 'error', reason: 'network' });
  });

  it('logi bez nicku', () => {
    const { client, socket } = setup();
    client.create('TajnyNick');
    socket().open();
    socket().receive({ type: 'hello', version: '1' });
    socket().receive({ type: 'room', room: { code: 'ABCDE', players: [{ id: 'p1', nick: 'TajnyNick', host: true }] }, youId: 'p1' });
    const entries = getLogEntries().filter((e) => e.tag === 'multiplayer');
    expect(entries.some((e) => e.message === 'Jestem w pokoju')).toBe(true);
    expect(JSON.stringify(entries)).not.toContain('TajnyNick');
  });

  it('nieznany powód błędu ma ogólny komunikat', () => {
    expect(messageFor('coś-nowego')).toMatch(/Coś poszło nie tak/);
  });
});
