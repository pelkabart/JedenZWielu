/** Poniżej tej wysokości (nad klawiaturą) panel odpowiedzi chowa nagłówek i zmniejsza pytanie. */
export const COMPACT_BELOW = 190;
/** Odstęp panelu od krawędzi klawiatury. */
export const KEYBOARD_GAP = 6;

export interface AnswerLayoutInput {
  windowHeight: number;
  keyboardHeight: number;
  safeTop: number;
}

export interface AnswerLayout {
  keyboardOpen: boolean;
  /** Ile miejsca zostaje nad klawiaturą na panel odpowiedzi. */
  available: number;
  compact: boolean;
  /** Odległość dolnej krawędzi panelu od dołu ekranu. */
  bottom: number;
}

/**
 * W trybie edge-to-edge na Androidzie okno nie zmniejsza się po otwarciu klawiatury,
 * tylko klawiatura je przykrywa. Dlatego sami ustawiamy panel tuż nad klawiaturą.
 */
export function answerLayout({ windowHeight, keyboardHeight, safeTop }: AnswerLayoutInput): AnswerLayout {
  const keyboardOpen = keyboardHeight > 0;
  if (!keyboardOpen) return { keyboardOpen, available: windowHeight - safeTop, compact: false, bottom: 0 };

  const bottom = keyboardHeight + KEYBOARD_GAP;
  const available = Math.max(0, windowHeight - bottom - safeTop - KEYBOARD_GAP);
  return { keyboardOpen, available, compact: available < COMPACT_BELOW, bottom };
}
