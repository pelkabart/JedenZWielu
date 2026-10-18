/**
 * Testy integracyjne lektora: to samo, co składa `useSoloController` w aplikacji — prawdziwa baza pytań,
 * prawdziwe nagrania (katalog z manifestu Pipera), sterownik, silnik, boty i NarrationDirector —
 * na udawanym zegarze Jesta. Jedyna atrapa to odtwarzacz (zamiast `expo-audio`).
 */
import manifest from '@/assets/audio/questions/manifest.json';
import { humanTurn, SoloController, type SoloView } from '@/game/controller/SoloController';
import { getPlayer, pickTargets } from '@/game/engine';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame, HUMAN_ID } from '@/game/solo';
import { getLogEntries, resetLog } from '@/lib/log';

import { NarrationDirector } from '../NarrationDirector';
import { AudioCatalog, NARRATION_TAIL_MS } from '../questionAudio';
import { FakeNarrationPlayer } from '../testing/FakeNarrationPlayer';

const STEP_MS = 100;
const MAX_GAME_MS = 2 * 60 * 60 * 1000;

/**
 * Prawdziwy manifest (teksty i długości z Pipera). W Jeście każdy `require('…mp3')` daje 1,
 * więc pliki numerujemy sami, żeby dało się sprawdzić, które nagranie zagrało.
 */
const QUESTION_IDS = Object.keys(manifest.questions);
const catalog = new AudioCatalog(manifest, Object.fromEntries(QUESTION_IDS.map((id, i) => [id, i + 1])));
const audioOf = (questionId: string) => catalog.audioFor(QUESTION_BANK.find((q) => q.id === questionId)!)!;
const questionIdOf = (source: number) => QUESTION_IDS[source - 1];

function newGame(seed: number) {
  const rng = createRng(seed);
  const game = createSoloGame({ difficulty: 'normal', humanName: 'Ty', questions: QUESTION_BANK, rng });
  // Tak jak w useSoloController / useQuestionNarration, tylko z katalogiem o rozróżnialnych plikach.
  const controller = new SoloController({ game, rng, bank: QUESTION_BANK, narrationMs: (q) => catalog.narrationMs(q) });
  const player = new FakeNarrationPlayer();
  const director = new NarrationDirector(controller, player, catalog);
  return { controller, player, director };
}

const isResultsScreen = (view: SoloView) => view.game.phase === 'finished' && view.overlay === null;

/** Jak gracz na telefonie: zamyka plansze, odpowiada dobrze, w finale zgłasza się od razu. */
function playStep(c: SoloController) {
  const view = c.getView();
  if (view.overlay?.kind === 'banner') {
    jest.advanceTimersByTime(1000);
    c.skip();
    return;
  }
  const turn = humanTurn(view);
  if (turn === 'answer' && view.game.pending.kind === 'answer') c.submitAnswer(view.game.pending.question.answers[0]);
  else if (turn === 'buzz') c.buzz();
  else if (turn === 'pick') c.pick(pickTargets(view.game, HUMAN_ID)[0].id);
  else jest.advanceTimersByTime(STEP_MS);
}

/** Gra do końca; `onStep` widzi stan przed każdym krokiem. */
function playUntilFinished(c: SoloController, onStep: (view: SoloView) => void = () => {}) {
  for (let elapsed = 0; !isResultsScreen(c.getView()); elapsed += STEP_MS) {
    if (elapsed > MAX_GAME_MS) throw new Error(`Gra utknęła: ${c.getView().game.phase}, nakładka ${c.getView().overlay?.kind}`);
    onStep(c.getView());
    playStep(c);
  }
  return c.getView();
}

beforeEach(() => {
  jest.useFakeTimers();
  resetLog();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('lektor w pełnej grze', () => {
  it('każde zadane pytanie jest czytane dokładnie raz, jego własnym nagraniem', () => {
    const { controller, player } = newGame(11);
    controller.start();
    const { game } = playUntilFinished(controller);

    const asked = game.events.flatMap((e) => (e.type === 'question' ? [e.questionId] : []));
    const played = player.calls.flatMap((c) => (c.action === 'play' ? [questionIdOf(c.source)] : []));
    expect(asked.length).toBeGreaterThan(20);
    expect(played).toEqual(asked);
    expect(getPlayer(game, HUMAN_ID).finalist).toBe(true);
  });

  it('gracz może odpowiadać dopiero, gdy lektor skończy', () => {
    const { controller, player } = newGame(3);
    controller.start();
    let humanMoves = 0;
    playUntilFinished(controller, (view) => {
      if (humanTurn(view) === 'answer' || humanTurn(view) === 'buzz') {
        humanMoves++;
        expect(player.state).not.toBe('playing');
      }
    });
    expect(humanMoves).toBeGreaterThan(5);
  });

  it('lektor gra tyle, ile trwa nagranie (+ margines), a potem rusza licznik', () => {
    const { controller, player } = newGame(7);
    controller.start();
    playUntilFinished(controller);

    const calls = player.calls;
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      if (call.action !== 'play') continue;
      const stop = calls[i + 1];
      expect(stop?.action).toBe('stop');
      expect(stop.at - call.at).toBe(audioOf(questionIdOf(call.source)).durationMs + NARRATION_TAIL_MS);
    }
  });

  it('pauza w czasie czytania wycisza lektora i zatrzymuje czytanie; po wznowieniu gra dalej', () => {
    const { controller, player } = newGame(5);
    controller.start();
    for (let elapsed = 0; controller.getView().overlay?.kind !== 'reading'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Brak czytania');
      playStep(controller);
    }
    jest.advanceTimersByTime(500);
    controller.pause();
    expect(player.state).toBe('paused');
    jest.advanceTimersByTime(60000);
    expect(controller.getView().overlay?.kind).toBe('reading');

    controller.start();
    expect(player.state).toBe('playing');
    expect(player.actions()).toEqual(['play', 'pause', 'resume']);
  });

  it('wyjście z gry w trakcie czytania ucisza i zwalnia odtwarzacz', () => {
    const { controller, player, director } = newGame(5);
    controller.start();
    for (let elapsed = 0; player.state !== 'playing'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Lektor nie zaczął czytać');
      playStep(controller);
    }
    // Tak sprząta ekran gry przy odmontowaniu (useSoloController + useQuestionNarration).
    controller.pause();
    director.dispose();
    expect(player.actions().slice(-3)).toEqual(['pause', 'stop', 'dispose']);
    jest.advanceTimersByTime(60000);
    expect(player.state).toBe('disposed');
  });

  it('po przewinięciu gry do wyników lektor milknie', () => {
    const { controller, player } = newGame(5);
    controller.start();
    // Gracz nie odpowiada, aż odpadnie.
    for (let elapsed = 0; !getPlayer(controller.getView().game, HUMAN_ID).eliminated; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie odpadł');
      if (controller.getView().overlay?.kind === 'banner') {
        jest.advanceTimersByTime(1000);
        controller.skip();
      } else {
        jest.advanceTimersByTime(STEP_MS);
      }
    }
    controller.fastForward();
    expect(player.state).not.toBe('playing');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('w całej grze z lektorem nie ma ostrzeżeń ani błędów w logach', () => {
    const { controller } = newGame(11);
    controller.start();
    playUntilFinished(controller);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
    expect(getLogEntries({ tag: 'lektor' }).filter((e) => e.message === 'Lektor czyta pytanie').length).toBeGreaterThan(20);
  });
});
