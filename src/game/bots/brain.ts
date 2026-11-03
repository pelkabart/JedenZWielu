import { isCorrectAnswer } from '../answers';
import { nearbyNumber } from '../choices';
import { DIFFICULTY_PRESETS } from '../rules';
import { gaussian, pickRandom, type Rng } from '../rng';
import type { AnswerFormat, Difficulty, Question, QuestionDifficulty, Rules } from '../types';
import type { BotProfile } from './profiles';

export interface BotContext {
  profile: BotProfile;
  difficulty: Difficulty;
  rng: Rng;
  /** Pula, z której bot bierze "pomyłki" (odpowiedzi z innych pytań tej samej kategorii). */
  bank?: Question[];
}

export interface BotAnswer {
  /** `null` = bot nie zdążył odpowiedzieć. */
  text: string | null;
  delayMs: number;
}

const QUESTION_DIFFICULTY_MODIFIER: Record<QuestionDifficulty, number> = { 1: 0.12, 2: 0, 3: -0.15 };
/** Czas decyzji wg formatu odpowiedzi (PDF „Quiz Frenzy”: rozkład Gaussa wokół 1,5 s dla ABCD i 3,5 s dla pisemnego). */
export const DECISION_TIME: Record<AnswerFormat, { mean: number; sd: number; min: number; max: number }> = {
  choice: { mean: 1500, sd: 350, min: 1000, max: 2500 },
  text: { mean: 3500, sd: 800, min: 2000, max: 5000 },
};
const TIMEOUT_CHANCE_WHEN_UNSURE = 0.3;

export function correctChance(profile: BotProfile, question: Question, difficulty: Difficulty): number {
  const p =
    profile.knowledge +
    (profile.categoryBonus[question.category] ?? 0) +
    DIFFICULTY_PRESETS[difficulty].knowledgeOffset +
    QUESTION_DIFFICULTY_MODIFIER[question.difficulty];
  return Math.min(0.97, Math.max(0.05, p));
}

/** Czas decyzji bota: rozkład Gaussa dla formatu poziomu, przycięty do zakresu i pomnożony przez tempo poziomu. */
function decisionDelay(ctx: BotContext, latest: number): number {
  const preset = DIFFICULTY_PRESETS[ctx.difficulty];
  const { mean, sd, min, max } = DECISION_TIME[preset.answerFormat];
  const base = Math.min(max, Math.max(min, gaussian(ctx.rng, mean, sd)));
  return Math.min(latest, Math.round(base * preset.speedFactor));
}

/**
 * Pomyłka tego samego rodzaju co poprawna odpowiedź. Kolejność:
 * własne `wrongAnswers` pytania → dla dat i liczb liczba obok poprawnej →
 * odpowiedź z innego pytania tego samego typu (najpierw z tej samej kategorii).
 */
export function wrongAnswer(ctx: BotContext, question: Question): string | null {
  const notCorrect = (a: string) => !isCorrectAnswer(a, question.answers);

  const own = (question.wrongAnswers ?? []).filter(notCorrect);
  if (own.length > 0) return pickRandom(ctx.rng, own);

  if (question.answerType === 'data' || question.answerType === 'liczba') return nearbyNumber(ctx.rng, question);

  const sameType = (ctx.bank ?? []).filter((q) => q.id !== question.id && q.answerType === question.answerType);
  const sameCategory = sameType.filter((q) => q.category === question.category);
  for (const pool of [sameCategory, sameType]) {
    const candidates = pool.map((q) => q.answers[0]).filter(notCorrect);
    if (candidates.length > 0) return pickRandom(ctx.rng, candidates);
  }
  return null;
}

/** `knows` narzuca, czy bot zna odpowiedź; bez niego decyduje losowanie wg `correctChance`. */
export function decideAnswer(ctx: BotContext, question: Question, rules: Rules, knows?: boolean): BotAnswer {
  const willKnow = knows ?? ctx.rng() < correctChance(ctx.profile, question, ctx.difficulty);
  const latest = rules.answerTimeMs - 300;

  if (willKnow) {
    return { text: pickRandom(ctx.rng, question.answers), delayMs: decisionDelay(ctx, latest) };
  }
  const decoy = ctx.rng() < TIMEOUT_CHANCE_WHEN_UNSURE ? null : wrongAnswer(ctx, question);
  if (decoy === null) return { text: null, delayMs: rules.answerTimeMs };
  return { text: decoy, delayMs: decisionDelay(ctx, latest) };
}
