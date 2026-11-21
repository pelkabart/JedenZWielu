import { CODE_ALPHABET, CODE_LENGTH, MAX_PLAYERS, normalizeCode, normalizeNick, RoomRegistry } from '../rooms';

/** Zwraca po kolei podane liczby, potem powtarza ostatnią. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** `codeOf(0)` = "AAAAA", `codeOf(1)` = "BBBBB"; `indexValue(i)` to liczba losowa, która wybiera i-ty znak. */
const codeOf = (index: number) => CODE_ALPHABET[index].repeat(CODE_LENGTH);
const indexValue = (index: number) => (index + 0.5) / CODE_ALPHABET.length;

function fill(registry: RoomRegistry, code: string, count: number) {
  for (let i = 0; i < count; i++) expect(registry.join(code, `Gracz${i}`).ok).toBe(true);
}

describe('normalizeNick', () => {
  it.each([
    ['  Bartek  ', 'Bartek'],
    ['Ala   ma  kota', 'Ala ma kota'],
    ['Żółw', 'Żółw'],
    ['ab', 'ab'],
    ['x'.repeat(16), 'x'.repeat(16)],
    ['a', null],
    ['   ', null],
    ['', null],
    ['x'.repeat(17), null],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeNick(raw)).toBe(expected);
  });
});

describe('normalizeCode', () => {
  it('wielkie litery i bez spacji', () => {
    expect(normalizeCode(' ab c d e ')).toBe('ABCDE');
  });
});

describe('RoomRegistry', () => {
  it('create: kod z alfabetu o długości 5, twórca jest hostem', () => {
    const registry = new RoomRegistry();
    const created = registry.create('Bartek');
    if (!created.ok) throw new Error('create failed');
    expect(created.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`));
    expect(registry.view(created.code)).toEqual({
      code: created.code,
      players: [{ id: created.playerId, nick: 'Bartek', host: true }],
    });
  });

  it('kod nie zawiera mylących znaków 0 O 1 I', () => {
    expect(CODE_ALPHABET).not.toMatch(/[0O1I]/);
  });

  it('kod zajęty: losuje następny', () => {
    const registry = new RoomRegistry({ random: sequence(...Array(5).fill(indexValue(0)), ...Array(5).fill(indexValue(0)), indexValue(1)) });
    const first = registry.create('Ala');
    const second = registry.create('Ola');
    expect(first).toMatchObject({ ok: true, code: codeOf(0) });
    expect(second).toMatchObject({ ok: true, code: codeOf(1) });
  });

  it('generator zawsze trafia w zajęty kod: błąd, nie pętla', () => {
    const registry = new RoomRegistry({ random: () => 0 });
    expect(registry.create('Ala').ok).toBe(true);
    expect(registry.create('Ola')).toEqual({ ok: false, reason: 'internal' });
  });

  it('random() równe 1 nie wychodzi poza alfabet', () => {
    const registry = new RoomRegistry({ random: () => 0.9999999999 });
    expect(registry.create('Ala')).toMatchObject({ ok: true, code: codeOf(CODE_ALPHABET.length - 1) });
  });

  it('join dodaje gracza na koniec listy, host zostaje', () => {
    const registry = new RoomRegistry();
    const host = registry.create('Ala');
    if (!host.ok) throw new Error();
    const guest = registry.join(host.code, 'Ola');
    expect(guest).toMatchObject({ ok: true, code: host.code });
    expect(registry.view(host.code)?.players.map((p) => [p.nick, p.host])).toEqual([
      ['Ala', true],
      ['Ola', false],
    ]);
  });

  it('join akceptuje małe litery i spacje', () => {
    const registry = new RoomRegistry({ random: () => indexValue(2) });
    registry.create('Ala');
    expect(registry.join(` ${codeOf(2).toLowerCase()} `, 'Ola')).toMatchObject({ ok: true, code: codeOf(2) });
  });

  it('nieznany kod: room-not-found', () => {
    expect(new RoomRegistry().join('ZZZZZ', 'Ola')).toEqual({ ok: false, reason: 'room-not-found' });
  });

  it(`szósty gracz dostaje room-full (limit ${MAX_PLAYERS})`, () => {
    const registry = new RoomRegistry();
    const host = registry.create('Host');
    if (!host.ok) throw new Error();
    fill(registry, host.code, MAX_PLAYERS - 1);
    expect(registry.join(host.code, 'Szósty')).toEqual({ ok: false, reason: 'room-full' });
    expect(registry.view(host.code)?.players).toHaveLength(MAX_PLAYERS);
  });

  it('nick zajęty bez względu na wielkość liter i spacje', () => {
    const registry = new RoomRegistry();
    const host = registry.create('Łukasz');
    if (!host.ok) throw new Error();
    expect(registry.join(host.code, '  ŁUKASZ ')).toEqual({ ok: false, reason: 'nick-taken' });
  });

  it.each(['a', '', 'x'.repeat(17)])('nick %j: nick-invalid przy create i join', (nick) => {
    const registry = new RoomRegistry();
    expect(registry.create(nick)).toEqual({ ok: false, reason: 'nick-invalid' });
    const host = registry.create('Ala');
    if (!host.ok) throw new Error();
    expect(registry.join(host.code, nick)).toEqual({ ok: false, reason: 'nick-invalid' });
  });

  it('wyjście hosta przekazuje koronę najdłużej obecnemu', () => {
    const registry = new RoomRegistry();
    const host = registry.create('Ala');
    if (!host.ok) throw new Error();
    registry.join(host.code, 'Ola');
    registry.join(host.code, 'Ela');
    expect(registry.leave(host.playerId)).toEqual({ code: host.code, removed: false });
    expect(registry.view(host.code)?.players.map((p) => [p.nick, p.host])).toEqual([
      ['Ola', true],
      ['Ela', false],
    ]);
  });

  it('pusty pokój znika, a jego kod jest znów wolny', () => {
    const registry = new RoomRegistry({ random: () => 0 });
    const host = registry.create('Ala');
    if (!host.ok) throw new Error();
    expect(registry.leave(host.playerId)).toEqual({ code: host.code, removed: true });
    expect(registry.roomCount()).toBe(0);
    expect(registry.view(host.code)).toBeNull();
    expect(registry.create('Ola')).toMatchObject({ ok: true, code: host.code });
  });

  it('leave nieznanego gracza: null, drugi leave też null', () => {
    const registry = new RoomRegistry();
    expect(registry.leave('p999')).toBeNull();
    const host = registry.create('Ala');
    if (!host.ok) throw new Error();
    registry.leave(host.playerId);
    expect(registry.leave(host.playerId)).toBeNull();
  });

  it('po wyjściu jego nick jest znów wolny', () => {
    const registry = new RoomRegistry();
    const host = registry.create('Ala');
    if (!host.ok) throw new Error();
    const guest = registry.join(host.code, 'Ola');
    if (!guest.ok) throw new Error();
    registry.leave(guest.playerId);
    expect(registry.join(host.code, 'Ola').ok).toBe(true);
  });

  it('limit pokoi: too-many-rooms', () => {
    const registry = new RoomRegistry({ maxRooms: 2 });
    expect(registry.create('Ala').ok).toBe(true);
    expect(registry.create('Ola').ok).toBe(true);
    expect(registry.create('Ela')).toEqual({ ok: false, reason: 'too-many-rooms' });
  });

  it('id graczy są unikalne między pokojami', () => {
    const registry = new RoomRegistry();
    const a = registry.create('Ala');
    const b = registry.create('Ala');
    if (!a.ok || !b.ok) throw new Error();
    expect(a.playerId).not.toBe(b.playerId);
  });
});
