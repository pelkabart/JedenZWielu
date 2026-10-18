import { isCorrectAnswer } from '@/game/answers';
import type { Question } from '@/game/types';

/** Liczebnik porządkowy (tak go zapisuje rozpoznawanie mowy) → cyfra rzymska, jak w bazie pytań. */
const ORDINAL_TO_ROMAN: Record<string, string> = {
  pierwszy: 'I',
  pierwsza: 'I',
  drugi: 'II',
  druga: 'II',
  trzeci: 'III',
  trzecia: 'III',
  czwarty: 'IV',
  czwarta: 'IV',
  piąty: 'V',
  piąta: 'V',
  szósty: 'VI',
  szósta: 'VI',
};

const ORDINAL_AFTER_NAME = new RegExp(`(\\p{Lu}\\p{Ll}+) (${Object.keys(ORDINAL_TO_ROMAN).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

/** „Mieszko pierwszy.” → „Mieszko I”: zapis jak w bazie pytań, bez kropki na końcu. */
export function normalizeSpokenAnswer(text: string): string {
  return text
    .trim()
    .replace(ORDINAL_AFTER_NAME, (_match, name: string, ordinal: string) => `${name} ${ORDINAL_TO_ROMAN[ordinal.toLowerCase()]}`)
    .replace(/[.!?]+$/u, '')
    .trim();
}

/**
 * Rozpoznawanie mowy zwraca kilka wersji tego, co usłyszało (od najbardziej prawdopodobnej).
 * Bierzemy pierwszą, którą sprawdzanie uznaje za poprawną — jak prowadzący, który dobrze usłyszał —
 * a jeśli żadna nie pasuje, najbardziej prawdopodobną. `null` = nic nie usłyszano.
 */
export function chooseSpokenAnswer(transcripts: readonly string[], question: Question): string | null {
  const candidates = transcripts.map(normalizeSpokenAnswer).filter((t) => t !== '');
  if (candidates.length === 0) return null;
  return candidates.find((t) => isCorrectAnswer(t, question.answers)) ?? candidates[0];
}
