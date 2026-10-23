import type { Question } from '../../types';
import { pickTarget } from '../bots';
import { activePlayers, createPotatoGame, POTATO, PotatoRuleError, reducePotato, type PotatoState } from '../engine';

const OK = 'ok';
const BAD = 'zle';

function question(id: string): Question {
  return { id, category: 'Historia', question: `pytanie ${id}`, answers: [OK], answerType: 'nazwa', difficulty: 1 };
}

const DECK = [question('a'), question('b'), question('c')];
const PLAYERS = [
  { id: 'h', name: 'Ty', isHuman: true },
  { id: 'b1', name: 'Bot 1', isHuman: false, botId: 'krysia' },
  { id: 'b2', name: 'Bot 2', isHuman: false, botId: 'bartek' },
  { id: 'b3', name: 'Bot 3', isHuman: false, botId: 'profesor' },
  { id: 'b4', name: 'Bot 4', isHuman: false, botId: 'wiesiek' },
];

function started(holderId = 'h'): PotatoState {
  return reducePotato(createPotatoGame({ players: PLAYERS, deck: DECK }), { type: 'start', holderId });
}

function withPlayers(state: PotatoState, patch: Record<string, Partial<PotatoState['players'][number]>>): PotatoState {
  return { ...state, players: state.players.map((p) => ({ ...p, ...patch[p.id] })) };
}

function player(state: PotatoState, id: string) {
  return state.players.find((p) => p.id === id)!;
}

describe('tworzenie gry', () => {
  it('odrzuca za mało graczy, zduplikowane id i brak pytań', () => {
    expect(() => createPotatoGame({ players: PLAYERS.slice(0, 2), deck: DECK })).toThrow(PotatoRuleError);
    expect(() => createPotatoGame({ players: [...PLAYERS, PLAYERS[0]], deck: DECK })).toThrow(PotatoRuleError);
    expect(() => createPotatoGame({ players: PLAYERS, deck: [] })).toThrow(PotatoRuleError);
  });

  it('start daje ziemniaka wskazanemu graczowi i pierwsze pytanie; drugi start jest odrzucany', () => {
    const s = started('b2');
    expect(s.holderId).toBe('b2');
    expect(s.question?.id).toBe('a');
    expect(() => reducePotato(s, { type: 'start', holderId: 'h' })).toThrow('Gra już się zaczęła');
  });
});

describe('runda 1: odsiew', () => {
  it('poprawna odpowiedź przekazuje ziemniaka rywalowi bez utraty życia', () => {
    const s = reducePotato(started(), { type: 'answer', playerId: 'h', text: OK, next: 'b1' });
    expect(s.holderId).toBe('b1');
    expect(s.question?.id).toBe('b');
    expect(player(s, 'h').lives).toBe(POTATO.lives);
  });

  it('nie można przekazać ziemniaka sobie ani nieznanemu graczowi', () => {
    const s = started();
    expect(() => reducePotato(s, { type: 'answer', playerId: 'h', text: OK, next: 'h' })).toThrow(PotatoRuleError);
    expect(() => reducePotato(s, { type: 'answer', playerId: 'h', text: OK, next: 'nikt' })).toThrow(PotatoRuleError);
  });

  it('błędna odpowiedź kosztuje życie i resetuje ziemniaka do wskazanego gracza', () => {
    const s = reducePotato(started(), { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(player(s, 'h').lives).toBe(POTATO.lives - 1);
    expect(s.holderId).toBe('b3');
    expect(s.phase).toBe('round1');
  });

  it('brak odpowiedzi (czas minął) liczy się jak błąd', () => {
    const s = reducePotato(started(), { type: 'answer', playerId: 'h', text: null, next: 'b1' });
    expect(player(s, 'h').lives).toBe(POTATO.lives - 1);
  });

  it('odpadnięcie w rundzie 1 przechodzi do rundy 2 z 4 graczami i 3 punktami osłony', () => {
    const s0 = withPlayers(started(), { h: { lives: 1 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(s.phase).toBe('round2');
    expect(activePlayers(s)).toHaveLength(4);
    expect(player(s, 'h').eliminated).toBe(true);
    expect(s.players.filter((p) => !p.eliminated).every((p) => p.shield === POTATO.shield)).toBe(true);
    expect(s.holderId).toBe('b1');
  });

  it('nie można wskazać odpadniętego po odpadnięciu w rundzie 1', () => {
    const s0 = withPlayers(started(), { h: { lives: 1 }, b1: { eliminated: true } });
    expect(() => reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' })).toThrow('już odpadł');
  });

  it('odbicie w ciemno: raz na gracza, bez utraty życia, nie na siebie', () => {
    const s = reducePotato(started(), { type: 'blindPass', playerId: 'h', targetId: 'b2' });
    expect(s.holderId).toBe('b2');
    expect(player(s, 'h').lives).toBe(POTATO.lives);
    expect(player(s, 'h').blindPassUsed).toBe(true);
    const back = reducePotato(s, { type: 'blindPass', playerId: 'b2', targetId: 'h' });
    expect(back.holderId).toBe('h');
    expect(() => reducePotato(back, { type: 'blindPass', playerId: 'h', targetId: 'b1' })).toThrow('już użył');
    expect(() => reducePotato(started(), { type: 'blindPass', playerId: 'h', targetId: 'h' })).toThrow();
  });
});

describe('runda 2: bomba', () => {
  const round2 = (holder = 'h') => withPlayers({ ...started(holder), phase: 'round2' }, { b4: { eliminated: true } });

  it('poprawne podanie podnosi mnożnik i przekazuje bombę', () => {
    const s = reducePotato(round2(), { type: 'answer', playerId: 'h', text: OK, next: 'b1' });
    expect(s.multiplier).toBe(2);
    expect(s.holderId).toBe('b1');
  });

  it('wybuch odejmuje mnożnik od osłony i resetuje mnożnik do ×1', () => {
    const s0 = { ...round2(), multiplier: 2 };
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(player(s, 'h').shield).toBe(POTATO.shield - 2);
    expect(s.multiplier).toBe(1);
    expect(s.phase).toBe('round2');
  });

  it('odpadający w rundzie 2 nie ma żadnych kropek (osłona i życia na zero)', () => {
    const s0 = withPlayers({ ...round2(), multiplier: 2 }, { h: { shield: 2, lives: 2 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(player(s, 'h')).toMatchObject({ eliminated: true, shield: 0, lives: 0 });
  });

  it('osłona spadająca do 0 odpada; przy 3 graczach zaczyna się sprint', () => {
    const s0 = withPlayers({ ...round2(), multiplier: 2 }, { h: { shield: 2 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(player(s, 'h').eliminated).toBe(true);
    expect(activePlayers(s)).toHaveLength(3);
    expect(s.phase).toBe('sprint');
    expect(s.sprintMsLeft).toBe(POTATO.sprintMs);
    expect(s.holderId).toBe('b1');
  });

});

describe('runda 3: sprint', () => {
  const sprint = (): PotatoState => ({
    ...withPlayers(started('h'), { b1: { eliminated: true }, b2: { eliminated: true } }),
    phase: 'sprint',
    sprintMsLeft: POTATO.sprintMs,
  });

  it('dobra odpowiedź daje punkt i rotuje ziemniak', () => {
    const s = reducePotato(sprint(), { type: 'answer', playerId: 'h', text: OK, next: 'b3' });
    expect(player(s, 'h').points).toBe(1);
    expect(s.holderId).toBe('b3');
  });

  it('błąd kosztuje 1 s, a upływ czasu kończy sprint i przydziela szanse 3/2/1', () => {
    let s = reducePotato(sprint(), { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(s.sprintMsLeft).toBe(POTATO.sprintMs - POTATO.sprintPenaltyMs);
    s = withPlayers(s, { h: { points: 3 }, b3: { points: 5 }, b4: { points: 1 } });
    s = reducePotato(s, { type: 'tick', ms: s.sprintMsLeft });
    expect(s.phase).toBe('duel');
    expect(s.holderId).toBe('b3');
    expect(player(s, 'b3').lives).toBe(3);
    expect(player(s, 'h').lives).toBe(2);
    expect(player(s, 'b4').lives).toBe(1);
  });

  it('remis punktów rozstrzyga mniej błędów, potem miejsce przy stole', () => {
    const s0 = withPlayers(sprint(), { h: { points: 2, errors: 3 }, b3: { points: 2, errors: 1 }, b4: { points: 2, errors: 1 } });
    const s = reducePotato(s0, { type: 'tick', ms: POTATO.sprintMs });
    expect(s.holderId).toBe('b3');
  });

  it('tick poza sprintem i ujemny czas są odrzucane', () => {
    expect(() => reducePotato(started(), { type: 'tick', ms: 1000 })).toThrow('tylko w sprincie');
    expect(() => reducePotato(sprint(), { type: 'tick', ms: -1 })).toThrow('ujemny');
  });
});

describe('runda 4: finałowy krąg', () => {
  const duel = (): PotatoState => ({
    ...withPlayers(started('h'), { b1: { eliminated: true }, b2: { eliminated: true } }),
    phase: 'duel',
  });

  it('poprawna odpowiedź: +1 punkt i +1 szansa dla siebie (max 3), rywale bez zmian', () => {
    const s0 = withPlayers(duel(), { h: { lives: 2, points: 4 }, b3: { lives: 2 }, b4: { lives: 3 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: OK, next: 'b3' });
    expect(player(s, 'h')).toMatchObject({ lives: 3, points: 5 });
    expect(player(s, 'b3').lives).toBe(2);
    expect(player(s, 'b4').lives).toBe(3);
  });

  it('w finale nikt nie traci szans, bo rywal odpowiedział dobrze', () => {
    const s0 = withPlayers(duel(), { h: { lives: 1 }, b3: { lives: 1 }, b4: { lives: 1 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: OK, next: 'b3' });
    expect(activePlayers(s)).toHaveLength(3);
    expect(player(s, 'b4').lives).toBe(1);
  });

  it('„na siebie”: odpowiadający bierze kolejne pytanie', () => {
    const s = reducePotato(duel(), { type: 'answer', playerId: 'h', text: OK, next: 'h' });
    expect(s.holderId).toBe('h');
    expect(s.phase).toBe('duel');
  });

  it('błędy odpadają w finale, a ostatni zostający wygrywa', () => {
    const s0 = withPlayers(duel(), { h: { lives: 1 }, b3: { lives: 1 }, b4: { lives: 1 } });
    const s1 = reducePotato(s0, { type: 'answer', playerId: 'h', text: OK, next: 'b3' });
    const s2 = reducePotato(s1, { type: 'answer', playerId: 'b3', text: BAD, next: 'b4' });
    expect(player(s2, 'b3').eliminated).toBe(true);
    expect(s2.phase).toBe('duel');
    const finished = reducePotato(s2, { type: 'answer', playerId: 'b4', text: BAD, next: 'h' });
    expect(finished.phase).toBe('finished');
    // Zwycięzca pierwszy, potem odpadający: ostatnio odpadły wyżej. Bez daty odpadnięcia (ustawionej w teście) — kolejność przy stole.
    expect(finished.ranking).toEqual(['h', 'b4', 'b3', 'b1', 'b2']);
  });

  it('po zakończeniu gry każda akcja jest odrzucana', () => {
    const finished = { ...duel(), phase: 'finished' as const };
    expect(() => reducePotato(finished, { type: 'answer', playerId: 'h', text: OK, next: 'b3' })).toThrow('zakończona');
  });
});

describe('boty wybierają cel', () => {
  it('zawsze wskazuje aktywnego, innego gracza (albo dowolnego aktywnego przy resecie)', () => {
    const s = withPlayers(started(), { b1: { eliminated: true } });
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const target = pickTarget(s, 'h', rng);
      expect(target).not.toBe('h');
      expect(target).not.toBe('b1');
      expect(activePlayers(s).map((p) => p.id)).toContain(target);
    }
  });

  it('przy losowaniu poniżej 60% wybiera lidera, powyżej rywala o najmniejszym zasobie', () => {
    const s = withPlayers(started(), { b1: { lives: 3 }, b2: { lives: 1 }, b3: { lives: 2 }, b4: { lives: 2 } });
    expect(pickTarget(s, 'h', () => 0.1)).toBe('b1');
    expect(pickTarget(s, 'h', () => 0.9)).toBe('b2');
  });
});

describe('pełna gra zaskryptowana od początku do końca', () => {
  it('kończy się zwycięzcą i rankingiem obejmującym wszystkich graczy', () => {
    let s = started('h');
    let steps = 0;
    while (s.phase !== 'finished') {
      if (++steps > 2000) throw new Error('gra nie kończy się');
      if (s.phase === 'sprint') {
        s = reducePotato(s, { type: 'tick', ms: 10_000 });
        continue;
      }
      const holder = s.holderId!;
      const others = activePlayers(s).filter((p) => p.id !== holder);
      // W finale skrypt zawsze się myli, żeby szanse się wyczerpały; w poprzednich rundach co trzecia odpowiedź jest zła.
      const correct = s.phase === 'duel' ? false : s.cursor % 3 !== 0;
      const next = others[0].id;
      s = reducePotato(s, { type: 'answer', playerId: holder, text: correct ? OK : BAD, next });
    }
    expect(s.ranking).toHaveLength(PLAYERS.length);
    expect(new Set(s.ranking).size).toBe(PLAYERS.length);
    const winner = s.ranking![0];
    expect(player(s, winner).eliminated).toBe(false);
  });
});
