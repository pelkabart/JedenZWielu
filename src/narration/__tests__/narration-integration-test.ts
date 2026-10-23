/**
 * Testy integracyjne lektora: to samo, co składa `useSoloController` w aplikacji — prawdziwa baza pytań,
 * sterownik z krokiem czytania, silnik, boty i NarrationDirector — na udawanym zegarze Jesta.
 * Jedyna atrapa to sama synteza mowy (zamiast sherpa-onnx): mówi 60 ms na znak.
 * Koniec wypowiedzi przychodzi przez obietnicę (jak z prawdziwej syntezy), więc zegar przesuwamy
 * `advanceTimersByTimeAsync` — wtedy obietnice wykonują się między licznikami, tak jak w aplikacji.
 */
import { humanTurn, SoloController, type SoloView } from '@/game/controller/SoloController';
import { getPlayer, pickTargets } from '@/game/engine';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { DIFFICULTIES } from '@/game/rules';
import { createSoloGame, HUMAN_ID } from '@/game/solo';
import type { Difficulty } from '@/game/types';
import { getLogEntries, resetLog } from '@/lib/log';

import { NarrationDirector } from '../NarrationDirector';
import { FakeVoice } from '../testing/FakeVoice';

const STEP_MS = 100;
const MAX_GAME_MS = 4 * 60 * 60 * 1000;
const MS_PER_CHAR = 60;

/**
 * Gra jak w aplikacji: najpierw start gry (efekt w useSoloController), potem lektor (useNarration).
 * `onSay` widzi każdą wypowiedź w chwili jej rozpoczęcia, razem z widokiem sterownika.
 */
function newGame(seed: number, difficulty: Difficulty = 'normal', onSay?: (texts: string[], view: SoloView) => void) {
  const rng = createRng(seed);
  const game = createSoloGame({ difficulty, humanName: 'Ty', questions: QUESTION_BANK, rng });
  const controller = new SoloController({ game, rng, bank: QUESTION_BANK, readQuestions: true });
  const voice = new FakeVoice(MS_PER_CHAR);
  if (onSay) {
    const say = voice.say.bind(voice);
    voice.say = (texts) => {
      onSay(texts, controller.getView());
      return say(texts);
    };
  }
  controller.start();
  const director = new NarrationDirector(controller, voice);
  return { controller, voice, director };
}

const isResultsScreen = (view: SoloView) => view.game.phase === 'finished' && view.overlay === null;
const QUESTION_TEXTS = new Set(QUESTION_BANK.map((q) => q.question));

const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

/** Jak gracz na telefonie: zamyka plansze, odpowiada dobrze, w finale zgłasza się od razu. */
async function playStep(c: SoloController) {
  const view = c.getView();
  if (view.overlay?.kind === 'banner') {
    await advance(1000);
    c.skip();
    return;
  }
  const turn = humanTurn(view);
  if (turn === 'answer' && view.game.pending.kind === 'answer') c.submitAnswer(view.game.pending.question.answers[0]);
  else if (turn === 'buzz') c.buzz();
  else if (turn === 'pick') c.pick(pickTargets(view.game, HUMAN_ID)[0].id);
  else await advance(STEP_MS);
}

/** Gra do końca; `onStep` widzi stan przed każdym krokiem. */
async function playUntilFinished(c: SoloController, onStep: (view: SoloView) => void = () => {}) {
  for (let elapsed = 0; !isResultsScreen(c.getView()); elapsed += STEP_MS) {
    if (elapsed > MAX_GAME_MS) throw new Error(`Gra utknęła: ${c.getView().game.phase}, nakładka ${c.getView().overlay?.kind}`);
    onStep(c.getView());
    await playStep(c);
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
  it.each(DIFFICULTIES)('gra z lektorem kończy się poprawnie na poziomie %s, bez ostrzeżeń i błędów', async (difficulty) => {
    const { controller, voice } = newGame(11, difficulty);
    const { game } = await playUntilFinished(controller);
    expect(game.ranking).toHaveLength(5);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
    expect(voice.utterances().length).toBeGreaterThan(50);
    // Na ekranie wyników prowadzący dziękuje za grę.
    expect(voice.utterances().at(-1)).toEqual(['Dziękuję za grę!']);
  });

  it('każde zadane pytanie jest czytane dokładnie raz', async () => {
    const { controller, voice } = newGame(11);
    const { game } = await playUntilFinished(controller);

    const asked = game.events.flatMap((e) => (e.type === 'question' ? [e.questionId] : []));
    const byText = new Map(QUESTION_BANK.map((q) => [q.question, q.id]));
    const read = voice.utterances().flatMap((texts) => texts.filter((t) => QUESTION_TEXTS.has(t)).map((t) => byText.get(t)));
    expect(asked.length).toBeGreaterThan(20);
    expect(read).toEqual(asked);
  });

  it('gdy gracz może odpowiadać, pytanie już nie jest czytane', async () => {
    const { controller, voice } = newGame(3);
    let humanMoves = 0;
    await playUntilFinished(controller, (view) => {
      if (humanTurn(view) === 'answer' || humanTurn(view) === 'buzz') {
        humanMoves++;
        const readingQuestion = voice.state === 'speaking' && voice.texts.some((t) => QUESTION_TEXTS.has(t));
        expect(readingQuestion).toBe(false);
      }
    });
    expect(humanMoves).toBeGreaterThan(5);
  });

  it('kwestie przy wynikach, wskazaniach i zapowiedziach nie są ucinane', async () => {
    // Przy każdej wypowiedzi zapamiętujemy, przy jakiej nakładce padła.
    const overlayAt: (string | null)[] = [];
    const { controller, voice } = newGame(7, 'normal', (_texts, view) => overlayAt.push(view.overlay?.kind ?? null));
    await playUntilFinished(controller);

    // Pauzy z czasem (bez planszy etapu — tę gracz sam zamyka dotknięciem, przerywając powitanie).
    const timed = new Set(['reveal', 'noBuzz', 'pick', 'buzz', 'intro', 'reading']);
    const calls = voice.calls;
    let utterance = -1;
    let checked = 0;
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      if (call.action !== 'say') continue;
      utterance++;
      if (!timed.has(overlayAt[utterance] ?? '')) continue;
      // Następne „stop” albo „say” nie może przyjść, zanim wypowiedź się skończy.
      const next = calls.slice(i + 1).find((c) => c.action === 'stop' || c.action === 'say');
      if (!next) continue;
      const fullMs = call.texts.join(' ').length * MS_PER_CHAR;
      expect({ overlay: overlayAt[utterance], cut: next.action === 'stop' && next.at - call.at < fullMs }).toEqual({
        overlay: overlayAt[utterance],
        cut: false,
      });
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('pauza w czasie czytania wycisza lektora; po wznowieniu gra dalej', async () => {
    const { controller, voice } = newGame(5);
    for (let elapsed = 0; controller.getView().overlay?.kind !== 'reading'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Brak czytania');
      await playStep(controller);
    }
    await advance(500);
    controller.pause();
    expect(voice.state).toBe('paused');
    await advance(60000);
    expect(controller.getView().overlay?.kind).toBe('reading');

    controller.start();
    expect(voice.state).toBe('speaking');
    expect(voice.actions().slice(-2)).toEqual(['pause', 'resume']);
    // Czytanie kończy się samo, a gra idzie dalej.
    await advance(120000);
    expect(controller.getView().overlay?.kind).not.toBe('reading');
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('wyjście z gry w trakcie mówienia ucisza lektora', async () => {
    const { controller, voice, director } = newGame(5);
    for (let elapsed = 0; controller.getView().overlay?.kind !== 'reading'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Brak czytania');
      await playStep(controller);
    }
    // Tak sprząta ekran gry przy odmontowaniu (useSoloController + useNarration).
    controller.pause();
    director.dispose();
    expect(voice.actions().slice(-3)).toEqual(['pause', 'stop', 'dispose']);
    expect(voice.state).toBe('disposed');
    await advance(60000);
  });

  it('po przewinięciu gry do wyników prowadzący tylko dziękuje', async () => {
    const { controller, voice } = newGame(5);
    // Gracz nie odpowiada, aż odpadnie.
    for (let elapsed = 0; !getPlayer(controller.getView().game, HUMAN_ID).eliminated; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie odpadł');
      if (controller.getView().overlay?.kind === 'banner') {
        await advance(1000);
        controller.skip();
      } else {
        await advance(STEP_MS);
      }
    }
    controller.fastForward();
    expect(voice.utterances().at(-1)).toEqual(['Dziękuję za grę!']);
    await advance(10000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
