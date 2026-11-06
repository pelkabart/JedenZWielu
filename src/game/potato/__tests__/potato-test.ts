import type { Question } from '../../types';
import { MAX_QUESTIONS_WITHOUT_HUMAN, pickTarget } from '../bots';
import { activePlayers, createPotatoGame, endedEarly, errorEliminates, POTATO, PotatoRuleError, reducePotato, resourceOf, type PotatoState } from '../engine';

const OK = 'ok';
const BAD = 'zle';

function question(id: string): Question {
  return { id, category: 'Historia', question: `pytanie ${id}`, answers: [OK], answerType: 'nazwa', difficulty: 1 };
}

const DECK = [question('a'), question('b'), question('c')];
const PLAYERS = [
  { id: 'h', name: 'Ty', isHuman: true },
  { id: 'b1', name: 'Bot 1', isHuman: false, botId: 'krysia' },
  { id: 'b2', name: 'Bot 2', isHuman: false, botId: 'marek' },
  { id: 'b3', name: 'Bot 3', isHuman: false, botId: 'tadeusz' },
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

describe('endEarly', () => {
  it('kończy grę: aktywni wg stanu gry, potem odpadli od ostatniego', () => {
    const base = reducePotato(createPotatoGame({ players: PLAYERS, deck: DECK }), { type: 'start', holderId: PLAYERS[1].id });
    const [a, b, c, d, e] = PLAYERS.map((p) => p.id);
    const state: PotatoState = {
      ...base,
      phase: 'round2',
      eliminations: 2,
      players: base.players.map((p) => {
        if (p.id === a) return { ...p, eliminated: true, eliminatedAt: 1, lives: 0 };
        if (p.id === b) return { ...p, eliminated: true, eliminatedAt: 2, lives: 0 };
        if (p.id === c) return { ...p, lives: 1 };
        if (p.id === d) return { ...p, lives: 2, shield: true };
        return { ...p, lives: 2 };
      }),
    };
    const finished = reducePotato(state, { type: 'endEarly' });
    expect(finished.phase).toBe('finished');
    expect(finished.holderId).toBeNull();
    expect(finished.question).toBeNull();
    expect(finished.ranking).toEqual([d, e, c, b, a]);
    expect(endedEarly(finished)).toBe(true);
    expect(endedEarly(state)).toBe(false);
  });

  it('remis rozstrzygają mniej błędów, a potem miejsce', () => {
    const base = reducePotato(createPotatoGame({ players: PLAYERS, deck: DECK }), { type: 'start', holderId: PLAYERS[1].id });
    const ids = PLAYERS.map((p) => p.id);
    const state: PotatoState = { ...base, players: base.players.map((p) => (p.id === ids[0] ? { ...p, errors: 2 } : p)) };
    expect(reducePotato(state, { type: 'endEarly' }).ranking).toEqual([ids[1], ids[2], ids[3], ids[4], ids[0]]);
  });
});

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

  it('odpadnięcie w rundzie 1 przechodzi do rundy 2 z 4 graczami, 3 szansami i osłoną', () => {
    const s0 = withPlayers(started(), { h: { lives: 1 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(s.phase).toBe('round2');
    expect(activePlayers(s)).toHaveLength(4);
    expect(player(s, 'h').eliminated).toBe(true);
    expect(activePlayers(s).every((p) => p.lives === POTATO.round2Lives && p.shield)).toBe(true);
    expect(POTATO.round2Lives).toBe(3);
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
  const round2 = (holder = 'h') => {
    const s = withPlayers({ ...started(holder), phase: 'round2' }, { b4: { eliminated: true, lives: 0 } });
    return { ...s, players: s.players.map((p) => (p.eliminated ? p : { ...p, lives: POTATO.round2Lives, shield: true })) };
  };

  it('poprawne podanie podnosi mnożnik i przekazuje bombę', () => {
    const s = reducePotato(round2(), { type: 'answer', playerId: 'h', text: OK, next: 'b1' });
    expect(s.multiplier).toBe(2);
    expect(s.holderId).toBe('b1');
  });

  it('mnożnik zatrzymuje się na ×3 przy obu drogach nagrody', () => {
    const atLimit = { ...round2(), multiplier: POTATO.maxMultiplier };
    expect(POTATO.maxMultiplier).toBe(3);
    expect(reducePotato(atLimit, { type: 'answer', playerId: 'h', text: OK, next: 'b1' }).multiplier).toBe(3);
    expect(reducePotato(atLimit, { type: 'award', playerId: 'h', text: OK }).multiplier).toBe(3);
  });

  it.each([1, 2, 3])('pierwszy błąd przy ×%p zabiera tylko osłonę i wraca do ×1', (multiplier) => {
    const s = reducePotato({ ...round2(), multiplier }, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(player(s, 'h')).toMatchObject({ shield: false, lives: POTATO.round2Lives, eliminated: false });
    expect(s.multiplier).toBe(1);
    expect(s.phase).toBe('round2');
  });

  it('brak odpowiedzi też zabiera osłonę, a nie szanse', () => {
    const s = reducePotato({ ...round2(), multiplier: 3 }, { type: 'answer', playerId: 'h', text: null, next: 'b1' });
    expect(player(s, 'h')).toMatchObject({ shield: false, lives: POTATO.round2Lives });
  });

  it.each([
    [1, 2],
    [2, 1],
  ])('bez osłony błąd przy ×%p zabiera tyle szans (zostaje %p)', (multiplier, left) => {
    const s0 = withPlayers({ ...round2(), multiplier }, { h: { shield: false } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(player(s, 'h')).toMatchObject({ lives: left, shield: false, eliminated: false });
    expect(s.multiplier).toBe(1);
  });

  it('bez osłony błąd przy ×3 zabiera wszystkie 3 szanse: odpadnięcie, przy 3 graczach sprint', () => {
    const s0 = withPlayers({ ...round2(), multiplier: 3 }, { h: { shield: false } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(player(s, 'h')).toMatchObject({ eliminated: true, shield: false, lives: 0 });
    expect(activePlayers(s)).toHaveLength(3);
    expect(s.phase).toBe('sprint');
    expect(s.sprintMsLeft).toBe(POTATO.sprintMs);
    expect(s.holderId).toBe('b1');
  });

  it('szanse z rundy 2 przechodzą do sprintu, a każdy finalista dostaje nową osłonę', () => {
    const s0 = withPlayers({ ...round2(), multiplier: 2 }, { h: { shield: false, lives: 1 }, b1: { lives: 1, shield: false }, b3: { lives: 2 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b1' });
    expect(s.phase).toBe('sprint');
    expect(player(s, 'b1')).toMatchObject({ lives: 1, shield: true });
    expect(player(s, 'b2')).toMatchObject({ lives: 3, shield: true });
    expect(player(s, 'b3')).toMatchObject({ lives: 2, shield: true });
    expect(player(s, 'h')).toMatchObject({ eliminated: true, shield: false });
  });

  it('errorEliminates: z osłoną nigdy, bez osłony gdy szans nie więcej niż mnożnik', () => {
    const s = { ...round2(), multiplier: 3 };
    expect(errorEliminates(s, player(s, 'h'))).toBe(false);
    const bare = withPlayers(s, { h: { shield: false } });
    expect(errorEliminates(bare, player(bare, 'h'))).toBe(true);
    const low = withPlayers({ ...s, multiplier: 2 }, { h: { shield: false } });
    expect(errorEliminates(low, player(low, 'h'))).toBe(false);
  });

  it('resourceOf: osłona liczy się jak jedna szansa więcej', () => {
    const s = withPlayers(round2(), { b1: { shield: false } });
    expect(resourceOf(s, player(s, 'h'))).toBe(4);
    expect(resourceOf(s, player(s, 'b1'))).toBe(3);
  });
});

describe('runda 3: sprint', () => {
  const sprint = (): PotatoState => ({
    ...withPlayers(started('h'), { b1: { eliminated: true }, b2: { eliminated: true } }),
    phase: 'sprint',
    sprintMsLeft: POTATO.sprintMs,
  });

  it('dobra odpowiedź daje 5 punktów i rotuje ziemniak, szanse się nie zmieniają', () => {
    const s0 = withPlayers(sprint(), { h: { lives: 2 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: OK, next: 'b3' });
    expect(POTATO.sprintPoints).toBe(5);
    expect(player(s, 'h')).toMatchObject({ points: 5, lives: 2 });
    expect(s.holderId).toBe('b3');
  });

  it('błąd w sprincie: najpierw zabiera osłonę, potem po jednej szansie; zawsze 1 s', () => {
    const s0 = withPlayers(sprint(), { h: { lives: 2, shield: true } });
    let s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(s.sprintMsLeft).toBe(POTATO.sprintMs - POTATO.sprintPenaltyMs);
    expect(player(s, 'h')).toMatchObject({ lives: 2, shield: false });
    s = reducePotato({ ...s, holderId: 'h' }, { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(s.sprintMsLeft).toBe(POTATO.sprintMs - 2 * POTATO.sprintPenaltyMs);
    expect(player(s, 'h')).toMatchObject({ lives: 1, shield: false, eliminated: false });
    expect(errorEliminates(s, player(s, 'h'))).toBe(false);
  });

  it('brak odpowiedzi w sprincie liczy się jak błąd', () => {
    const s0 = withPlayers(sprint(), { h: { lives: 3, shield: false } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: null, next: 'b3' });
    expect(player(s, 'h').lives).toBe(2);
  });

  it('w sprincie nikt nie odpada: szanse spadają najwyżej do 0, a gracz dalej zbiera punkty', () => {
    let s = withPlayers(sprint(), { h: { lives: 1, shield: false } });
    s = reducePotato(s, { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(player(s, 'h')).toMatchObject({ lives: 0, eliminated: false });
    s = { ...s, holderId: 'h' };
    s = reducePotato(s, { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(player(s, 'h')).toMatchObject({ lives: 0, eliminated: false });
    s = { ...s, holderId: 'h' };
    s = reducePotato(s, { type: 'answer', playerId: 'h', text: s.question!.answers[0], next: 'b3' });
    expect(player(s, 'h').points).toBe(POTATO.sprintPoints);
  });

  it('koniec sprintu: każda szansa to 10 punktów, w finale wszyscy mają 3 szanse, zaczyna lider', () => {
    const s0 = withPlayers(sprint(), {
      h: { points: 15, lives: 2 },
      b3: { points: 20, lives: 0 },
      b4: { points: 5, lives: 3 },
    });
    const s = reducePotato(s0, { type: 'tick', ms: POTATO.sprintMs });
    expect(s.phase).toBe('duel');
    expect(s.lifeBonus).toEqual([
      { playerId: 'h', lives: 2, points: 20 },
      { playerId: 'b3', lives: 0, points: 0 },
      { playerId: 'b4', lives: 3, points: 30 },
    ]);
    expect(player(s, 'h').points).toBe(35);
    expect(player(s, 'b3').points).toBe(20);
    expect(player(s, 'b4').points).toBe(35);
    expect(activePlayers(s).every((p) => p.lives === POTATO.duelLives)).toBe(true);
    // Remis 35:35 rozstrzyga mniej błędów, potem miejsce przy stole.
    expect(s.holderId).toBe('h');
    expect(player(s, 'b1')).toMatchObject({ eliminated: true, points: 0 });
  });

  it('koniec sprintu karą za błąd też dolicza premię', () => {
    const s0 = withPlayers({ ...sprint(), sprintMsLeft: POTATO.sprintPenaltyMs }, { h: { lives: 2, shield: false } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: BAD, next: 'b3' });
    expect(s.phase).toBe('duel');
    // Ostatni błąd zabrał szansę przed liczeniem premii: 2 − 1 = 1.
    expect(s.lifeBonus?.find((b) => b.playerId === 'h')).toEqual({ playerId: 'h', lives: 1, points: 10 });
  });

  it('osłona nie liczy się do premii i znika przed finałem', () => {
    const s0 = withPlayers(sprint(), { h: { lives: 2, shield: true } });
    const s = reducePotato(s0, { type: 'tick', ms: POTATO.sprintMs });
    expect(s.lifeBonus?.find((b) => b.playerId === 'h')).toEqual({ playerId: 'h', lives: 2, points: 20 });
    expect(s.players.every((p) => !p.shield)).toBe(true);
  });

  it('przed końcem sprintu nie ma premii', () => {
    expect(sprint().lifeBonus).toBeNull();
    expect(reducePotato(sprint(), { type: 'tick', ms: 1000 }).lifeBonus).toBeNull();
  });

  it('remis punktów rozstrzyga mniej błędów, potem miejsce przy stole', () => {
    const s0 = withPlayers(sprint(), { h: { points: 2, errors: 3, lives: 1 }, b3: { points: 2, errors: 1, lives: 1 }, b4: { points: 2, errors: 1, lives: 1 } });
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

  it('poprawna odpowiedź w finale daje 10 punktów, bez odzyskiwania szans', () => {
    const s0 = withPlayers(duel(), { h: { lives: 2, points: 4 }, b3: { lives: 2 }, b4: { lives: 3 } });
    const s = reducePotato(s0, { type: 'answer', playerId: 'h', text: OK, next: 'b3' });
    expect(player(s, 'h')).toMatchObject({ lives: 2, points: 14 });
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

  it('przy limicie zawsze wskazuje gracza, bez względu na losowanie i także po błędzie bota', () => {
    const s = { ...started('b1'), questionsWithoutHuman: MAX_QUESTIONS_WITHOUT_HUMAN };
    for (const roll of [0.1, 0.9]) {
      expect(pickTarget(s, 'b1', () => roll)).toBe('h');
      expect(pickTarget(s, null, () => roll)).toBe('h');
    }
  });

  it('poniżej limitu działa zwykły wybór 60/40', () => {
    const base = withPlayers(started('b1'), { h: { lives: 2 }, b2: { lives: 3 }, b3: { lives: 1 }, b4: { lives: 2 } });
    const s = { ...base, questionsWithoutHuman: MAX_QUESTIONS_WITHOUT_HUMAN - 1 };
    expect(pickTarget(s, 'b1', () => 0.9)).toBe('b3');
  });

  it('bez aktywnego gracza limit nie blokuje wyboru', () => {
    const s = { ...withPlayers(started('b1'), { h: { eliminated: true } }), questionsWithoutHuman: 5 };
    const target = pickTarget(s, 'b1', () => 0.5);
    expect(target).not.toBe('h');
    expect(target).not.toBe('b1');
  });
});

describe('licznik pytań bez gracza', () => {
  const pass = (s: PotatoState, next: string) => reducePotato(s, { type: 'answer', playerId: s.holderId!, text: OK, next });

  it('start: bot liczy się jako pierwsze pytanie, człowiek nie', () => {
    expect(started('b1').questionsWithoutHuman).toBe(1);
    expect(started('h').questionsWithoutHuman).toBe(0);
  });

  it('rośnie przy botach i zeruje się, gdy pytanie dostaje gracz', () => {
    const second = pass(started('b1'), 'b2');
    expect(second.questionsWithoutHuman).toBe(2);
    expect(pass(second, 'h').questionsWithoutHuman).toBe(0);
  });

  it('odbicie w ciemno do bota też się liczy', () => {
    expect(reducePotato(started('h'), { type: 'blindPass', playerId: 'h', targetId: 'b1' }).questionsWithoutHuman).toBe(1);
  });

  it('zmiana rundy nie zeruje serii', () => {
    const s = withPlayers(started('b1'), { b1: { lives: 1 } });
    const round2 = reducePotato(s, { type: 'answer', playerId: 'b1', text: BAD, next: 'b2' });
    expect(round2.phase).toBe('round2');
    expect(round2.questionsWithoutHuman).toBe(2);
  });

  it('koniec sprintu nie zeruje serii, więc zwycięzca-bot musi potem wskazać gracza', () => {
    const base = withPlayers(started('b1'), { b3: { eliminated: true }, b4: { eliminated: true }, b1: { points: 5 } });
    const sprint: PotatoState = { ...base, phase: 'sprint', questionsWithoutHuman: 2 };
    const duel = reducePotato(sprint, { type: 'tick', ms: POTATO.sprintMs });
    expect(duel.phase).toBe('duel');
    expect(duel.holderId).toBe('b1');
    expect(duel.questionsWithoutHuman).toBe(3);
    expect(pickTarget(duel, 'b1', () => 0.1)).toBe('h');
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

describe('nagroda przed przekazaniem pytania', () => {
  const inPhase = (phase: PotatoState['phase']): PotatoState => ({ ...started(), phase });

  it.each([
    ['sprint', POTATO.sprintPoints],
    ['duel', POTATO.duelPoints],
  ] as const)('%s: punkty od razu, pytanie zostaje do wskazania', (phase, points) => {
    const before = inPhase(phase);
    const s = reducePotato(before, { type: 'award', playerId: 'h', text: OK });
    expect(player(s, 'h').points).toBe(points);
    expect(s.holderId).toBe('h');
    expect(s.cursor).toBe(before.cursor);
    expect(player(before, 'h').points).toBe(0);
  });

  it('runda 2: mnożnik rośnie od razu', () => {
    expect(reducePotato(inPhase('round2'), { type: 'award', playerId: 'h', text: OK }).multiplier).toBe(2);
  });

  it('runda 1: bez punktów, samo prawo do przekazania', () => {
    const s = reducePotato(started(), { type: 'award', playerId: 'h', text: OK });
    expect(player(s, 'h').points).toBe(0);
    expect(reducePotato(s, { type: 'pass', playerId: 'h', next: 'b1' }).holderId).toBe('b1');
  });

  it.each(['round2', 'sprint', 'duel'] as const)('%s: przekazanie nie nagradza drugi raz', (phase) => {
    const awarded = reducePotato(inPhase(phase), { type: 'award', playerId: 'h', text: OK });
    const s = reducePotato(awarded, { type: 'pass', playerId: 'h', next: 'b1' });
    expect(s.holderId).toBe('b1');
    expect(s.awarded).toBe(false);
    expect(player(s, 'h').points).toBe(player(awarded, 'h').points);
    expect(s.multiplier).toBe(awarded.multiplier);
  });

  it('atomowa odpowiedź daje tę samą nagrodę co award i pass', () => {
    for (const phase of ['round2', 'sprint', 'duel'] as const) {
      const atomic = reducePotato(inPhase(phase), { type: 'answer', playerId: 'h', text: OK, next: 'b1' });
      const split = reducePotato(reducePotato(inPhase(phase), { type: 'award', playerId: 'h', text: OK }), { type: 'pass', playerId: 'h', next: 'b1' });
      expect(split).toEqual(atomic);
    }
  });

  it('nie nagradza błędnej odpowiedzi, cudzej tury ani dwa razy', () => {
    expect(() => reducePotato(inPhase('duel'), { type: 'award', playerId: 'h', text: BAD })).toThrow(PotatoRuleError);
    expect(() => reducePotato(inPhase('duel'), { type: 'award', playerId: 'b1', text: OK })).toThrow(PotatoRuleError);
    const awarded = reducePotato(inPhase('duel'), { type: 'award', playerId: 'h', text: OK });
    expect(() => reducePotato(awarded, { type: 'award', playerId: 'h', text: OK })).toThrow(PotatoRuleError);
    expect(() => reducePotato(awarded, { type: 'answer', playerId: 'h', text: OK, next: 'b1' })).toThrow(PotatoRuleError);
  });

  it('przekazanie wymaga nagrody; na siebie tylko w finale', () => {
    expect(() => reducePotato(inPhase('duel'), { type: 'pass', playerId: 'h', next: 'b1' })).toThrow(PotatoRuleError);
    const inSprint = reducePotato(inPhase('sprint'), { type: 'award', playerId: 'h', text: OK });
    expect(() => reducePotato(inSprint, { type: 'pass', playerId: 'h', next: 'h' })).toThrow(PotatoRuleError);
    const inDuel = reducePotato(inPhase('duel'), { type: 'award', playerId: 'h', text: OK });
    expect(reducePotato(inDuel, { type: 'pass', playerId: 'h', next: 'h' }).holderId).toBe('h');
  });
});
