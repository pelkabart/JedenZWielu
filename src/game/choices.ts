import { isCorrectAnswer, normalizeAnswer } from './answers';
import { createRng, randomInt, shuffle, type Rng } from './rng';
import type { Question } from './types';

/** Liczba opcji w pytaniu ABCD. */
export const CHOICE_COUNT = 4;

/** Liczba „obok” poprawnej: rok przesunięty o kilka–kilkadziesiąt lat, liczba o kilkadziesiąt procent. */
export function nearbyNumber(rng: Rng, question: Question): string | null {
  const correct = Number(question.answers[0]);
  const spread = question.answerType === 'data' ? 40 : Math.max(2, Math.round(correct * 0.3));
  for (let attempt = 0; attempt < 10; attempt++) {
    const delta = randomInt(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    const candidate = String(correct + delta < 0 ? correct - delta : correct + delta);
    if (!isCorrectAnswer(candidate, question.answers)) return candidate;
  }
  return null;
}

/** Ziarno z id pytania: te same opcje wracają niezależnie od tego, ile losowań było wcześniej w grze. */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Opcje A–D: poprawna odpowiedź i pomyłki tego samego rodzaju.
 * Pomyłki: własne `wrongAnswers` pytania, potem odpowiedzi z innych pytań tego samego typu (najpierw z tej kategorii).
 * Zwraca mniej opcji, gdy nie ma dość pomyłek.
 */
export function buildChoices(question: Question, bank: Question[]): string[] {
  const correct = question.answers[0];
  const rng = createRng(hashString(question.id));
  const usedKeys = new Set([normalizeAnswer(correct)]);
  const distractors: string[] = [];

  const take = (candidates: string[]) => {
    for (const candidate of shuffle(rng, candidates)) {
      if (distractors.length >= CHOICE_COUNT - 1) return;
      const key = normalizeAnswer(candidate);
      if (usedKeys.has(key) || isCorrectAnswer(candidate, question.answers)) continue;
      usedKeys.add(key);
      distractors.push(candidate);
    }
  };

  take(question.wrongAnswers ?? []);
  const sameType = bank.filter((q) => q.id !== question.id && q.answerType === question.answerType);
  take(sameType.filter((q) => q.category === question.category).map((q) => q.answers[0]));
  take(sameType.map((q) => q.answers[0]));

  // W bazie są pytania o datach i liczbach, do których nie ma innych pomyłek tego samego typu. Liczby obok poprawnej wypełniają lukę.
  if (question.answerType === 'data' || question.answerType === 'liczba') {
    for (let attempt = 0; attempt < 20 && distractors.length < CHOICE_COUNT - 1; attempt++) {
      const candidate = nearbyNumber(rng, question);
      if (candidate !== null) take([candidate]);
    }
  }

  return shuffle(rng, [correct, ...distractors]);
}
