import rawBank from '@/data/questions.json';
import { createLogger } from '@/lib/log';

import { isCorrectAnswer } from './answers';
import { ANSWER_TYPES, CATEGORIES, type AnswerType, type Category, type Question } from './types';

const NUMERIC_TYPES: AnswerType[] = ['data', 'liczba'];

function fail(index: number, message: string): never {
  throw new Error(`Baza pytań, pozycja ${index}: ${message}`);
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((a) => typeof a === 'string' && a.trim() !== '');
}

/** Waliduje jedno pytanie (z bazy albo wygenerowane). Rzuca błąd z opisem problemu. */
export function parseQuestion(item: unknown, index: number): Question {
  if (typeof item !== 'object' || item === null) fail(index, 'pytanie musi być obiektem');
  const { id, category, question, answers, answerType, wrongAnswers, difficulty } = item as Record<string, unknown>;

  if (typeof id !== 'string' || id === '') fail(index, 'brak "id"');
  if (!CATEGORIES.includes(category as Category)) fail(index, `nieznana kategoria "${String(category)}"`);
  if (typeof question !== 'string' || question.trim() === '') fail(index, 'pusta treść pytania');
  if (!isTextList(answers)) fail(index, '"answers" musi być niepustą tablicą tekstów');
  if (!ANSWER_TYPES.includes(answerType as AnswerType)) {
    fail(index, `"answerType" musi być jednym z: ${ANSWER_TYPES.join(', ')} (jest "${String(answerType)}")`);
  }
  const type = answerType as AnswerType;
  if (NUMERIC_TYPES.includes(type) && !/^\d+$/.test(answers[0].trim())) {
    fail(index, `dla typu "${type}" pierwsza odpowiedź musi być liczbą całkowitą (jest "${answers[0]}")`);
  }
  if (wrongAnswers !== undefined) {
    if (!isTextList(wrongAnswers)) fail(index, '"wrongAnswers" musi być niepustą tablicą tekstów');
    const accepted = wrongAnswers.find((w) => isCorrectAnswer(w, answers));
    if (accepted !== undefined) fail(index, `błędna odpowiedź "${accepted}" zostałaby uznana za poprawną`);
  }
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3) fail(index, '"difficulty" musi być 1, 2 lub 3');

  return {
    id,
    category: category as Category,
    question,
    answers,
    answerType: type,
    ...(wrongAnswers !== undefined && { wrongAnswers: wrongAnswers as string[] }),
    difficulty,
  };
}

/** Waliduje surowy JSON i zwraca listę pytań. Rzuca błąd z opisem pierwszego problemu. */
export function parseQuestionBank(raw: unknown): Question[] {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { questions?: unknown }).questions)) {
    throw new Error('Baza pytań: oczekiwano obiektu z tablicą "questions"');
  }
  const items = (raw as { questions: unknown[] }).questions;
  const ids = new Set<string>();

  return items.map((item, index) => {
    const parsed = parseQuestion(item, index);
    if (ids.has(parsed.id)) fail(index, `powtórzone id "${parsed.id}"`);
    ids.add(parsed.id);
    return parsed;
  });
}

const log = createLogger('baza-pytan');

function loadBank(): Question[] {
  try {
    const bank = parseQuestionBank(rawBank);
    log.info('Załadowano bazę pytań', { count: bank.length });
    return bank;
  } catch (error) {
    log.error('Błąd w bazie pytań', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export const QUESTION_BANK: Question[] = loadBank();
