import type { Expression } from './catalog';

type AnswerBubble = { kind: 'thinking' } | { kind: 'answer'; correct: boolean } | null;

/** Mimika gracza: reakcja na odpowiedź ma pierwszeństwo przed mruganiem. Nie ma klatki smutnej, więc pomyłka to zamknięte oczy. */
export function podiumExpression(bubble: AnswerBubble, idle: Expression): Expression {
  if (bubble?.kind === 'answer') return bubble.correct ? 'smile' : 'closed-eyes';
  return idle;
}

/** Mimika prowadzącego: uśmiech, gdy dzieje się coś dobrego, poza tym mruganie. */
export function hostExpression(smiling: boolean, idle: Expression): Expression {
  return smiling ? 'smile' : idle;
}
