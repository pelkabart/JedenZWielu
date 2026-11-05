import { getLogEntries, resetLog } from '@/lib/log';

import type { Question } from '../../types';
import { createRng } from '../../rng';
import { activePlayers, createPotatoGame, POTATO, reducePotato, type PotatoState } from '../engine';
import { DEFAULT_POTATO_PACING, DUEL_PICK_TIMEOUT_MS, PICK_TIMEOUT_MS, PotatoController, type PotatoView } from '../controller/PotatoController';

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

/** Udawany zegar: `advance` odpala zaplanowane kroki po kolei, tak jak prawdziwy czas. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  return {
    clock: {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.push({ id, at: now + ms, fn });
        return id;
      },
      clearTimeout: (id: unknown) => {
        timers = timers.filter((t) => t.id !== id);
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        now = due.at;
        due.fn();
      }
      now = end;
    },
  };
}

function started(holderId = 'h', patch: Partial<PotatoState> = {}): PotatoState {
  return { ...reducePotato(createPotatoGame({ players: PLAYERS, deck: DECK }), { type: 'start', holderId }), ...patch };
}

function player(game: PotatoState, id: string) {
  return game.players.find((p) => p.id === id)!;
}

function setup(game: PotatoState = started('h'), pacing = {}) {
  const timers = fakeClock();
  const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(5), clock: timers.clock, pacing });
  return { controller, ...timers };
}

const REVEAL = DEFAULT_POTATO_PACING.revealMs;
const NORMAL_TIME = 5000;

describe('tury człowieka', () => {
  it('start przy gotowym ziemniaku pokazuje turę z licznikiem (normalny: 5 s)', () => {
    const { controller, advance } = setup();
    controller.start();
    expect(controller.getView().deadline).toBe(NORMAL_TIME);
    advance(NORMAL_TIME - 1);
    expect(controller.getView().game.holderId).toBe('h');
  });

  it('poprawna odpowiedź czeka na wskazanie rywala, potem przechodzi dalej', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    // Najpierw wynik, jeszcze bez wskazywania.
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', playerId: 'h', correct: true, text: OK });
    expect(controller.getView().awaitingPick).toBeNull();
    advance(REVEAL);
    expect(controller.getView().overlay).toBeNull();
    expect(controller.getView().awaitingPick).toEqual({ chooserId: 'h', allowSelf: false });
    controller.pick('b2');
    // Po wskazaniu od razu następna tura, bez drugiego wyniku.
    expect(controller.getView().overlay).toBeNull();
    expect(controller.getView().awaitingPick).toBeNull();
    expect(controller.getView().game.holderId).toBe('b2');
    expect(controller.getView().thinkingId).toBe('b2');
  });

  it('nie można wskazać siebie w rundzie 1', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL);
    controller.pick('h');
    expect(controller.getView().awaitingPick).not.toBeNull();
    expect(controller.getView().game.holderId).toBe('h');
  });

  it('błędna odpowiedź kosztuje życie i ziemniak trafia do innego gracza', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(BAD);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', correct: false });
    advance(REVEAL);
    expect(player(controller.getView().game, 'h').lives).toBe(POTATO.lives - 1);
    expect(controller.getView().game.holderId).not.toBeNull();
  });

  it('brak odpowiedzi w czasie liczy się jak błąd', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(NORMAL_TIME);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', text: null, correct: false });
    advance(REVEAL);
    expect(player(controller.getView().game, 'h').lives).toBe(POTATO.lives - 1);
  });

  it('odbicie w ciemno: raz, bez utraty życia', () => {
    const { controller } = setup();
    controller.start();
    controller.blindPass('b1');
    expect(controller.getView().game.holderId).toBe('b1');
    expect(player(controller.getView().game, 'h').lives).toBe(POTATO.lives);
    expect(player(controller.getView().game, 'h').blindPassUsed).toBe(true);
  });
});

describe('limit pytań bez gracza', () => {
  // Stałe losowanie: niskie = bot zna odpowiedź i wskazuje lidera, wysokie = myli się i wskazuje najsłabszego.
  // Życia są tak dobrane, że bez limitu gracz nie dostałby żadnego z tych pytań.
  it.each([
    { name: 'dobrej odpowiedzi bota', roll: 0.01, humanLives: 2, first: 'b3', firstLives: 3 },
    { name: 'błędzie bota', roll: 0.99, humanLives: 3, first: 'b2', firstLives: 1 },
  ])('trzecie pytanie trafia do gracza po $name', ({ roll, humanLives, first, firstLives }) => {
    const timers = fakeClock();
    const lives: Record<string, number> = { h: humanLives, b2: 2 };
    const base = started('b1');
    const controller = new PotatoController({
      game: { ...base, players: base.players.map((p) => ({ ...p, lives: lives[p.id] ?? p.lives })) },
      difficulty: 'normal',
      rng: () => roll,
      clock: timers.clock,
    });
    const holders: (string | null)[] = [];
    let cursor = controller.getView().game.cursor;
    controller.subscribe(() => {
      const { game } = controller.getView();
      if (game.cursor !== cursor) {
        cursor = game.cursor;
        holders.push(game.holderId);
      }
    });
    controller.start();
    for (let i = 0; i < 40 && !holders.includes('h'); i++) timers.advance(500);
    expect(holders).toEqual([first, 'h']);
    expect(player(controller.getView().game, first).lives).toBe(firstLives);
  });
});

describe('błąd, po którym gracz odpada', () => {
  const withHolder = (patch: Partial<PotatoState['players'][number]>, game: Partial<PotatoState> = {}) => {
    const base = started('h', game);
    return { ...base, players: base.players.map((p) => (p.id === 'h' ? { ...p, ...patch } : p)) };
  };

  it.each([
    ['runda 1: ostatnie życie', withHolder({ lives: 1 })],
    ['runda 2: osłona mniejsza niż mnożnik', withHolder({ shield: 2 }, { phase: 'round2', multiplier: 3 })],
    ['finał: ostatnia szansa', withHolder({ lives: 1 }, { phase: 'duel' })],
  ])('%s: odpada od razu i ziemniak nie wraca do niego', (_name, game) => {
    for (let seed = 0; seed < 50; seed++) {
      resetLog();
      const timers = fakeClock();
      const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(seed), clock: timers.clock });
      controller.start();
      controller.submitAnswer(BAD);
      const view = controller.getView();
      expect(view.overlay).toMatchObject({ kind: 'reveal', playerId: 'h', correct: false });
      expect(player(view.game, 'h').eliminated).toBe(true);
      expect(view.game.holderId).not.toBe('h');
      expect(getLogEntries({ minLevel: 'warn' }).filter((e) => e.message === 'Odrzucony ruch')).toEqual([]);
    }
  });

  it('błąd bez odpadnięcia nadal może oddać ziemniaka temu samemu graczowi', () => {
    const holders = new Set<string | null>();
    for (let seed = 0; seed < 50; seed++) {
      const timers = fakeClock();
      const controller = new PotatoController({ game: started('h'), difficulty: 'normal', rng: createRng(seed), clock: timers.clock });
      controller.start();
      controller.submitAnswer(BAD);
      holders.add(controller.getView().game.holderId);
    }
    expect(holders).toContain('h');
  });
});

describe('odpadnięcie człowieka kończy grę', () => {
  const withHuman = (patch: Partial<PotatoState['players'][number]>, game: Partial<PotatoState> = {}) => {
    const base = started('h', game);
    return { ...base, players: base.players.map((p) => (p.id === 'h' ? { ...p, ...patch } : p)) };
  };
  const out = (id: string) => (p: PotatoState['players'][number]) => (p.id === id ? { ...p, eliminated: true, eliminatedAt: 1, lives: 0, shield: 0 } : p);

  it.each([
    ['runda 1', withHuman({ lives: 1 })],
    ['runda 2', withHuman({ shield: 1 }, { phase: 'round2' })],
    ['finał, gdy gra jeszcze dwóch rywali', withHuman({ lives: 1 }, { phase: 'duel', eliminations: 1, players: started().players.map(out('b1')).map(out('b2')) })],
  ])('%s: najpierw wynik, potem od razu wyniki gry, bez nowych zegarów', (_name, game) => {
    const { controller, advance } = setup(game);
    controller.start();
    controller.submitAnswer(BAD);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', playerId: 'h', correct: false });
    advance(REVEAL);
    const view = controller.getView();
    expect(view.overlay).toEqual({ kind: 'finished' });
    expect(view.game.phase).toBe('finished');
    expect(view.game.ranking).toHaveLength(PLAYERS.length);
    // Człowiek zaraz za aktywnymi, a przed tymi, którzy odpadli wcześniej.
    expect(view.game.ranking?.indexOf('h')).toBe(activePlayers(view.game).length);
    expect(view.thinkingId).toBeNull();
    const after = view.game;
    advance(120_000);
    expect(controller.getView().game).toBe(after);
  });

  it('odpadnięcie, po którym zaczynałby się sprint, nie uruchamia zegara sprintu', () => {
    const players = started().players.map(out('b1'));
    const game = withHuman({ shield: 1 }, { phase: 'round2', players });
    const { controller, advance } = setup(game);
    controller.start();
    controller.submitAnswer(BAD);
    advance(REVEAL);
    const view = controller.getView();
    expect(view.overlay).toEqual({ kind: 'finished' });
    expect(view.sprintEndsAt).toBeNull();
    advance(120_000);
    expect(controller.getView().game).toBe(view.game);
  });

  it('odpadnięcie bota nie kończy gry', () => {
    const base = started('b1');
    const game = { ...base, players: base.players.map((p) => (p.id === 'b1' ? { ...p, lives: 1 } : p)) };
    const { controller, advance } = setup(game);
    controller.start();
    for (let t = 0; t < 20_000 && !player(controller.getView().game, 'b1').eliminated && controller.getView().game.holderId === 'b1'; t += 100) advance(100);
    advance(REVEAL);
    expect(controller.getView().overlay?.kind).not.toBe('finished');
  });
});

describe('tury botów', () => {
  it('bot myśli i odpowiada przed czasem gracza', () => {
    const { controller, advance } = setup(started('b1'));
    controller.start();
    expect(controller.getView().thinkingId).toBe('b1');
    expect(controller.getView().overlay).toBeNull();
    // Pierwsza nakładka to odpowiedź tego bota, zanim minie czas gracza.
    let elapsed = 0;
    while (controller.getView().overlay === null && elapsed < NORMAL_TIME) {
      advance(100);
      elapsed += 100;
    }
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', playerId: 'b1' });
    expect(elapsed).toBeLessThanOrEqual(NORMAL_TIME);
  });

  it('człowiek nie może odpowiadać w turze bota', () => {
    const { controller } = setup(started('b1'));
    controller.start();
    controller.submitAnswer(OK);
    expect(controller.getView().overlay).toBeNull();
    expect(controller.getView().awaitingPick).toBeNull();
  });
});

describe('sprint na zegarze', () => {
  it('po upływie czasu sprint kończy się i gracze dostają szanse 3/2/1', () => {
    const game = started('h', {
      phase: 'sprint',
      sprintMsLeft: 3000,
      players: started().players.map((p) => (p.id === 'b1' || p.id === 'b2' ? { ...p, eliminated: true } : p)),
    });
    const { controller, advance } = setup(game);
    controller.start();
    advance(3000);
    const view = controller.getView();
    expect(view.game.phase).toBe('duel');
    expect(view.overlay).toMatchObject({ kind: 'round', phase: 'duel' });
    const lives = activePlayers(controller.getView().game).map((p) => p.lives).sort((a, b) => b - a);
    expect(lives).toEqual([3, 2, 1]);
  });

  it('kara za błąd odejmuje czas od zegara na bieżąco', () => {
    const game = started('h', {
      phase: 'sprint',
      sprintMsLeft: 10000,
      players: started().players.map((p) => (p.id === 'b1' || p.id === 'b2' ? { ...p, eliminated: true } : p)),
    });
    const { controller, advance } = setup(game);
    controller.start();
    advance(1000);
    controller.submitAnswer(BAD);
    expect(controller.getView().game.sprintMsLeft).toBe(10000 - 1000 - POTATO.sprintPenaltyMs);
    advance(REVEAL);
    expect(controller.getView().game.phase).toBe('sprint');
  });
});

describe('pełna gra sterowana zegarem', () => {
  it('człowiek i boty grają do końca, a ranking obejmuje wszystkich', () => {
    const { controller, advance } = setup();
    controller.start();
    for (let step = 0; step < 20000 && controller.getView().overlay?.kind !== 'finished'; step++) {
      advance(100);
      const view: PotatoView = controller.getView();
      if (view.overlay?.kind === 'round') {
        controller.acceptRound();
        continue;
      }
      if (view.awaitingPick) {
        const target = activePlayers(view.game).find((p) => p.id !== view.awaitingPick!.chooserId);
        controller.pick(target!.id);
        continue;
      }
      const humanTurn = view.overlay === null && view.game.holderId === 'h' && view.game.question !== null;
      if (humanTurn) controller.submitAnswer(view.game.cursor % 2 === 0 ? OK : BAD);
    }
    const view = controller.getView();
    expect(view.game.phase).toBe('finished');
    expect(view.overlay).toEqual({ kind: 'finished' });
    expect(view.game.ranking).toHaveLength(PLAYERS.length);
  });
});

describe('limit 10 s na wybór i opcje ABCD', () => {
  it('bez wyboru w 10 s przekazanie idzie do losowego aktywnego rywala', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL);
    expect(controller.getView().deadline).toBe(REVEAL + PICK_TIMEOUT_MS);
    advance(PICK_TIMEOUT_MS);
    const view = controller.getView();
    expect(view.awaitingPick).toBeNull();
    expect(view.game.holderId).not.toBe('h');
    expect(activePlayers(view.game).map((p) => p.id)).toContain(view.game.holderId);
  });

  it('wybór przed upływem 10 s anuluje losowanie', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL + 3000);
    controller.pick('b3');
    expect(controller.getView().game.holderId).toBe('b3');
    // Losowanie już nie zadziała: tura należy do bota wskazanego przez gracza.
    expect(controller.getView().thinkingId).toBe('b3');
    advance(PICK_TIMEOUT_MS);
    const overlay = controller.getView().overlay;
    expect(overlay?.kind === 'reveal' ? overlay.playerId : null).not.toBe('h');
  });

  it('na poziomie Normalny człowiek dostaje cztery opcje ABCD z poprawną odpowiedzią', () => {
    // Pięć pytań o różnych odpowiedziach daje pomyłki tego samego typu.
    const deck = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...question(id), answers: [`odp ${id}`] }));
    const game = reducePotato(createPotatoGame({ players: PLAYERS, deck }), { type: 'start', holderId: 'h' });
    const { controller } = setup(game);
    controller.start();
    const choices = controller.getView().choices;
    expect(choices?.options).toHaveLength(4);
    expect(choices?.options).toContain('odp a');
  });

  it('sprint ma znacznik końca, który przesuwa się o kary', () => {
    const game = started('h', {
      phase: 'sprint',
      sprintMsLeft: 10000,
      players: started().players.map((p) => (p.id === 'b1' || p.id === 'b2' ? { ...p, eliminated: true } : p)),
    });
    const { controller, advance } = setup(game);
    controller.start();
    expect(controller.getView().sprintEndsAt).toBe(10000);
    advance(1000);
    controller.submitAnswer(BAD);
    expect(controller.getView().sprintEndsAt).toBe(1000 + 10000 - 1000 - POTATO.sprintPenaltyMs);
  });
});

describe('pauza i lektor', () => {
  it('pauza zamraża licznik tury, a wznowienie daje resztę czasu', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(2000);
    controller.pause();
    advance(60_000);
    expect(controller.getView().game.holderId).toBe('h');
    expect(controller.getView().overlay).toBeNull();
    controller.unpause();
    advance(NORMAL_TIME - 2000 - 1);
    expect(controller.getView().overlay).toBeNull();
    advance(1);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', text: null });
  });

  it('pauza zamraża sprint: czas nie leci, gdy gra stoi', () => {
    const game = started('h', {
      phase: 'sprint',
      sprintMsLeft: 10000,
      players: started().players.map((p) => (p.id === 'b1' || p.id === 'b2' ? { ...p, eliminated: true } : p)),
    });
    const { controller, advance } = setup(game);
    controller.start();
    advance(1000);
    controller.pause();
    advance(30_000);
    controller.unpause();
    expect(controller.getView().game.phase).toBe('sprint');
    // Start o 0 s, pauza po 1 s (zostaje 9 s), wznowienie po 31 s: koniec sprintu o 40 s.
    expect(controller.getView().sprintEndsAt).toBe(40_000);
    expect(controller.getView().game.sprintMsLeft).toBe(9000);
    // Zegar sprintu rusza od nowa: bez zmian w trakcie pauzy.
    expect(controller.getView().game.phase).toBe('sprint');
  });

  it('odbicie w ciemno w czasie mówienia lektora: pasek gracza znika, a po ciszy rywal ma pełny czas', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(2000);
    // Tak robi lektor: zaczyna mówić, gdy tylko zmienia się posiadacz ziemniaka.
    const off = controller.subscribe(() => {
      if (controller.getView().game.holderId !== 'b1') return;
      off();
      controller.setSpeaking(true);
    });
    controller.blindPass('b1');
    expect(controller.getView().game.holderId).toBe('b1');
    expect(controller.getView().deadline).toBeNull();
    expect(controller.getView().timerMs).toBeNull();
    advance(1000);
    controller.setSpeaking(false);
    expect(controller.getView().deadline).toBe(3000 + NORMAL_TIME);
    expect(controller.getView().timerMs).toBe(NORMAL_TIME);
  });

  it('poprawna odpowiedź w czasie mówienia lektora: pasek odpowiedzi znika, a po ciszy jest pełny czas na wybór', () => {
    const { controller, advance } = setup();
    controller.start();
    advance(2000);
    const off = controller.subscribe(() => {
      if (!controller.getView().awaitingPick) return;
      off();
      controller.setSpeaking(true);
    });
    controller.submitAnswer(OK);
    advance(REVEAL);
    expect(controller.getView().awaitingPick).not.toBeNull();
    expect(controller.getView().deadline).toBeNull();
    expect(controller.getView().timerMs).toBeNull();
    controller.setSpeaking(false);
    expect(controller.getView().deadline).toBe(2000 + REVEAL + PICK_TIMEOUT_MS);
    expect(controller.getView().timerMs).toBe(PICK_TIMEOUT_MS);
  });

  it('licznik nie rusza, dopóki lektor mówi; startuje po ciszy', () => {
    const { controller, advance } = setup();
    controller.setSpeaking(true);
    controller.start();
    expect(controller.getView().deadline).toBeNull();
    advance(NORMAL_TIME * 2);
    expect(controller.getView().overlay).toBeNull();
    controller.setSpeaking(false);
    expect(controller.getView().deadline).toBe(NORMAL_TIME * 2 + NORMAL_TIME);
    advance(NORMAL_TIME);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', text: null });
  });
});

const sprintGame = (sprintMsLeft = 10_000) =>
  started('h', {
    phase: 'sprint',
    sprintMsLeft,
    players: started().players.map((p) => (p.id === 'b1' || p.id === 'b2' ? { ...p, eliminated: true } : p)),
  });

/** Runda 2 przed odpadnięciem bota, po którym zaczyna się sprint. Odpowiada `h`, a `b1` odpadł wcześniej. */
const beforeSprint = () => {
  const base = started('h', { phase: 'round2', eliminations: 1 });
  return { ...base, players: base.players.map((p) => (p.id === 'b1' ? { ...p, eliminated: true, eliminatedAt: 1, lives: 0, shield: 0 } : p.id === 'b2' ? { ...p, shield: 1 } : p)) };
};

/** Gracz odpowiada dobrze i oddaje pytanie `b2`, który myli się na ostatniej osłonie: wchodzimy do sprintu. */
function enterSprint(timers: ReturnType<typeof fakeClock>, controller: PotatoController) {
  controller.start();
  controller.submitAnswer(OK);
  timers.advance(REVEAL);
  controller.pick('b2');
  for (let t = 0; t < 30_000 && controller.getView().game.phase !== 'sprint'; t += 100) timers.advance(100);
  expect(controller.getView().game.phase).toBe('sprint');
}

describe('pierwsza runda', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('pierwsza runda zaczyna się od gracza (ziarno %i)', (seed) => {
    const timers = fakeClock();
    const game = createPotatoGame({ players: [PLAYERS[1], PLAYERS[0], PLAYERS[2]], deck: DECK });
    const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(seed), clock: timers.clock });
    controller.start();
    expect(controller.getView().game.holderId).toBe('h');
    expect(controller.getView().game.questionsWithoutHuman).toBe(0);
  });

  it('gra bez człowieka nadal startuje', () => {
    const timers = fakeClock();
    const game = createPotatoGame({ players: PLAYERS.slice(1), deck: DECK });
    const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(1), clock: timers.clock });
    controller.start();
    expect(controller.getView().game.holderId).not.toBeNull();
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'round1' });
  });
});

describe('plansza rundy', () => {
  const fresh = () => {
    const timers = fakeClock();
    const game = createPotatoGame({ players: PLAYERS, deck: DECK });
    return { ...timers, controller: new PotatoController({ game, difficulty: 'normal', rng: createRng(1), clock: timers.clock }) };
  };

  it('czeka na gracza: bez dotknięcia czas nie biegnie i nie ma żadnego zegara', () => {
    const { controller, advance } = fresh();
    controller.start();
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'round1' });
    advance(600_000);
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'round1' });
    expect(controller.getView().deadline).toBeNull();
    expect(player(controller.getView().game, 'h').errors).toBe(0);
  });

  it('zamknięcie planszy od razu zaczyna turę', () => {
    const { controller } = fresh();
    controller.start();
    controller.acceptRound();
    const view = controller.getView();
    expect(view.overlay).toBeNull();
    expect(view.deadline).toBe(NORMAL_TIME);
  });

  it('drugie dotknięcie nic nie robi', () => {
    const { controller } = fresh();
    controller.start();
    controller.acceptRound();
    const view = controller.getView();
    controller.acceptRound();
    expect(controller.getView()).toBe(view);
  });

  it('można ją zamknąć w trakcie mówienia lektora; licznik czeka na ciszę', () => {
    const { controller, advance } = fresh();
    controller.setSpeaking(true);
    controller.start();
    controller.acceptRound();
    expect(controller.getView().overlay).toBeNull();
    expect(controller.getView().deadline).toBeNull();
    advance(1000);
    controller.setSpeaking(false);
    expect(controller.getView().deadline).toBe(1000 + NORMAL_TIME);
  });

  it('w pauzie nie można jej zamknąć', () => {
    const { controller } = fresh();
    controller.start();
    controller.pause();
    controller.acceptRound();
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'round1' });
    controller.unpause();
    controller.acceptRound();
    expect(controller.getView().overlay).toBeNull();
  });

  it('po stop i start dalej czeka na gracza', () => {
    const { controller, advance } = fresh();
    controller.start();
    controller.stop();
    controller.start();
    advance(60_000);
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'round1' });
    controller.acceptRound();
    expect(controller.getView().overlay).toBeNull();
  });

  it('na planszy widać stan od razu, bez chwili z samym pytaniem', () => {
    const { controller } = fresh();
    const overlays: unknown[] = [];
    controller.subscribe(() => overlays.push(controller.getView().overlay));
    controller.start();
    expect(overlays).not.toContain(null);
  });
});

describe('sprint a plansza', () => {
  it('sprint liczy czas dopiero po zamknięciu planszy', () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: beforeSprint(), difficulty: 'normal', rng: () => 0.99, clock: timers.clock });
    enterSprint(timers, controller);
    // Wynik odpowiedzi kończącej rundę 2: zegar jeszcze stoi.
    expect(controller.getView().sprintEndsAt).toBeNull();
    timers.advance(REVEAL);
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'sprint' });
    timers.advance(600_000);
    expect(controller.getView().game.sprintMsLeft).toBe(POTATO.sprintMs);
    expect(controller.getView().sprintEndsAt).toBeNull();

    controller.acceptRound();
    const now = controller.getView().sprintEndsAt! - POTATO.sprintMs;
    expect(controller.getView().sprintEndsAt).toBe(now + POTATO.sprintMs);
    expect(controller.getView().game.sprintMsLeft).toBe(POTATO.sprintMs);
  });

  it('pauza na planszy sprintu nie uruchamia zegara', () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: beforeSprint(), difficulty: 'normal', rng: () => 0.99, clock: timers.clock });
    enterSprint(timers, controller);
    timers.advance(REVEAL);
    controller.pause();
    timers.advance(10_000);
    controller.unpause();
    timers.advance(120_000);
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'sprint' });
    expect(controller.getView().game.sprintMsLeft).toBe(POTATO.sprintMs);
    expect(controller.getView().sprintEndsAt).toBeNull();
  });

  it('wznowienie w czasie wyniku nadal pokazuje planszę nowej rundy', () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: beforeSprint(), difficulty: 'normal', rng: () => 0.99, clock: timers.clock });
    enterSprint(timers, controller);
    expect(controller.getView().overlay?.kind).toBe('reveal');
    controller.stop();
    controller.start();
    timers.advance(REVEAL);
    expect(controller.getView().overlay).toEqual({ kind: 'round', phase: 'sprint' });
    expect(controller.getView().sprintEndsAt).toBeNull();
  });

  it('kara przesuwa koniec sprintu', () => {
    const { controller, advance } = setup(sprintGame(5000));
    controller.start();
    controller.submitAnswer(BAD);
    expect(controller.getView().game.sprintMsLeft).toBe(4000);
    advance(3999);
    expect(controller.getView().game.phase).toBe('sprint');
    advance(1);
    expect(controller.getView().game.phase).toBe('duel');
  });

  it('wskazanie nie cofa paska sprintu', () => {
    const { controller, advance } = setup(sprintGame());
    controller.start();
    controller.submitAnswer(OK);
    const endsAt = controller.getView().sprintEndsAt;
    advance(REVEAL + 500);
    controller.pick('b3');
    expect(controller.getView().sprintEndsAt).toBe(endsAt);
  });

  it('koniec sprintu w czasie wskazywania zalicza punkt', () => {
    const { controller, advance } = setup(sprintGame(3000));
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL);
    expect(controller.getView().awaitingPick).not.toBeNull();
    advance(3000 - REVEAL);
    const view = controller.getView();
    expect(view.game.phase).toBe('duel');
    expect(view.awaitingPick).toBeNull();
    expect(player(view.game, 'h').points).toBe(1);
    // Odpowiedź jest rozliczona: spóźnione wskazanie nic nie zmienia.
    controller.pick('b3');
    expect(controller.getView().game).toBe(view.game);
    expect(getLogEntries({ minLevel: 'warn' }).filter((e) => e.message === 'Odrzucony ruch')).toEqual([]);
  });

  it('koniec sprintu od razu pokazuje planszę, bez chwili z samym pytaniem finału', () => {
    const { controller, advance } = setup(sprintGame(3000));
    controller.start();
    const seen: (string | null)[] = [];
    controller.subscribe(() => {
      const view = controller.getView();
      if (view.game.phase === 'duel') seen.push(view.overlay?.kind ?? null);
    });
    advance(3000);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(null);
  });

  it('odpowiedź spóźniona względem końca sprintu nie liczy się w finale', () => {
    // Zegar przegapił koniec sprintu (np. telefon był zajęty): pierwsza widzi go odpowiedź.
    const timers = fakeClock();
    let late = false;
    const clock = { ...timers.clock, setTimeout: (fn: () => void, ms: number) => timers.clock.setTimeout(() => (late ? undefined : fn()), ms) };
    const controller = new PotatoController({ game: sprintGame(3000), difficulty: 'normal', rng: createRng(1), clock });
    controller.start();
    late = true;
    timers.advance(4000);
    expect(controller.getView().game.phase).toBe('sprint');
    const errors = player(controller.getView().game, 'h').errors;
    controller.submitAnswer(BAD);
    const view = controller.getView();
    expect(view.game.phase).toBe('duel');
    expect(view.overlay).toEqual({ kind: 'round', phase: 'duel' });
    expect(player(view.game, 'h').errors).toBe(errors);
  });
});

describe('finał: decyzja po dobrej odpowiedzi', () => {
  const duel = () => {
    const base = sprintGame();
    return { ...base, phase: 'duel' as const };
  };

  it('finał: 5 s na decyzję, potem losowy rywal, nigdy sam gracz', () => {
    const targets = new Set<string | null>();
    for (let seed = 0; seed < 40; seed++) {
      const timers = fakeClock();
      const controller = new PotatoController({ game: duel(), difficulty: 'normal', rng: createRng(seed), clock: timers.clock });
      controller.start();
      controller.submitAnswer(OK);
      timers.advance(REVEAL);
      expect(controller.getView().timerMs).toBe(DUEL_PICK_TIMEOUT_MS);
      expect(controller.getView().deadline).toBe(REVEAL + DUEL_PICK_TIMEOUT_MS);
      timers.advance(DUEL_PICK_TIMEOUT_MS - 1);
      expect(controller.getView().awaitingPick).not.toBeNull();
      timers.advance(1);
      expect(controller.getView().awaitingPick).toBeNull();
      targets.add(controller.getView().game.holderId);
    }
    expect(targets).not.toContain('h');
    expect(targets).toEqual(new Set(['b3', 'b4']));
  });

  it('finał: „na siebie” nadal działa', () => {
    const { controller, advance } = setup(duel());
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL);
    expect(controller.getView().awaitingPick?.allowSelf).toBe(true);
    controller.pick('h');
    expect(controller.getView().game.holderId).toBe('h');
    expect(player(controller.getView().game, 'h').points).toBe(10);
  });

  it('poza finałem na decyzję jest nadal 10 s', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL);
    expect(controller.getView().timerMs).toBe(PICK_TIMEOUT_MS);
  });
});

describe('pauza z przycisku', () => {
  it('w pauzie sterownik nie przyjmuje ruchów', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.pause();
    const paused = controller.getView();
    controller.submitAnswer(OK);
    controller.blindPass('b1');
    expect(controller.getView()).toBe(paused);
    controller.unpause();
    controller.submitAnswer(OK);
    advance(REVEAL);
    controller.pause();
    const picking = controller.getView();
    controller.pick('b1');
    expect(controller.getView()).toBe(picking);
    expect(picking.awaitingPick).not.toBeNull();
  });

  it('pauza zatrzymuje też licznik wskazywania', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL + 1000);
    controller.pause();
    advance(60_000);
    expect(controller.getView().awaitingPick).not.toBeNull();
    controller.unpause();
    expect(controller.getView().deadline).toBe(REVEAL + 61_000 + PICK_TIMEOUT_MS - 1000);
  });

  it('po końcu gry pauza nic nie robi', () => {
    const game = reducePotato(started('h'), { type: 'endEarly' });
    const { controller } = setup(game);
    controller.start();
    controller.pause();
    expect(controller.getView().paused).toBe(false);
  });

  it('wynik pokazuje pytanie, na które odpowiadano, choć silnik rozdał już następne', () => {
    const { controller } = setup();
    controller.start();
    const answered = controller.getView().game.question!;
    controller.submitAnswer(BAD);
    const view = controller.getView();
    expect(view.game.question).not.toEqual(answered);
    expect(view.overlay).toMatchObject({ kind: 'reveal', question: answered });
  });
});

describe('nagroda od razu po dobrej odpowiedzi', () => {
  const inPhase = (phase: PotatoState['phase']) => started('h', { phase });

  it.each([
    ['sprint', 1],
    ['duel', 10],
  ] as const)('%s: punkt razem z wynikiem, a wskazanie go nie zmienia', (phase, points) => {
    const { controller, advance } = setup(inPhase(phase));
    controller.start();
    controller.submitAnswer(OK);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', correct: true });
    expect(player(controller.getView().game, 'h').points).toBe(points);
    advance(REVEAL);
    expect(player(controller.getView().game, 'h').points).toBe(points);
    controller.pick('b1');
    expect(player(controller.getView().game, 'h').points).toBe(points);
    expect(controller.getView().game.holderId).toBe('b1');
  });

  it('runda 2: mnożnik rośnie razem z wynikiem, a wskazanie go nie zmienia', () => {
    const { controller, advance } = setup(inPhase('round2'));
    controller.start();
    controller.submitAnswer(OK);
    expect(controller.getView().game.multiplier).toBe(2);
    advance(REVEAL);
    controller.pick('b1');
    expect(controller.getView().game.multiplier).toBe(2);
  });

  it('punkt i zielony dymek pojawiają się w jednej aktualizacji widoku', () => {
    const { controller } = setup(inPhase('duel'));
    controller.start();
    const seen: [number, string | null][] = [];
    controller.subscribe(() => {
      const view = controller.getView();
      seen.push([player(view.game, 'h').points, view.overlay?.kind ?? null]);
    });
    controller.submitAnswer(OK);
    expect(seen).not.toContainEqual([0, 'reveal']);
    expect(seen).not.toContainEqual([10, null]);
    expect(seen).toContainEqual([10, 'reveal']);
  });

  it('kolejność: wynik, potem wskazywanie bez wyniku, potem następna tura', () => {
    const { controller, advance } = setup();
    controller.start();
    const steps: string[] = [];
    controller.subscribe(() => {
      const view = controller.getView();
      const step = view.overlay?.kind === 'reveal' ? 'wynik' : view.awaitingPick ? 'wskazywanie' : view.thinkingId ? 'tura bota' : null;
      if (step && steps.at(-1) !== step) steps.push(step);
    });
    controller.submitAnswer(OK);
    advance(REVEAL);
    controller.pick('b1');
    expect(steps).toEqual(['wynik', 'wskazywanie', 'tura bota']);
  });

  it('wynik czeka na lektora; czas na wskazanie rusza dopiero po pochwale', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.setSpeaking(true);
    controller.submitAnswer(OK);
    advance(60_000);
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', correct: true });
    controller.setSpeaking(false);
    advance(REVEAL);
    expect(controller.getView().awaitingPick).not.toBeNull();
  });

  it('wznowienie w czasie wyniku nadal prowadzi do wskazywania', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    controller.stop();
    controller.start();
    advance(REVEAL);
    expect(controller.getView().awaitingPick).not.toBeNull();
    expect(controller.getView().overlay).toBeNull();
  });

  it('koniec sprintu w czasie wyniku zostawia punkt i od razu pokazuje planszę', () => {
    const { controller, advance } = setup(sprintGame(1000));
    controller.start();
    controller.submitAnswer(OK);
    advance(1000);
    const view = controller.getView();
    expect(view.overlay).toEqual({ kind: 'round', phase: 'duel' });
    expect(view.awaitingPick).toBeNull();
    expect(player(view.game, 'h').points).toBe(1);
  });

  it('po czasie na wybór punkty są naliczone raz', () => {
    const { controller, advance } = setup(inPhase('duel'));
    controller.start();
    controller.submitAnswer(OK);
    advance(REVEAL + DUEL_PICK_TIMEOUT_MS);
    expect(player(controller.getView().game, 'h').points).toBe(10);
    expect(controller.getView().game.holderId).not.toBe('h');
  });

  it('błędna odpowiedź nie daje punktu i nie prowadzi do wskazywania', () => {
    const { controller, advance } = setup(inPhase('duel'));
    controller.start();
    controller.submitAnswer(BAD);
    expect(player(controller.getView().game, 'h').points).toBe(0);
    advance(REVEAL);
    expect(controller.getView().awaitingPick).toBeNull();
  });
});
