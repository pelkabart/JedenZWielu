import type { PotatoPlayer, PotatoState } from '@/game/potato/engine';

import { SCOREBOARD_CHROME_HEIGHT, scoreboardHeadline, scoreboardNote, scoreboardRowHeight, scoreboardRows } from '../scoreboardData';

const player = (id: string, seat: number, over: Partial<PotatoPlayer> = {}): PotatoPlayer => ({
  id,
  name: id.toUpperCase(),
  isHuman: id === 'h',
  seat,
  lives: 0,
  shield: 0,
  points: 0,
  errors: 0,
  eliminated: true,
  eliminatedAt: seat + 1,
  blindPassUsed: false,
  ...over,
});

const finished = (players: PotatoPlayer[], ranking: string[]): PotatoState => ({
  phase: 'finished',
  players,
  holderId: null,
  question: null,
  deck: [],
  cursor: 0,
  multiplier: 1,
  sprintMsLeft: 0,
  eliminations: 0,
  ranking,
  questionsWithoutHuman: 0,
  awarded: false,
});

describe('wiersze tabeli', () => {
  const game = finished(
    [player('h', 0, { points: 21, errors: 1 }), player('a', 1, { eliminated: false, points: 12 }), player('b', 2, { points: 43, errors: 2 })],
    ['a', 'b', 'h'],
  );

  it('kolejność idzie za rankingiem, a nie za punktami', () => {
    expect(scoreboardRows(game).map((r) => [r.place, r.id, r.points])).toEqual([
      [1, 'a', 12],
      [2, 'b', 43],
      [3, 'h', 21],
    ]);
  });

  it('zwycięzca jest tylko jeden', () => {
    expect(scoreboardRows(game).filter((r) => r.winner).map((r) => r.id)).toEqual(['a']);
  });

  it('pomija nieznane id i numeruje miejsca bez dziur', () => {
    const rows = scoreboardRows({ ...game, ranking: ['a', 'duch', 'b', 'h'] });
    expect(rows.map((r) => r.place)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'h']);
  });

  it('bez rankingu tabela jest pusta, a nagłówek nikogo nie wskazuje', () => {
    const empty = { ...game, ranking: null };
    expect(scoreboardRows(empty)).toEqual([]);
    expect(scoreboardHeadline(empty)).toMatchObject({ heroId: null, won: false });
  });
});

describe('nagłówek i uwaga', () => {
  it('człowiek wygrywa: wskazuje jego postać i punkty', () => {
    const game = finished([player('h', 0, { eliminated: false, points: 30 }), player('a', 1), player('b', 2)], ['h', 'a', 'b']);
    expect(scoreboardHeadline(game)).toEqual({ title: 'Wygrywasz!', subtitle: '30 pkt', heroId: 'h', won: true });
    expect(scoreboardNote(game)).toBeNull();
  });

  it('wygrywa bot: podaje jego imię', () => {
    const game = finished([player('h', 0), player('a', 1, { eliminated: false }), player('b', 2)], ['a', 'h', 'b']);
    expect(scoreboardHeadline(game).title).toBe('Wygrywa A');
  });

  it('wyjaśnia, gdy zwycięzca ma mniej punktów', () => {
    const game = finished([player('h', 0, { points: 20 }), player('a', 1, { eliminated: false, points: 10 }), player('b', 2)], ['a', 'h', 'b']);
    expect(scoreboardNote(game)).toContain('najdłużej');
  });

  it('gra przerwana: bez zwycięzcy, z miejscem gracza', () => {
    const game = finished(
      [player('h', 0), player('a', 1, { eliminated: false, eliminatedAt: null }), player('b', 2, { eliminated: false, eliminatedAt: null })],
      ['a', 'b', 'h'],
    );
    expect(scoreboardRows(game).some((r) => r.winner)).toBe(false);
    expect(scoreboardHeadline(game)).toEqual({ title: 'Odpadasz!', subtitle: 'Miejsce 3 z 3', heroId: 'h', won: false });
    expect(scoreboardNote(game)).toContain('odpadnięcia');
  });
});

describe('wysokość wierszy', () => {
  it('wiersze mieszczą się na niskim ekranie', () => {
    const available = 344;
    expect(scoreboardRowHeight(available, 5) * 5 + SCOREBOARD_CHROME_HEIGHT).toBeLessThanOrEqual(available);
  });

  it('na dużym ekranie wiersz nie rośnie bez końca, a na bardzo małym nie znika', () => {
    expect(scoreboardRowHeight(1000, 5)).toBe(46);
    expect(scoreboardRowHeight(100, 5)).toBe(30);
  });
});
