/**
 * Testy integracyjne: te same moduły, które składa `useSoloController` w aplikacji —
 * prawdziwa baza pytań, losowe miejsce gracza, prawdziwe profile botów, sterownik, silnik,
 * symulator i logi — na udawanym zegarze Jesta.
 */
import { clearLog, getLogEntries, resetLog } from '@/lib/log';

import { humanTurn, SoloController, type SoloView } from '../controller/SoloController';
import { getPlayer, pickTargets } from '../engine';
import { QUESTION_BANK } from '../questions';
import { DIFFICULTIES } from '../rules';
import { createRng } from '../rng';
import { createSoloGame, HUMAN_ID } from '../solo';
import type { Difficulty, GameEvent } from '../types';

const STEP_MS = 100;
/** Gra, która nie skończy się w 2 godziny udawanego czasu, na pewno utknęła. */
const MAX_GAME_MS = 2 * 60 * 60 * 1000;

type Strategy = 'right' | 'silent';

function newController(seed: number, difficulty: Difficulty = 'normal') {
  const rng = createRng(seed);
  const game = createSoloGame({ difficulty, humanName: 'Ty', questions: QUESTION_BANK, rng });
  return new SoloController({ game, rng, bank: QUESTION_BANK });
}

function correctAnswer(view: SoloView) {
  if (view.game.pending.kind !== 'answer') throw new Error('Brak pytania');
  return view.game.pending.question.answers[0];
}

/** Jak w `SoloGame`: wyniki widać dopiero po zniknięciu wyniku ostatniej odpowiedzi. */
const isResultsScreen = (view: SoloView) => view.game.phase === 'finished' && view.overlay === null;

/**
 * Prowadzi grę jak gracz na telefonie: zamyka plansze etapów, odpowiada według strategii,
 * w finale zgłasza się od razu i bierze pytania na siebie.
 */
function playUntilFinished(c: SoloController, strategy: Strategy) {
  for (let elapsed = 0; !isResultsScreen(c.getView()); elapsed += STEP_MS) {
    const view = c.getView();
    if (elapsed > MAX_GAME_MS) {
      throw new Error(`Gra utknęła: etap ${view.game.phase}, czeka na ${view.game.pending.kind}, nakładka ${view.overlay?.kind}`);
    }
    if (view.overlay?.kind === 'banner') {
      jest.advanceTimersByTime(1000);
      c.skip();
      continue;
    }
    const turn = humanTurn(view);
    if (strategy === 'right' && turn === 'answer') c.submitAnswer(correctAnswer(view));
    else if (strategy === 'right' && turn === 'buzz') c.buzz();
    else if (turn === 'pick') c.pick(pickTargets(view.game, HUMAN_ID)[0].id);
    else if (strategy === 'silent' && getPlayer(view.game, HUMAN_ID).eliminated) c.fastForward();
    else jest.advanceTimersByTime(STEP_MS);
  }
  return c.getView();
}

const phasesFromEvents = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'phase' ? [e.phase] : []));
const messages = (tag: string) => getLogEntries({ tag }).map((e) => e.message);

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
  it.each(DIFFICULTIES)('pełna gra kończy się poprawnie na poziomie %s', (difficulty) => {
    const c = newController(11, difficulty);
    c.start();
    const { game } = playUntilFinished(c, 'right');

    expect(game.ranking).toHaveLength(5);
    expect(new Set(game.ranking)).toEqual(new Set(game.players.map((p) => p.id)));
    // Gracz odpowiadający zawsze dobrze nie traci szans, więc dochodzi do finału.
    expect(getPlayer(game, HUMAN_ID).finalist).toBe(true);
    expect(game.players.filter((p) => p.finalist)).toHaveLength(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('gracz, który nie odpowiada, odpada, a po przewinięciu gra kończy się bez wiszących liczników', () => {
    const c = newController(5);
    c.start();
    const { game } = playUntilFinished(c, 'silent');

    const human = getPlayer(game, HUMAN_ID);
    expect(human.eliminated).toBe(true);
    expect(human.correct).toBe(0);
    expect(game.ranking?.at(-1)).toBe(HUMAN_ID);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('to samo ziarno daje identyczny przebieg całej gry', () => {
    const play = () => {
      const c = newController(42, 'expert');
      c.start();
      return playUntilFinished(c, 'right').game.events;
    };
    const first = play();
    jest.clearAllTimers();
    expect(play()).toEqual(first);
  });
});

describe('logi z rozgrywki', () => {
  it('logi etapów zgadzają się z przebiegiem gry, a w całej grze nie ma ostrzeżeń ani błędów', () => {
    const c = newController(11);
    c.start();
    const { game } = playUntilFinished(c, 'right');

    const loggedPhases = getLogEntries({ tag: 'sterownik' })
      .filter((e) => e.message === 'Etap')
      .map((e) => e.data?.phase);
    // Etap I jest w stanie początkowym gry (sterownik loguje go przy starcie), kolejne — przy zmianie.
    expect(['stage1', ...loggedPhases]).toEqual(phasesFromEvents(game.events));
    expect(messages('sterownik')).toContain('Start rozgrywki');
    expect(messages('sterownik').at(-1)).toBe('Koniec gry');
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('każdy upływ czasu człowieka ma wpis w logach', () => {
    const c = newController(5);
    c.start();
    const { game } = playUntilFinished(c, 'silent');

    const timeouts = game.events.filter((e) => e.type === 'answer' && e.playerId === HUMAN_ID && e.text === null);
    expect(timeouts.length).toBe(game.rules.lives);
    expect(messages('sterownik').filter((m) => m === 'Koniec czasu na odpowiedź')).toHaveLength(timeouts.length);
    expect(messages('sterownik')).toContain('Przewinięcie do wyników');
  });

  it('podwójne zatwierdzenie odpowiedzi liczy się raz i jest zapisane jako zignorowane', () => {
    const c = newController(5);
    c.start();
    for (let elapsed = 0; humanTurn(c.getView()) !== 'answer'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie dostał pytania');
      if (c.getView().overlay?.kind === 'banner') {
        jest.advanceTimersByTime(1000);
        c.skip();
      } else {
        jest.advanceTimersByTime(STEP_MS);
      }
    }
    const answer = correctAnswer(c.getView());
    clearLog();

    c.submitAnswer(answer);
    c.submitAnswer(answer);

    const humanAnswers = c.getView().game.events.filter((e) => e.type === 'answer' && e.playerId === HUMAN_ID);
    expect(humanAnswers).toHaveLength(1);
    expect(getLogEntries({ tag: 'sterownik' })).toContainEqual(
      expect.objectContaining({
        message: 'Zignorowano ruch gracza',
        data: expect.objectContaining({ move: 'answer', overlay: 'reveal' }),
      }),
    );
  });

  it('pauza i wznowienie są zapisane z pozostałym czasem', () => {
    const c = newController(5);
    c.start();
    jest.advanceTimersByTime(1000);
    c.skip(); // plansza etapu I
    jest.advanceTimersByTime(1500); // w trakcie zapowiedzi „Odpowiada: …” (4 s)

    c.pause();
    jest.advanceTimersByTime(60000);
    c.start();

    const entries = getLogEntries({ tag: 'sterownik' });
    const pause = entries.find((e) => e.message === 'Pauza');
    const resume = entries.find((e) => e.message === 'Wznowienie');
    expect(pause?.data).toEqual({ remainingMs: 2500 });
    expect(resume?.data).toEqual({ remainingMs: 2500 });
  });
});
