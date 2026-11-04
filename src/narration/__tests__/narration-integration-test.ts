/**
 * Testy integracyjne lektora: to samo, co składa `usePotatoController` w aplikacji — prawdziwa baza pytań,
 * sterownik, silnik, boty i PotatoNarrator — na udawanym zegarze Jesta.
 * Jedyna atrapa to sama synteza mowy (zamiast sherpa-onnx): mówi 60 ms na znak.
 * Koniec wypowiedzi przychodzi przez obietnicę (jak z prawdziwej syntezy), więc zegar przesuwamy
 * `advanceTimersByTimeAsync` — wtedy obietnice wykonują się między licznikami, tak jak w aplikacji.
 */
import { PotatoController, type PotatoView } from '@/game/potato/controller/PotatoController';
import { activePlayers } from '@/game/potato/engine';
import { createPotatoSoloGame, HUMAN_ID } from '@/game/potato/solo';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { DIFFICULTIES } from '@/game/rules';
import type { Difficulty } from '@/game/types';
import { getLogEntries, resetLog } from '@/lib/log';

import { PotatoNarrator } from '../PotatoNarrator';
import { isQuestion, riseQuestionEnding } from '../questionIntonation';
import { FakeVoice } from '../testing/FakeVoice';
import { pitchHz, toneThenSilence } from '../testing/tone';

const STEP_MS = 100;
const MAX_GAME_MS = 4 * 60 * 60 * 1000;
const MS_PER_CHAR = 60;

/** Gra jak w aplikacji: najpierw lektor, potem start gry (efekt w `usePotatoController`). */
function newGame(seed: number, difficulty: Difficulty = 'normal') {
  const rng = createRng(seed);
  const game = createPotatoSoloGame({ humanName: 'Ty', questions: QUESTION_BANK, rng });
  const controller = new PotatoController({ game, difficulty, rng });
  const voice = new FakeVoice(MS_PER_CHAR);
  const narrator = new PotatoNarrator(controller, voice);
  controller.start();
  return { controller, voice, narrator };
}

const QUESTION_TEXTS = new Set(QUESTION_BANK.map((q) => q.question));
const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

const voiceDone = (view: PotatoView) => !view.speaking;

const humanTurn = ({ game, overlay, awaitingPick }: PotatoView) =>
  overlay === null && awaitingPick === null && game.holderId === HUMAN_ID && game.question !== null;

/** Jak gracz na telefonie: czeka na koniec czytania, odpowiada dobrze i wskazuje pierwszego rywala. */
async function playStep(c: PotatoController, useBlindPass = false) {
  const view = c.getView();
  // Gracz czeka, aż lektor skończy zasady, i dopiero zamyka planszę.
  if (view.overlay?.kind === 'round' && voiceDone(view)) {
    c.acceptRound();
    return;
  }
  if (view.awaitingPick) {
    const { chooserId } = view.awaitingPick;
    c.pick(activePlayers(view.game).find((p) => p.id !== chooserId)!.id);
    return;
  }
  if (humanTurn(view) && view.deadline !== null) {
    const me = view.game.players.find((p) => p.id === HUMAN_ID)!;
    if (useBlindPass && view.game.phase === 'round1' && !me.blindPassUsed) {
      c.blindPass(activePlayers(view.game).find((p) => p.id !== HUMAN_ID)!.id);
      return;
    }
    c.submitAnswer(view.game.question!.answers[0]);
    return;
  }
  await advance(STEP_MS);
}

/** Gra do końca; `onStep` widzi stan przed każdym krokiem, także tuż po ruchu gracza. */
async function playUntilFinished(c: PotatoController, { useBlindPass = false, onStep = (_view: PotatoView) => {} } = {}) {
  for (let elapsed = 0; c.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
    if (elapsed > MAX_GAME_MS) throw new Error(`Gra utknęła: ${c.getView().game.phase}, nakładka ${c.getView().overlay?.kind}`);
    onStep(c.getView());
    await playStep(c, useBlindPass);
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
    expect(voice.utterances().length).toBeGreaterThan(20);
    expect(voice.utterances().at(-1)?.[0]).toBe('Koniec gry!');
  });

  it('żadne pytanie nie jest czytane dwa razy z rzędu', async () => {
    const { controller, voice } = newGame(11);
    await playUntilFinished(controller);

    // Silnik zmienia stan przed nałożeniem nakładki, więc część kwestii jest przerywana w tej samej chwili: tych nie słychać.
    const heard = voice.calls.flatMap((call, i) => {
      if (call.action !== 'say') return [];
      const next = voice.calls[i + 1];
      return next?.action === 'stop' && next.at === call.at ? [] : call.texts.filter((t) => QUESTION_TEXTS.has(t));
    });
    expect(heard.length).toBeGreaterThan(20);
    expect(heard.filter((text, i) => text === heard[i - 1])).toEqual([]);
  });

  it('każde czytane pytanie dostaje intonację pytającą', async () => {
    const { controller, voice } = newGame(11);
    await playUntilFinished(controller);

    // Teksty idą do syntezy osobno; tak samo sherpaVoice decyduje, czy podnieść ton.
    const said = voice.utterances().flat();
    const questions = said.filter((t) => QUESTION_TEXTS.has(t));
    expect(questions.length).toBeGreaterThan(20);
    expect(questions.filter((t) => !isQuestion(t))).toEqual([]);
    // Kwestie prowadzącego bez „?” zostają bez zmian.
    expect(said.filter((t) => !isQuestion(t)).length).toBeGreaterThan(20);

    // Dźwięk pytania (tu: ton 150 Hz i cisza) kończy się wyżej, niż się zaczął.
    const rate = 22000;
    const spoken = riseQuestionEnding(toneThenSilence(rate, 150, 1500, 300), rate);
    const speechEndAt = spoken.length - Math.round(rate * 0.3);
    const start = pitchHz(spoken.slice(0, rate / 10), rate);
    const end = pitchHz(spoken.slice(speechEndAt - rate / 10, speechEndAt), rate);
    expect(end / start).toBeGreaterThan(2 ** (2 / 12));
  });

  it.each(DIFFICULTIES)('gdy lektor mówi, nie biegnie żaden pasek czasu, także po odbiciu w ciemno (%s)', async (difficulty) => {
    const { controller, voice } = newGame(3, difficulty);
    let speakingSteps = 0;
    const { game } = await playUntilFinished(controller, {
      useBlindPass: true,
      onStep: (view) => {
        if (voice.state !== 'speaking') return;
        speakingSteps++;
        expect(view.deadline).toBeNull();
        expect(view.timerMs).toBeNull();
      },
    });
    expect(speakingSteps).toBeGreaterThan(100);
    expect(game.players.find((p) => p.id === HUMAN_ID)?.blindPassUsed).toBe(true);
  });

  it('pominięcie planszy od razu przerywa zasady i czyta pytanie gracza', async () => {
    const { controller, voice, narrator } = newGame(5);
    await advance(300);
    expect(voice.utterances()).toHaveLength(1);
    expect(voice.utterances()[0][0]).toBe('Runda 1 · Odsiew');
    controller.acceptRound();
    expect(voice.utterances().at(-1)?.[0]).toBe('Odpowiadasz Ty!');
    expect(voice.state).toBe('speaking');
    expect(controller.getView().deadline).toBeNull();
    // Licznik rusza dopiero, gdy lektor przeczyta pytanie.
    for (let t = 0; t < 60_000 && controller.getView().speaking; t += STEP_MS) await advance(STEP_MS);
    expect(controller.getView().deadline).not.toBeNull();
    narrator.dispose();
  });

  it('pauza wycisza lektora; po wznowieniu gra idzie dalej', async () => {
    const { controller, voice } = newGame(5);
    await advance(500);
    expect(voice.state).toBe('speaking');
    controller.pause();
    expect(voice.state).toBe('paused');
    await advance(60_000);
    expect(controller.getView().paused).toBe(true);

    controller.unpause();
    expect(voice.state).toBe('speaking');
    expect(voice.actions().slice(-2)).toEqual(['pause', 'resume']);
    await playUntilFinished(controller);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('wyjście z gry w trakcie mówienia ucisza lektora i nie zostawia liczników', async () => {
    const { controller, voice, narrator } = newGame(5);
    await advance(500);
    // Tak sprząta ekran gry przy odmontowaniu (`usePotatoController`).
    controller.stop();
    narrator.dispose();
    expect(voice.actions().slice(-2)).toEqual(['stop', 'dispose']);
    expect(voice.state).toBe('disposed');
    expect(jest.getTimerCount()).toBe(0);
    await advance(60_000);
    expect(getLogEntries({ minLevel: 'error' })).toEqual([]);
  });
});
