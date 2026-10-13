import type { Difficulty, Rules } from './types';

export const DEFAULT_RULES: Rules = {
  lives: 3,
  stage1QuestionsPerPlayer: 1,
  finalists: 3,
  finalLives: 3,
  finalQuestionPool: 50,
  pointsPerCorrect: 10,
  answerTimeMs: 15000,
  buzzWindowMs: 6000,
  maxQuestionsWithoutHuman: 4,
};

export const SOLO_PLAYER_COUNT = 5;

export interface DifficultyPreset {
  label: string;
  /** Dodawane do bazowej wiedzy każdego bota. */
  knowledgeOffset: number;
  /** Mnożnik czasu reakcji botów (mniej = szybciej). */
  speedFactor: number;
  /** Szansa, że bot zagra zgodnie ze swoją osobowością, a nie losowo. */
  strategicness: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { label: 'Łatwy', knowledgeOffset: -0.2, speedFactor: 1.3, strategicness: 0.5 },
  normal: { label: 'Normalny', knowledgeOffset: 0, speedFactor: 1, strategicness: 0.8 },
  expert: { label: 'Ekspert', knowledgeOffset: 0.15, speedFactor: 0.75, strategicness: 1 },
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'expert'];
