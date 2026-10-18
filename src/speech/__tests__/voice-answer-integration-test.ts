/**
 * Testy integracyjne odpowiadania głosem: prawdziwa baza, sterownik z lektorem (NarrationDirector)
 * i sesja mikrofonu podpięta tak jak w AnswerPanel (odpowiedź → submitAnswer, słuchanie → setListening).
 * Atrapy: synteza mowy (FakeVoice, 60 ms na znak) i rozpoznawanie mowy (FakeRecognizer).
 */
import { humanTurn, SoloController, type SoloView } from '@/game/controller/SoloController';
import { getPlayer, pickTargets } from '@/game/engine';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame, HUMAN_ID } from '@/game/solo';
import { getLogEntries, resetLog } from '@/lib/log';
import { NarrationDirector } from '@/narration/NarrationDirector';
import { FakeVoice } from '@/narration/testing/FakeVoice';

import { FakeRecognizer } from '../testing/FakeRecognizer';
import { VoiceAnswerSession } from '../VoiceAnswerSession';

const STEP_MS = 100;
const MAX_GAME_MS = 4 * 60 * 60 * 1000;
const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

function newGame(seed: number) {
  const rng = createRng(seed);
  const game = createSoloGame({ difficulty: 'normal', humanName: 'Ty', questions: QUESTION_BANK, rng });
  const controller = new SoloController({ game, rng, bank: QUESTION_BANK, readQuestions: true });
  const voice = new FakeVoice(60);
  controller.start();
  new NarrationDirector(controller, voice);
  return { controller, voice };
}

/** Panel odpowiedzi na jedno pytanie: sesja mikrofonu podpięta jak w AnswerPanel/useVoiceAnswer. */
function answerPanel(controller: SoloController) {
  const view = controller.getView();
  if (view.game.pending.kind !== 'answer') throw new Error('Brak pytania');
  const recognizer = new FakeRecognizer();
  const session = new VoiceAnswerSession(recognizer, view.game.pending.question, {
    onTranscript: () => {},
    onAnswer: (text) => controller.submitAnswer(text),
    onListening: (listening) => controller.setListening(listening),
    onMessage: () => {},
  });
  return { recognizer, session, question: view.game.pending.question };
}

const isResultsScreen = (view: SoloView) => view.game.phase === 'finished' && view.overlay === null;

beforeEach(() => {
  jest.useFakeTimers();
  resetLog();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('odpowiadanie głosem w pełnej grze', () => {
  it('gracz odpowiada głosem przez całą grę; w czasie słuchania lektor milczy', async () => {
    const { controller, voice } = newGame(11);
    let voiceAnswers = 0;
    for (let elapsed = 0; !isResultsScreen(controller.getView()); elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
      const view = controller.getView();
      const turn = humanTurn(view);
      if (view.overlay?.kind === 'banner') {
        await advance(1000);
        controller.skip();
      } else if (turn === 'answer') {
        const { recognizer, session, question } = answerPanel(controller);
        await session.start();
        expect(controller.getView().listening).toBe(true);
        expect(voice.state).not.toBe('speaking');
        recognizer.hear(question.answers[0].slice(0, 3));
        await advance(1500); // gracz mówi
        expect(voice.state).not.toBe('speaking');
        recognizer.finish(question.answers[0]);
        session.dispose(); // panel znika po odpowiedzi
        expect(controller.getView().listening).toBe(false);
        voiceAnswers++;
      } else if (turn === 'buzz') controller.buzz();
      else if (turn === 'pick') controller.pick(pickTargets(view.game, HUMAN_ID)[0].id);
      else await advance(STEP_MS);
    }
    const { game } = controller.getView();
    expect(voiceAnswers).toBeGreaterThan(5);
    // Każda odpowiedź głosem była dobra, więc gracz nie stracił szans i doszedł do finału.
    expect(getPlayer(game, HUMAN_ID).finalist).toBe(true);
    expect(getPlayer(game, HUMAN_ID).wrong).toBe(0);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('odpowiedź głosem po czasie nie liczy się', async () => {
    const { controller } = newGame(5);
    for (let elapsed = 0; humanTurn(controller.getView()) !== 'answer'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie dostał pytania');
      if (controller.getView().overlay?.kind === 'banner') {
        await advance(1000);
        controller.skip();
      } else {
        await advance(STEP_MS);
      }
    }
    const { recognizer, session, question } = answerPanel(controller);
    await session.start();
    await advance(controller.getView().game.rules.answerTimeMs);
    // Czas minął: odpowiedź pusta, szansa stracona.
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', playerId: HUMAN_ID, text: null });
    recognizer.finish(question.answers[0]);
    const answers = controller.getView().game.events.filter((e) => e.type === 'answer' && e.playerId === HUMAN_ID);
    expect(answers).toHaveLength(1);
    expect(getPlayer(controller.getView().game, HUMAN_ID).lives).toBe(2);
    session.dispose();
    expect(controller.getView().listening).toBe(false);
  });

  it('pauza gry w czasie słuchania wyłącza mikrofon', async () => {
    const { controller } = newGame(5);
    for (let elapsed = 0; humanTurn(controller.getView()) !== 'answer'; elapsed += STEP_MS) {
      if (elapsed > MAX_GAME_MS) throw new Error('Gracz nie dostał pytania');
      if (controller.getView().overlay?.kind === 'banner') {
        await advance(1000);
        controller.skip();
      } else {
        await advance(STEP_MS);
      }
    }
    const { recognizer, session } = answerPanel(controller);
    await session.start();
    // Jak useVoiceAnswer: pauza gry anuluje słuchanie.
    controller.pause();
    session.cancel();
    expect(recognizer.calls.at(-1)).toBe('abort');
    expect(controller.getView().listening).toBe(false);
  });
});
