import type { Question } from '../types';

export const TEST_BANK: Question[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i}`,
  category: i % 2 === 0 ? 'Historia' : 'Sport',
  question: `Pytanie testowe ${i}?`,
  answers: [`odpowiedz${i}`],
  answerType: 'nazwa',
  difficulty: 2,
}));
