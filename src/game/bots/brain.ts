import { isCorrectAnswer } from '../answers';
import { getPlayer, pickTargets } from '../engine';
import { DIFFICULTY_PRESETS } from '../rules';
import { pickRandom, randomInt, type Rng } from '../rng';
import type { Difficulty, GameState, PlayerState, Question, QuestionDifficulty, Rules } from '../types';
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

export interface BotBuzz {
  /** `null` = bot się nie zgłasza. */
  delayMs: number | null;
  /** Gotowa odpowiedź, jeśli to właśnie ten bot zdobędzie pytanie. */
  answer: BotAnswer;
}

const QUESTION_DIFFICULTY_MODIFIER: Record<QuestionDifficulty, number> = { 1: 0.12, 2: 0, 3: -0.15 };
const TIMEOUT_CHANCE_WHEN_UNSURE = 0.3;

export function correctChance(profile: BotProfile, question: Question, difficulty: Difficulty): number {
  const p =
    profile.knowledge +
    (profile.categoryBonus[question.category] ?? 0) +
    DIFFICULTY_PRESETS[difficulty].knowledgeOffset +
    QUESTION_DIFFICULTY_MODIFIER[question.difficulty];
  return Math.min(0.97, Math.max(0.05, p));
}

function scaled(ctx: BotContext, [min, max]: [number, number]) {
  return Math.round(randomInt(ctx.rng, min, max) * DIFFICULTY_PRESETS[ctx.difficulty].speedFactor);
}

/** Liczba "obok" poprawnej: rok przesunięty o kilka–kilkadziesiąt lat, liczba o kilkadziesiąt procent. */
function nearbyNumber(ctx: BotContext, question: Question): string | null {
  const correct = Number(question.answers[0]);
  const spread = question.answerType === 'data' ? 40 : Math.max(2, Math.round(correct * 0.3));
  for (let attempt = 0; attempt < 10; attempt++) {
    const delta = randomInt(ctx.rng, 1, spread) * (ctx.rng() < 0.5 ? -1 : 1);
    const candidate = String(correct + delta < 0 ? correct - delta : correct + delta);
    if (!isCorrectAnswer(candidate, question.answers)) return candidate;
  }
  return null;
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

  if (question.answerType === 'data' || question.answerType === 'liczba') return nearbyNumber(ctx, question);

  const sameType = (ctx.bank ?? []).filter((q) => q.id !== question.id && q.answerType === question.answerType);
  const sameCategory = sameType.filter((q) => q.category === question.category);
  for (const pool of [sameCategory, sameType]) {
    const candidates = pool.map((q) => q.answers[0]).filter(notCorrect);
    if (candidates.length > 0) return pickRandom(ctx.rng, candidates);
  }
  return null;
}

/** `knows` można narzucić (np. gdy bot zdecydował o tym już przy zgłoszeniu w finale). */
export function decideAnswer(ctx: BotContext, question: Question, rules: Rules, knows?: boolean): BotAnswer {
  const willKnow = knows ?? ctx.rng() < correctChance(ctx.profile, question, ctx.difficulty);
  const latest = rules.answerTimeMs - 300;

  if (willKnow) {
    return { text: pickRandom(ctx.rng, question.answers), delayMs: Math.min(latest, scaled(ctx, ctx.profile.answerTimeMs)) };
  }
  const decoy = ctx.rng() < TIMEOUT_CHANCE_WHEN_UNSURE ? null : wrongAnswer(ctx, question);
  if (decoy === null) return { text: null, delayMs: rules.answerTimeMs };
  return { text: decoy, delayMs: Math.min(latest, Math.round(scaled(ctx, ctx.profile.answerTimeMs) * 1.2)) };
}

export function decideBuzz(ctx: BotContext, question: Question, rules: Rules): BotBuzz {
  const knows = ctx.rng() < correctChance(ctx.profile, question, ctx.difficulty);
  const wantsToBuzz = ctx.rng() < (knows ? ctx.profile.eagerness : ctx.profile.recklessness);
  const answer = decideAnswer(ctx, question, rules, knows);
  if (!wantsToBuzz) return { delayMs: null, answer };

  const delayMs = scaled(ctx, ctx.profile.buzzTimeMs);
  return { delayMs: delayMs < rules.buzzWindowMs ? delayMs : null, answer };
}

export function decidePickDelay(ctx: BotContext): number {
  return scaled(ctx, [1200, 3000]);
}

/** Ocena, jak groźny jest rywal — używana przez taktyka. */
export function threat(player: PlayerState): number {
  return player.lives * 2 + player.correct + player.score / 10;
}

function weakest(ctx: BotContext, players: PlayerState[]): PlayerState {
  const minLives = Math.min(...players.map((p) => p.lives));
  return pickRandom(ctx.rng, players.filter((p) => p.lives === minLives));
}

function strongest(ctx: BotContext, players: PlayerState[]): PlayerState {
  const maxThreat = Math.max(...players.map(threat));
  return pickRandom(ctx.rng, players.filter((p) => threat(p) === maxThreat));
}

function lastAttacker(state: GameState, botId: string, opponents: PlayerState[]): PlayerState | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'pick' && e.targetId === botId && e.chooserId !== botId) {
      return opponents.find((p) => p.id === e.chooserId) ?? null;
    }
  }
  return null;
}

/** Wybór gracza do wskazania; w finale bot może też wziąć pytanie na siebie. */
export function decideTarget(ctx: BotContext, state: GameState, botId: string): string {
  if (state.pending.kind !== 'pick' || state.pending.chooserId !== botId) {
    throw new Error(`Bot ${botId} nie wskazuje teraz`);
  }
  const me = getPlayer(state, botId);
  const opponents = pickTargets(state, botId).filter((p) => p.id !== botId);

  if (state.pending.allowSelf) {
    const selfChance = ctx.profile.confidence * (me.lives === 1 ? 0.5 : 1);
    if (opponents.length === 0 || ctx.rng() < selfChance) return botId;
  }

  const playsInCharacter = ctx.rng() < DIFFICULTY_PRESETS[ctx.difficulty].strategicness;
  if (!playsInCharacter || ctx.profile.personality === 'chaotic') {
    return pickRandom(ctx.rng, opponents).id;
  }

  switch (ctx.profile.personality) {
    case 'predator':
      return weakest(ctx, opponents).id;
    case 'tactician':
      return strongest(ctx, opponents).id;
    case 'avenger':
      return (lastAttacker(state, botId, opponents) ?? weakest(ctx, opponents)).id;
  }
}
