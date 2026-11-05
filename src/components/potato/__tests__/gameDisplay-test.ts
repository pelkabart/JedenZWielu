import type { Question } from '@/game/types';

import { blindModeOn, multiplierBurstText, multiplierColor, secondsLeft, shownQuestion, spotlightId } from '../gameDisplay';

const question = (id: string): Question => ({ id, category: 'Historia', question: id, answers: ['x'], answerType: 'nazwa', difficulty: 1 });
const answered = question('answered');
const next = question('next');
const reveal = { kind: 'reveal' as const, playerId: 'b1', question: answered, text: 'x', correct: true, correctAnswer: 'x' };
const round = { kind: 'round' as const, phase: 'sprint' as const };

describe('pytanie na ekranie', () => {
  it('w czasie tury widać bieżące pytanie', () => {
    expect(shownQuestion(null, next)).toBe(next);
  });

  it('przy wskazywaniu gracza pytanie znika', () => {
    expect(shownQuestion(null, answered, true)).toBeNull();
  });

  it('w czasie wyniku widać pytanie, na które odpowiadano, a nie następne', () => {
    expect(shownQuestion(reveal, next)).toBe(answered);
  });

  it.each([
    ['planszy', round],
    ['wyników', { kind: 'finished' as const }],
  ])('w czasie %s nie widać żadnego pytania', (_name, overlay) => {
    expect(shownQuestion(overlay, next)).toBeNull();
  });
});

describe('podświetlony gracz', () => {
  it('w czasie tury: ten, kto ma pytanie', () => {
    expect(spotlightId(null, 'h')).toBe('h');
  });

  it('w czasie wyniku: ten, kto odpowiedział', () => {
    expect(spotlightId(reveal, 'h')).toBe('b1');
  });

  it('na planszy: nikt', () => {
    expect(spotlightId(round, 'h')).toBeNull();
  });
});

describe('tryb odbicia w ciemno', () => {
  it('tryb odbicia dotyczy tylko pytania, przy którym go włączono', () => {
    expect(blindModeOn(5, 5, true)).toBe(true);
    expect(blindModeOn(5, 6, true)).toBe(false);
  });

  it('nie działa, gdy jest wyłączony albo odbicie jest niedostępne', () => {
    expect(blindModeOn(null, 5, true)).toBe(false);
    expect(blindModeOn(5, 5, false)).toBe(false);
  });
});

describe('licznik wskazywania', () => {
  it.each([
    [5000, 5],
    [4001, 5],
    [4000, 4],
    [1, 1],
    [0, 0],
    [-500, 0],
  ])('przy %i ms do końca pokazuje %i', (left, shown) => {
    expect(secondsLeft(10_000 + left, 10_000)).toBe(shown);
  });

  it('stary czas ekranu nie pokazuje więcej, niż trwa licznik', () => {
    expect(secondsLeft(60_000, 10_000, 5000)).toBe(5);
  });

  it('przed startem licznika nic nie pokazuje', () => {
    expect(secondsLeft(null, 10_000)).toBeNull();
  });
});

describe('mnożnik', () => {
  it('kolor robi się groźniejszy i nie wychodzi poza listę przy dużym mnożniku', () => {
    const shades = [1, 2, 3].map(multiplierColor);
    expect(new Set(shades).size).toBe(3);
    expect(multiplierColor(50)).toBe(shades[2]);
    expect(multiplierColor(0)).toBe(shades[0]);
  });

  it('wzrost pokazuje mnożnik, a powrót do ×1 wybuch', () => {
    expect(multiplierBurstText(3)).toBe('×3');
    expect(multiplierBurstText(1)).toBe('BUM!');
  });
});
