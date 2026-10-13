export const CATEGORIES = [
  'Historia',
  'Geografia',
  'Nauka',
  'Przyroda',
  'Sport',
  'Kultura',
  'Rozmaitości',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type QuestionDifficulty = 1 | 2 | 3;

/**
 * Rodzaj odpowiedzi — boty mylą się w obrębie tego samego rodzaju
 * (na pytanie o króla podają inną osobę, a nie rok).
 */
export const ANSWER_TYPES = ['data', 'liczba', 'osoba', 'miejsce', 'nazwa'] as const;

export type AnswerType = (typeof ANSWER_TYPES)[number];

export interface Question {
  id: string;
  category: Category;
  question: string;
  /** Wszystkie akceptowane odpowiedzi; pierwsza jest "kanoniczna" (pokazywana graczowi). */
  answers: string[];
  answerType: AnswerType;
  /** Opcjonalne wiarygodne pomyłki dla botów; mają pierwszeństwo przed losowaniem. */
  wrongAnswers?: string[];
  difficulty: QuestionDifficulty;
}

export type Difficulty = 'easy' | 'normal' | 'expert';

export type Phase = 'stage1' | 'stage2' | 'final' | 'finished';

export interface Rules {
  lives: number;
  stage1QuestionsPerPlayer: number;
  finalists: number;
  finalLives: number;
  finalQuestionPool: number;
  pointsPerCorrect: number;
  answerTimeMs: number;
  buzzWindowMs: number;
  /**
   * Etap II: po tylu pytaniach z rzędu zadanych innym bot musi wskazać człowieka
   * (żeby boty nie wskazywały się nawzajem bez końca). 0 wyłącza regułę.
   */
  maxQuestionsWithoutHuman: number;
}

export interface PlayerSetup {
  id: string;
  name: string;
  isHuman: boolean;
  /** Id profilu z `BOT_PROFILES`; wymagane dla botów. */
  botId?: string;
}

export interface PlayerState extends PlayerSetup {
  seat: number;
  lives: number;
  score: number;
  eliminated: boolean;
  /** Kolejność odpadnięcia (1 = pierwszy odpadł). */
  eliminatedOrder: number | null;
  finalist: boolean;
  correct: number;
  wrong: number;
  /** Ile pytań etapu II z rzędu padło do innych graczy od ostatniego pytania do tego gracza. */
  questionsWithoutTurn: number;
}

/** Dlaczego dany gracz odpowiada na pytanie. */
export type AnswerReason = 'turn' | 'picked' | 'self' | 'buzz' | 'solo';

export type Pending =
  | {
      kind: 'answer';
      playerId: string;
      question: Question;
      reason: AnswerReason;
      /** Kto wskazał odpowiadającego (etap II i finał). */
      pickedBy: string | null;
    }
  | { kind: 'buzz'; question: Question }
  | { kind: 'pick'; chooserId: string; allowSelf: boolean }
  | { kind: 'none' };

export type GameEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'question'; questionId: string; playerId: string | null }
  | { type: 'buzz'; playerId: string; questionId: string }
  | { type: 'noBuzz'; questionId: string }
  | { type: 'answer'; playerId: string; questionId: string; text: string | null; correct: boolean }
  | { type: 'lifeLost'; playerId: string; livesLeft: number }
  | { type: 'eliminated'; playerId: string }
  | { type: 'pick'; chooserId: string; targetId: string }
  | { type: 'score'; playerId: string; points: number; total: number }
  | { type: 'gameOver'; ranking: string[] };

export interface GameState {
  rules: Rules;
  difficulty: Difficulty;
  phase: Phase;
  players: PlayerState[];
  pending: Pending;
  /** Potasowana talia pytań; po wyczerpaniu zaczyna się od początku. */
  deck: Question[];
  cursor: number;
  stage1Queue: string[];
  stage2StarterSeat: number;
  finalQuestionsLeft: number;
  eliminations: number;
  ranking: string[] | null;
  events: GameEvent[];
}

export type GameAction =
  /** `text: null` oznacza brak odpowiedzi w czasie. */
  | { type: 'answer'; playerId: string; text: string | null }
  | { type: 'buzz'; playerId: string }
  | { type: 'noBuzz' }
  | { type: 'pick'; chooserId: string; targetId: string };
