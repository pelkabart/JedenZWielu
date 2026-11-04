/**
 * Testy integracyjne: te same moduły, które składa `usePotatoController` w aplikacji —
 * prawdziwa baza pytań, losowe miejsce gracza, prawdziwe profile botów, sterownik, silnik
 * i logi — na udawanym zegarze Jesta.
 */
import { getLogEntries, resetLog } from '@/lib/log';

import { MAX_QUESTIONS_WITHOUT_HUMAN } from '../potato/bots';
import { PotatoController, type PotatoView } from '../potato/controller/PotatoController';
import { activePlayers } from '../potato/engine';
import { createPotatoSoloGame, HUMAN_ID } from '../potato/solo';
import { QUESTION_BANK } from '../questions';
import { DIFFICULTIES, DIFFICULTY_PRESETS } from '../rules';
import { createRng } from '../rng';
import type { Difficulty } from '../types';

const STEP_MS = 100;
/** Gra, która nie skończy się w 2 godziny udawanego czasu, na pewno utknęła. */
const MAX_GAME_MS = 2 * 60 * 60 * 1000;

type Strategy = 'right' | 'silent';

function newGame(seed: number) {
  const rng = createRng(seed);
  return { rng, game: createPotatoSoloGame({ humanName: 'Ty', questions: QUESTION_BANK, rng }) };
}

function newController(seed: number, difficulty: Difficulty = 'normal') {
  const { rng, game } = newGame(seed);
  return new PotatoController({ game, difficulty, rng });
}

const humanTurn = ({ game, overlay, awaitingPick }: PotatoView) =>
  overlay === null && awaitingPick === null && game.holderId === HUMAN_ID && game.question !== null;

const human = (view: PotatoView) => view.game.players.find((p) => p.id === HUMAN_ID)!;

/** Prowadzi grę jak gracz na telefonie: odpowiada według strategii i wskazuje pierwszego rywala. */
function playUntilFinished(c: PotatoController, strategy: Strategy) {
  c.start();
  for (let elapsed = 0; c.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
    const view = c.getView();
    if (elapsed > MAX_GAME_MS) throw new Error(`Gra utknęła: runda ${view.game.phase}, nakładka ${view.overlay?.kind}`);
    if (view.overlay?.kind === 'round') {
      c.acceptRound();
    } else if (view.awaitingPick) {
      const { chooserId } = view.awaitingPick;
      c.pick(activePlayers(view.game).find((p) => p.id !== chooserId)!.id);
    } else if (strategy === 'right' && humanTurn(view)) {
      c.submitAnswer(view.game.question!.answers[0]);
    } else {
      jest.advanceTimersByTime(STEP_MS);
    }
  }
  return c.getView();
}

const logData = (tag: string, message: string) => getLogEntries({ tag }).filter((e) => e.message === message).map((e) => e.data);

beforeAll(() => {
  // Wpis o załadowaniu bazy powstał przy imporcie, zanim testy zaczęły czyścić bufor.
  expect(getLogEntries({ tag: 'baza-pytan' })).toEqual([
    expect.objectContaining({ level: 'info', message: 'Załadowano bazę pytań', data: { count: QUESTION_BANK.length } }),
  ]);
});

beforeEach(() => {
  jest.useFakeTimers();
  resetLog();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('pełna gra na prawdziwej bazie i botach', () => {
  it.each(DIFFICULTIES)('gracz bez błędów wygrywa na poziomie %s, bez wiszących liczników', (difficulty) => {
    const { game } = playUntilFinished(newController(11, difficulty), 'right');
    expect(game.phase).toBe('finished');
    expect(game.ranking).toHaveLength(5);
    expect(game.ranking?.[0]).toBe(HUMAN_ID);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([5, 6, 7, 8])('gracz, który nie odpowiada, odpada i od razu widzi wyniki (ziarno %i)', (seed) => {
    const view = playUntilFinished(newController(seed), 'silent');
    expect(human(view).eliminated).toBe(true);
    expect(view.game.ranking).toHaveLength(5);
    expect(view.game.ranking?.[0]).not.toBe(HUMAN_ID);
    // Gra nie jest rozegrana do końca: nie ma ostatniego gracza, są jeszcze aktywne boty.
    expect(activePlayers(view.game).length).toBeGreaterThan(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('to samo ziarno daje identyczny przebieg całej gry', () => {
    const run = () => {
      resetLog();
      const { game } = playUntilFinished(newController(42), 'right');
      return { ranking: game.ranking, answers: logData('ziemniak', 'Odpowiedź') };
    };
    const first = run();
    expect(first.answers.length).toBeGreaterThan(20);
    expect(run()).toEqual(first);
  });

  it('każda gra tasuje talię: inna kolejność pytań, te same pytania', () => {
    const decks = [1, 2, 3].map((seed) => newGame(seed).game.deck.map((q) => q.id));
    const bank = QUESTION_BANK.map((q) => q.id).sort();
    for (const deck of decks) expect([...deck].sort()).toEqual(bank);
    expect(new Set(decks.map((deck) => deck.join())).size).toBe(decks.length);
    expect(decks[0]).not.toEqual(QUESTION_BANK.map((q) => q.id));
  });
});

describe('limit pytań bez gracza', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  describe.each(DIFFICULTIES)('poziom %s', (difficulty) => {
    it.each(SEEDS)('boty nie grają między sobą dłużej niż pozwala limit (ziarno %i)', (seed) => {
      const c = newController(seed, difficulty);
      let cursor = c.getView().game.cursor;
      let questions = 0;
      c.subscribe(() => {
        const { game } = c.getView();
        if (game.cursor === cursor) return;
        cursor = game.cursor;
        questions++;
        // Wyjątek: pierwsze pytanie finału należy do zwycięzcy sprintu, także przy serii 2.
        const limit = game.phase === 'duel' ? MAX_QUESTIONS_WITHOUT_HUMAN + 1 : MAX_QUESTIONS_WITHOUT_HUMAN;
        expect(game.questionsWithoutHuman).toBeLessThanOrEqual(limit);
      });
      playUntilFinished(c, 'right');
      expect(questions).toBeGreaterThan(MAX_QUESTIONS_WITHOUT_HUMAN);
    });
  });
});

describe('logi z rozgrywki', () => {
  it('logi rund zgadzają się z przebiegiem gry, a w całej grze nie ma ostrzeżeń ani błędów', () => {
    playUntilFinished(newController(11), 'right');
    expect(logData('ziemniak', 'Runda')).toEqual([{ phase: 'round1' }, { phase: 'round2' }, { phase: 'sprint' }, { phase: 'duel' }]);
    expect(logData('ziemniak', 'Koniec gry')).toHaveLength(1);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('logi nie zawierają całego stanu gry', () => {
    playUntilFinished(newController(11), 'right');
    for (const entry of getLogEntries({ tag: 'ziemniak' })) {
      expect(JSON.stringify(entry.data ?? {}).length).toBeLessThan(200);
    }
  });
});

describe('ruchy gracza w czasie gry', () => {
  /** Przewija grę do pierwszej tury człowieka z biegnącym licznikiem. */
  function untilHumanTurn(c: PotatoController) {
    c.start();
    for (let elapsed = 0; !humanTurn(c.getView()); elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie dostał pytania');
      c.acceptRound();
      jest.advanceTimersByTime(STEP_MS);
    }
  }

  it('podwójne zatwierdzenie odpowiedzi liczy się raz', () => {
    const c = newController(5);
    untilHumanTurn(c);
    const before = human(c.getView()).errors;
    c.submitAnswer('na pewno zla odpowiedz');
    c.submitAnswer('na pewno zla odpowiedz');
    expect(human(c.getView()).errors).toBe(before + 1);
  });

  it('odbicie w ciemno działa raz na grę i oddaje pełny czas rywalowi', () => {
    const c = newController(5);
    untilHumanTurn(c);
    jest.advanceTimersByTime(2000);
    const target = activePlayers(c.getView().game).find((p) => p.id !== HUMAN_ID)!.id;
    c.blindPass(target);
    const view = c.getView();
    expect(view.game.holderId).toBe(target);
    expect(human(view).blindPassUsed).toBe(true);
    expect(view.timerMs).toBe(DIFFICULTY_PRESETS.normal.answerTimeMs);
    expect(view.deadline).toBe(Date.now() + DIFFICULTY_PRESETS.normal.answerTimeMs);
  });

  it('pauza zatrzymuje licznik, a wznowienie daje resztę czasu', () => {
    const c = newController(5);
    untilHumanTurn(c);
    const left = c.getView().deadline! - Date.now() - 1000;
    jest.advanceTimersByTime(1000);
    c.pause();
    jest.advanceTimersByTime(60_000);
    expect(c.getView().overlay).toBeNull();
    c.unpause();
    expect(c.getView().deadline).toBe(Date.now() + left);
    jest.advanceTimersByTime(left);
    expect(c.getView().overlay).toMatchObject({ kind: 'reveal', playerId: HUMAN_ID, text: null });
  });
});

describe('przebieg rund z planszami', () => {
  it.each([1, 2, 3, 4, 5])('gra zaczyna się od gracza i każda runda czeka na zamknięcie planszy (ziarno %i)', (seed) => {
    const c = newController(seed);
    c.start();
    expect(c.getView().game.holderId).toBe(HUMAN_ID);
    const phases: string[] = [];
    for (let elapsed = 0; c.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
      const view = c.getView();
      if (view.overlay?.kind === 'round') {
        phases.push(view.overlay.phase);
        // Plansza stoi bez końca i nic na niej nie biegnie.
        const before = view.game;
        jest.advanceTimersByTime(120_000);
        expect(c.getView().game).toBe(before);
        expect(c.getView().overlay).toBe(view.overlay);
        expect(c.getView().sprintEndsAt).toBeNull();
        c.acceptRound();
        if (view.overlay.phase === 'sprint') expect(c.getView().sprintEndsAt).toBe(Date.now() + 60_000);
      } else if (view.awaitingPick) {
        c.pick(activePlayers(view.game).find((p) => p.id !== HUMAN_ID)!.id);
      } else if (humanTurn(view)) {
        c.submitAnswer(view.game.question!.answers[0]);
      } else {
        jest.advanceTimersByTime(STEP_MS);
      }
    }
    expect(phases).toEqual(['round1', 'round2', 'sprint', 'duel']);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('pauza w każdej chwili gry nie psuje przebiegu i nie zostawia zegarów', () => {
    const c = newController(9);
    c.start();
    let pauses = 0;
    for (let elapsed = 0; c.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
      if (elapsed % 700 === 0) {
        c.pause();
        expect(c.getView().paused).toBe(true);
        const frozen = c.getView();
        jest.advanceTimersByTime(30_000);
        expect(c.getView()).toBe(frozen);
        c.unpause();
        pauses++;
      }
      const view = c.getView();
      if (view.overlay?.kind === 'round') c.acceptRound();
      else if (view.awaitingPick) c.pick(activePlayers(view.game).find((p) => p.id !== HUMAN_ID)!.id);
      else if (humanTurn(view)) c.submitAnswer(view.game.question!.answers[0]);
      else jest.advanceTimersByTime(STEP_MS);
    }
    expect(pauses).toBeGreaterThan(5);
    expect(jest.getTimerCount()).toBe(0);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('gracz, który w finale nie decyduje, nigdy nie dostaje przez to pytania', () => {
    const c = newController(11);
    c.start();
    let timeouts = 0;
    for (let elapsed = 0; c.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
      const view = c.getView();
      if (view.overlay?.kind === 'round') {
        c.acceptRound();
      } else if (view.awaitingPick && view.game.phase === 'duel') {
        jest.advanceTimersByTime(view.timerMs!);
        const after = c.getView();
        expect(after.awaitingPick).toBeNull();
        expect(after.game.holderId).not.toBe(HUMAN_ID);
        timeouts++;
      } else if (view.awaitingPick) {
        c.pick(activePlayers(view.game).find((p) => p.id !== HUMAN_ID)!.id);
      } else if (humanTurn(view)) {
        c.submitAnswer(view.game.question!.answers[0]);
      } else {
        jest.advanceTimersByTime(STEP_MS);
      }
    }
    expect(timeouts).toBeGreaterThan(0);
  });
});
