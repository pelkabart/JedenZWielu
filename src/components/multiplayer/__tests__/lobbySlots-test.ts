import { lobbySlots } from '../lobbySlots';

const players = [
  { id: 'p1', nick: 'ala', host: true },
  { id: 'p2', nick: 'Ola', host: false },
];

it('gracze w kolejności, potem puste miejsca do 5', () => {
  const slots = lobbySlots(players, 'p2', 5);
  expect(slots.map((s) => s.kind)).toEqual(['player', 'player', 'empty', 'empty', 'empty']);
  expect(slots[0]).toMatchObject({ nick: 'ala', initial: 'A', host: true, you: false, label: 'ala (host)' });
  expect(slots[1]).toMatchObject({ nick: 'Ola', host: false, you: true, label: 'Ola (ty)' });
});

it('host, który jest mną, ma obie role w etykiecie', () => {
  expect(lobbySlots(players, 'p1', 5)[0]).toMatchObject({ label: 'ala (host, ty)' });
});

it('klucze są unikalne', () => {
  const ids = lobbySlots(players, 'p1', 5).map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('więcej graczy niż miejsc (niezgodny serwer): bez ujemnej liczby pustych', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, nick: `G${i}`, host: i === 0 }));
  const slots = lobbySlots(many, 'p0', 5);
  expect(slots).toHaveLength(5);
  expect(slots.every((s) => s.kind === 'player')).toBe(true);
});

it('polska litera na początku nicku', () => {
  expect(lobbySlots([{ id: 'p1', nick: 'łukasz', host: true }], 'p1', 1)[0]).toMatchObject({ initial: 'Ł' });
});
