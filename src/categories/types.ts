import type { Question } from '@/game/types';

export const DEFAULT_SET_ID = 'default';
export const DEFAULT_SET_NAME = 'Domyślna';
/** Ile własnych zestawów można mieć jednocześnie (domyślny się nie liczy). */
export const MAX_CUSTOM_SETS = 3;

/**
 * Zestaw pytań — w interfejsie „kategoria”. Nie mylić z `Question.category` (dziedzina pytania).
 * Domyślny zestaw to baza z `src/data/questions.json`; własne powstają z plików gracza przez OpenAI.
 */
export interface QuestionSet {
  id: string;
  name: string;
  builtIn: boolean;
  /** Czas utworzenia (ms); `null` dla domyślnego. */
  createdAt: number | null;
  /** Nazwy plików, z których powstał zestaw. */
  sourceFiles: string[];
  questions: Question[];
}
