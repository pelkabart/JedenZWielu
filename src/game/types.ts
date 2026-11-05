export const CATEGORIES = [
  'Historia',
  'Geografia',
  'Nauka',
  'Przyroda',
  'Sport',
  'Kultura',
  'Rozmaitości',
  'Literatura',
  'Język polski',
  'Muzyka',
  'Film i seriale',
  'Sztuka',
  'Architektura',
  'Matematyka',
  'Fizyka',
  'Chemia',
  'Biologia',
  'Astronomia',
  'Medycyna i anatomia',
  'Informatyka',
  'Technika i wynalazki',
  'Mitologia',
  'Religie świata',
  'Kuchnia i kulinaria',
  'Teatr i widowiska',
  'Prawo i społeczeństwo',
  'Ekonomia',
  'Polska i tradycje',
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

/** Jak gracz podaje odpowiedź: wybór A–D albo wpisanie tekstu. */
export type AnswerFormat = 'choice' | 'text';

export interface Rules {
  answerTimeMs: number;
}

export interface PlayerSetup {
  id: string;
  name: string;
  isHuman: boolean;
  /** Id profilu z `BOT_PROFILES`; wymagane dla botów. */
  botId?: string;
}

/** To, co pokazuje pulpit gracza. */
export interface PlayerState extends PlayerSetup {
  seat: number;
  lives: number;
  score: number;
  eliminated: boolean;
}
