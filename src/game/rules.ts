import type { AnswerFormat, Difficulty } from './types';

export const SOLO_PLAYER_COUNT = 5;

export interface DifficultyPreset {
  label: string;
  /** Dodawane do bazowej wiedzy każdego bota. */
  knowledgeOffset: number;
  /** Mnożnik czasu reakcji botów (mniej = szybciej). */
  speedFactor: number;
  /** Format odpowiedzi gracza: wybór A–D albo pisemnie. */
  answerFormat: AnswerFormat;
  /** Czas gracza na odpowiedź (wg PDF „Quiz Frenzy”). */
  answerTimeMs: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  // Średnia wiedza botów ≈ 0,62, więc boty trafiają średnio: łatwy ~37%, normalny ~50%, ekspert ~65%.
  easy: { label: 'Łatwy', knowledgeOffset: -0.25, speedFactor: 1.5, answerFormat: 'choice', answerTimeMs: 7000 },
  normal: { label: 'Normalny', knowledgeOffset: -0.12, speedFactor: 1.3, answerFormat: 'choice', answerTimeMs: 5000 },
  expert: { label: 'Ekspert', knowledgeOffset: 0.03, speedFactor: 1, answerFormat: 'text', answerTimeMs: 10000 },
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'expert'];
