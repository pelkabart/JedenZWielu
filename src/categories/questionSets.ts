import { QUESTION_BANK } from '@/game/questions';

import { fileStorage } from './device/fileStorage';
import { QuestionSetStore } from './QuestionSetStore';

/** Wspólny magazyn kategorii dla wszystkich ekranów. */
export const questionSetStore = new QuestionSetStore({
  storage: fileStorage('question-sets.json'),
  defaultQuestions: QUESTION_BANK,
});
