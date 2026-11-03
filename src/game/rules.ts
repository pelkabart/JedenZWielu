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
  easy: { label: 'Łatwy', knowledgeOffset: -0.2, speedFactor: 1.3, answerFormat: 'choice', answerTimeMs: 7000 },
  normal: { label: 'Normalny', knowledgeOffset: 0, speedFactor: 1, answerFormat: 'choice', answerTimeMs: 5000 },
  expert: { label: 'Ekspert', knowledgeOffset: 0.15, speedFactor: 0.75, answerFormat: 'text', answerTimeMs: 10000 },
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'expert'];
