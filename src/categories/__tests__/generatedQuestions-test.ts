import { isCorrectAnswer } from '@/game/answers';

import { sanitizeGeneratedQuestions } from '../generatedQuestions';
import { generatedItems } from '../testing/fakes';

const item = {
  category: 'Historia',
  question: 'Kto napisał „Pana Tadeusza”?',
  answers: ['Adam Mickiewicz', 'Mickiewicz'],
  answerType: 'osoba',
  wrongAnswers: ['Juliusz Słowacki', 'Henryk Sienkiewicz'],
  difficulty: 1,
};

describe('sanitizeGeneratedQuestions', () => {
  it('przyjmuje poprawne pytania i nadaje im id z prefiksem', () => {
    const { questions, rejected } = sanitizeGeneratedQuestions({ questions: generatedItems(12) }, 'zestaw');
    expect(rejected).toBe(0);
    expect(questions).toHaveLength(12);
    expect(questions.map((q) => q.id)).toEqual(Array.from({ length: 12 }, (_, i) => `zestaw-${String(i + 1).padStart(3, '0')}`));
  });

  it('zachowuje treść, odpowiedzi, typ i trudność', () => {
    const [q] = sanitizeGeneratedQuestions({ questions: [item] }, 'x').questions;
    expect(q).toEqual({ id: 'x-001', ...item });
  });

  it('pustą listę pomyłek pomija (pole opcjonalne w bazie)', () => {
    const [q] = sanitizeGeneratedQuestions({ questions: [{ ...item, wrongAnswers: [] }] }, 'x').questions;
    expect(q).not.toHaveProperty('wrongAnswers');
  });

  it('usuwa pomyłki, które zostałyby uznane za poprawne, a resztę zostawia', () => {
    const [q] = sanitizeGeneratedQuestions(
      { questions: [{ ...item, wrongAnswers: ['Adam Mickiewicz', 'Mickiewlcz', 'Juliusz Słowacki', ' '] }] },
      'x',
    ).questions;
    expect(q.wrongAnswers).toEqual(['Juliusz Słowacki']);
    for (const wrong of q.wrongAnswers ?? []) expect(isCorrectAnswer(wrong, q.answers)).toBe(false);
  });

  it('nieznaną dziedzinę zamienia na „Rozmaitości”', () => {
    const [q] = sanitizeGeneratedQuestions({ questions: [{ ...item, category: 'Kosmos' }] }, 'x').questions;
    expect(q.category).toBe('Rozmaitości');
  });

  it('przycina spacje w treści i odpowiedziach, puste odpowiedzi pomija', () => {
    const [q] = sanitizeGeneratedQuestions(
      { questions: [{ ...item, question: '  Kto?  ', answers: [' Adam Mickiewicz ', '', 'Mickiewicz'] }] },
      'x',
    ).questions;
    expect(q.question).toBe('Kto?');
    expect(q.answers).toEqual(['Adam Mickiewicz', 'Mickiewicz']);
  });

  it.each([
    ['nie obiekt', 'tekst'],
    ['pusta treść', { ...item, question: '   ' }],
    ['brak odpowiedzi', { ...item, answers: [] }],
    ['odpowiedzi nie są tekstem', { ...item, answers: [1, 2] }],
    ['nieznany typ odpowiedzi', { ...item, answerType: 'kolor' }],
    ['data słowami', { ...item, answerType: 'data', answers: ['rok tysiąc czterysta dziesiąty'] }],
    ['liczba z jednostką', { ...item, answerType: 'liczba', answers: ['12 km'] }],
    ['zła trudność', { ...item, difficulty: 4 }],
  ])('odrzuca pojedyncze złe pytanie: %s', (_, bad) => {
    const { questions, rejected } = sanitizeGeneratedQuestions({ questions: [item, bad] }, 'x');
    expect(questions).toHaveLength(1);
    expect(rejected).toBe(1);
  });

  it('pomija powtórzone pytania (bez względu na wielkość liter i interpunkcję)', () => {
    const { questions, rejected } = sanitizeGeneratedQuestions(
      { questions: [item, { ...item, question: 'kto napisał Pana Tadeusza' }] },
      'x',
    );
    expect(questions).toHaveLength(1);
    expect(rejected).toBe(1);
  });

  it.each([
    ['null', null],
    ['brak tablicy', { pytania: [] }],
    ['tablica zamiast obiektu', [item]],
  ])('zły kształt odpowiedzi (%s) daje pustą listę', (_, raw) => {
    expect(sanitizeGeneratedQuestions(raw, 'x').questions).toEqual([]);
  });
});
