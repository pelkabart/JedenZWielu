/**
 * Testy integracyjne odpowiadania głosem: prawdziwa baza, sterownik z lektorem (PotatoNarrator)
 * i sesja mikrofonu podpięta tak jak w AnswerPanel (odpowiedź → submitAnswer).
 * Atrapy: synteza mowy (FakeVoice, 60 ms na znak) i rozpoznawanie mowy (FakeRecognizer).
 * Mikrofon jest dostępny przy odpowiedzi pisemnej, więc gramy na poziomie Ekspert.
 */
import { PotatoController, type PotatoView } from '@/game/potato/controller/PotatoController';
import { activePlayers } from '@/game/potato/engine';
import { createPotatoSoloGame, HUMAN_ID } from '@/game/potato/solo';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { DIFFICULTY_PRESETS } from '@/game/rules';
import { getLogEntries, resetLog } from '@/lib/log';
import { PotatoNarrator } from '@/narration/PotatoNarrator';
import { FakeVoice } from '@/narration/testing/FakeVoice';

import { FakeRecognizer } from '../testing/FakeRecognizer';
import { VoiceAnswerSession } from '../VoiceAnswerSession';

const STEP_MS = 100;
const MAX_GAME_MS = 4 * 60 * 60 * 1000;
const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

function newGame(seed: number) {
  const rng = createRng(seed);
  const game = createPotatoSoloGame({ humanName: 'Ty', questions: QUESTION_BANK, rng });
  const controller = new PotatoController({ game, difficulty: 'expert', rng });
  new PotatoNarrator(controller, new FakeVoice(60));
  controller.start();
  return controller;
}

/** Tura człowieka po przeczytaniu pytania: licznik już biegnie. */
const humanMayAnswer = ({ game, overlay, awaitingPick, deadline }: PotatoView) =>
  overlay === null && awaitingPick === null && game.holderId === HUMAN_ID && game.question !== null && deadline !== null;

const human = (view: PotatoView) => view.game.players.find((p) => p.id === HUMAN_ID)!;

/** Panel odpowiedzi na jedno pytanie: sesja mikrofonu podpięta jak w AnswerPanel/useVoiceAnswer. */
function answerPanel(controller: PotatoController) {
  const question = controller.getView().game.question!;
  const recognizer = new FakeRecognizer();
  const listening = { now: false };
  const session = new VoiceAnswerSession(recognizer, question, {
    onTranscript: () => {},
    onAnswer: (text) => controller.submitAnswer(text),
    onListening: (on) => {
      listening.now = on;
    },
    onMessage: () => {},
  });
  return { recognizer, session, question, listening };
}

/** Przewija grę do pierwszej tury człowieka; wskazania nie są potrzebne, bo gracz jeszcze nie odpowiadał. */
async function untilHumanMayAnswer(controller: PotatoController) {
  for (let elapsed = 0; !humanMayAnswer(controller.getView()); elapsed += STEP_MS) {
    if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie dostał pytania');
    controller.acceptRound();
    await advance(STEP_MS);
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  resetLog();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('odpowiadanie głosem w pełnej grze', () => {
  it('gracz odpowiada głosem przez całą grę, bez błędów, i wygrywa', async () => {
    const controller = newGame(11);
    let voiceAnswers = 0;
    for (let elapsed = 0; controller.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
      const view = controller.getView();
      if (view.overlay?.kind === 'round') {
        controller.acceptRound();
      } else if (view.awaitingPick) {
        const { chooserId } = view.awaitingPick;
        controller.pick(activePlayers(view.game).find((p) => p.id !== chooserId)!.id);
      } else if (humanMayAnswer(view)) {
        const { recognizer, session, question, listening } = answerPanel(controller);
        await session.start();
        expect(listening.now).toBe(true);
        recognizer.hear(question.answers[0].slice(0, 3));
        await advance(500); // gracz mówi
        recognizer.finish(question.answers[0]);
        session.dispose(); // panel znika po odpowiedzi
        expect(listening.now).toBe(false);
        voiceAnswers++;
      } else {
        await advance(STEP_MS);
      }
    }
    const { game } = controller.getView();
    expect(voiceAnswers).toBeGreaterThan(5);
    expect(human(controller.getView()).errors).toBe(0);
    expect(game.ranking?.[0]).toBe(HUMAN_ID);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('odpowiedź głosem po czasie nie liczy się', async () => {
    const controller = newGame(5);
    await untilHumanMayAnswer(controller);
    const { recognizer, session, question, listening } = answerPanel(controller);
    await session.start();
    const errorsBefore = human(controller.getView()).errors;
    await advance(DIFFICULTY_PRESETS.expert.answerTimeMs);
    // Czas minął: odpowiedź pusta, błąd policzony raz.
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', playerId: HUMAN_ID, text: null });
    recognizer.finish(question.answers[0]);
    expect(human(controller.getView()).errors).toBe(errorsBefore + 1);
    session.dispose();
    expect(listening.now).toBe(false);
  });

  it('pauza gry w czasie słuchania wyłącza mikrofon', async () => {
    const controller = newGame(5);
    await untilHumanMayAnswer(controller);
    const { recognizer, session, listening } = answerPanel(controller);
    await session.start();
    // Jak useVoiceAnswer: pauza gry anuluje słuchanie.
    controller.pause();
    session.cancel();
    expect(recognizer.calls.at(-1)).toBe('abort');
    expect(listening.now).toBe(false);
  });
});
