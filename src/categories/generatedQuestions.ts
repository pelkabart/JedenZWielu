import { isCorrectAnswer, normalizeAnswer } from '@/game/answers';
import { parseQuestion } from '@/game/questions';
import { CATEGORIES, type Category, type Question } from '@/game/types';

const FALLBACK_CATEGORY: Category = 'Rozmaitości';

const texts = (value: unknown): unknown =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v !== '') : value;

/** Poprawia to, co da się poprawić bez zgadywania; resztę ocenia `parseQuestion`. */
function repair(item: Record<string, unknown>, id: string) {
  const answers = texts(item.answers);
  let wrongAnswers = texts(item.wrongAnswers);
  if (Array.isArray(wrongAnswers) && Array.isArray(answers) && answers.every((a) => typeof a === 'string')) {
    wrongAnswers = wrongAnswers.filter((w) => typeof w !== 'string' || !isCorrectAnswer(w, answers));
  }
  return {
    id,
    category: CATEGORIES.includes(item.category as Category) ? item.category : FALLBACK_CATEGORY,
    question: typeof item.question === 'string' ? item.question.trim() : item.question,
    answers,
    answerType: item.answerType,
    // W bazie lista pomyłek jest opcjonalna, ale nie może być pusta.
    ...(Array.isArray(wrongAnswers) && wrongAnswers.length > 0 && { wrongAnswers }),
    difficulty: item.difficulty,
  };
}

/**
 * Zamienia odpowiedź modelu na pytania gry. Złe pytania odrzuca pojedynczo, powtórzenia pomija,
 * a id nadaje na nowo (`<prefix>-001`), bo modelowi nie można ufać w unikalności.
 */
export function sanitizeGeneratedQuestions(raw: unknown, idPrefix: string): { questions: Question[]; rejected: number } {
  const items = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as { questions?: unknown }).questions : null;
  if (!Array.isArray(items)) return { questions: [], rejected: 0 };

  const questions: Question[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (const item of items) {
    try {
      if (typeof item !== 'object' || item === null) throw new Error('nie obiekt');
      const id = `${idPrefix}-${String(questions.length + 1).padStart(3, '0')}`;
      const question = parseQuestion(repair(item as Record<string, unknown>, id), questions.length);
      const key = normalizeAnswer(question.question);
      if (seen.has(key)) throw new Error('powtórzone pytanie');
      seen.add(key);
      questions.push(question);
    } catch {
      rejected++;
    }
  }
  return { questions, rejected };
}
