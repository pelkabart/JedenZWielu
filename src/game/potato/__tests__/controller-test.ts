import type { Question } from '../../types';
import { createRng } from '../../rng';
import { activePlayers, createPotatoGame, POTATO, reducePotato, type PotatoState } from '../engine';
import { DEFAULT_POTATO_PACING, PICK_TIMEOUT_MS, PotatoController, type PotatoView } from '../controller/PotatoController';

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
const ROUND = DEFAULT_POTATO_PACING.roundMs;
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
    expect(controller.getView().awaitingPick).toEqual({ chooserId: 'h', allowSelf: false });
    controller.pick('b2');
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', playerId: 'h', correct: true });
    advance(REVEAL);
    expect(controller.getView().game.holderId).toBe('b2');
  });

  it('nie można wskazać siebie w rundzie 1', () => {
    const { controller } = setup();
    controller.start();
    controller.submitAnswer(OK);
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
    advance(ROUND);
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
    expect(controller.getView().deadline).toBe(PICK_TIMEOUT_MS);
    advance(PICK_TIMEOUT_MS);
    const view = controller.getView();
    expect(view.awaitingPick).toBeNull();
    expect(view.overlay).toMatchObject({ kind: 'reveal', playerId: 'h', correct: true });
    advance(REVEAL);
    expect(view.game.holderId).not.toBe('h');
    expect(activePlayers(view.game).map((p) => p.id)).toContain(view.game.holderId);
  });

  it('wybór przed upływem 10 s anuluje losowanie', () => {
    const { controller, advance } = setup();
    controller.start();
    controller.submitAnswer(OK);
    advance(3000);
    controller.pick('b3');
    expect(controller.getView().game.holderId).toBe('b3');
    // Losowanie już nie zadziała: po pokazaniu wyniku tura należy do bota wskazanego przez gracza.
    advance(REVEAL);
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
