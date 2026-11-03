import { normalizeAnswer } from '@/game/answers';
import type { Question } from '@/game/types';

import { CategoryError } from './errors';
import { sanitizeGeneratedQuestions } from './generatedQuestions';
import { MIN_QUESTIONS } from './openaiGenerator';
import { MAX_SET_NAME_LENGTH } from './QuestionSetStore';
import type { QuestionSet } from './types';

export const CATEGORY_FILE_EXTENSION = 'kat';
export const CATEGORY_FILE_FORMAT = 'jeden-z-wielu/kategoria';
export const CATEGORY_FILE_VERSION = 1;
/** Kategoria z 60 pytaniami ma kilkadziesiąt KB; większy plik to nie nasza kategoria. */
export const MAX_CATEGORY_FILE_BYTES = 5 * 1024 * 1024;
/** Android nie zna typu `.kat`; przy `application/json` dokleiłby `.json` do nazwy. */
export const CATEGORY_FILE_MIME_TYPE = 'application/octet-stream';

/** Zawartość pliku `.kat` (zwykły JSON). */
export interface CategoryFile {
  format: typeof CATEGORY_FILE_FORMAT;
  version: typeof CATEGORY_FILE_VERSION;
  name: string;
  exportedAt: string;
  sourceFiles: string[];
  questions: Omit<Question, 'id'>[];
}

/** Kategoria odczytana z pliku, gotowa do zapisania w magazynie. */
export interface ImportedCategory {
  name: string;
  sourceFiles: string[];
  questions: Question[];
  /** Ile pytań z pliku odrzuciła walidacja. */
  rejected: number;
}

export function isCategoryFileName(name: string): boolean {
  return name.toLowerCase().endsWith(`.${CATEGORY_FILE_EXTENSION}`);
}

/** Nazwa pliku bez znaków zakazanych w systemach plików, zawsze z `.kat`. */
export function categoryFileName(setName: string): string {
  const safe = setName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/^\.+/, '');
  return `${safe === '' ? 'kategoria' : safe}.${CATEGORY_FILE_EXTENSION}`;
}

export function serializeCategoryFile(set: QuestionSet, now: Date = new Date()): string {
  const file: CategoryFile = {
    format: CATEGORY_FILE_FORMAT,
    version: CATEGORY_FILE_VERSION,
    name: set.name,
    exportedAt: now.toISOString(),
    sourceFiles: [...set.sourceFiles],
    questions: set.questions.map(({ id: _id, ...question }) => question),
  };
  return JSON.stringify(file, null, 2);
}

const formatError = (reason: string) => new CategoryError('import-format', `Plik nie jest poprawną kategorią: ${reason}.`);

/**
 * Odczytuje plik `.kat`. Pytania przechodzą tę samą walidację co pytania z OpenAI
 * (złe odrzucane pojedynczo, powtórzenia pomijane); poniżej `MIN_QUESTIONS` to błąd.
 */
export function parseCategoryFile(text: string): ImportedCategory {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw formatError('to nie jest JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw formatError('brak obiektu kategorii');
  const { format, version, name, sourceFiles, questions } = raw as Record<string, unknown>;
  if (format !== CATEGORY_FILE_FORMAT) throw formatError('nieznany format');
  if (version !== CATEGORY_FILE_VERSION) {
    throw formatError(`nieobsługiwana wersja ${String(version)} (gra obsługuje wersję ${CATEGORY_FILE_VERSION})`);
  }
  if (typeof name !== 'string' || name.trim() === '') throw formatError('brak nazwy');
  if (!Array.isArray(questions)) throw formatError('brak listy pytań');

  const result = sanitizeGeneratedQuestions({ questions }, 'import');
  if (result.questions.length < MIN_QUESTIONS) {
    throw new CategoryError(
      'too-few-questions',
      `Za mało pytań: w pliku jest ${result.questions.length} poprawnych, potrzeba co najmniej ${MIN_QUESTIONS}.`,
    );
  }
  return {
    name: name.trim(),
    sourceFiles: Array.isArray(sourceFiles) ? sourceFiles.filter((f): f is string => typeof f === 'string') : [],
    questions: result.questions,
    rejected: result.rejected,
  };
}

/** Pierwsza wolna nazwa: „Biologia”, „Biologia (2)”, „Biologia (3)”… w limicie długości. */
export function uniqueSetName(name: string, existing: Pick<QuestionSet, 'name'>[]): string {
  const taken = new Set(existing.map((s) => normalizeAnswer(s.name)));
  const base = name.trim().slice(0, MAX_SET_NAME_LENGTH).trim();
  if (!taken.has(normalizeAnswer(base))) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, MAX_SET_NAME_LENGTH - suffix.length).trim()}${suffix}`;
    if (!taken.has(normalizeAnswer(candidate))) return candidate;
  }
}
