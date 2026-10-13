import { isCorrectAnswer } from '../answers';
import { parseQuestionBank, QUESTION_BANK } from '../questions';
import { CATEGORIES } from '../types';

const valid = { id: 'x1', category: 'Historia', question: 'Pytanie?', answers: ['A'], answerType: 'nazwa', difficulty: 1 };

describe('parseQuestionBank', () => {
  it('przyjmuje poprawną bazę', () => {
    expect(parseQuestionBank({ questions: [valid] })).toEqual([valid]);
  });

  it('przyjmuje własne pomyłki', () => {
    const withWrong = { ...valid, wrongAnswers: ['B', 'C'] };
    expect(parseQuestionBank({ questions: [withWrong] })).toEqual([withWrong]);
  });

  it.each([
    ['brak tablicy questions', {}],
    ['powtórzone id', { questions: [valid, valid] }],
    ['nieznana kategoria', { questions: [{ ...valid, category: 'Kosmos' }] }],
    ['pusta treść', { questions: [{ ...valid, question: ' ' }] }],
    ['brak odpowiedzi', { questions: [{ ...valid, answers: [] }] }],
    ['odpowiedź nie jest tekstem', { questions: [{ ...valid, answers: [1410] }] }],
    ['zła trudność', { questions: [{ ...valid, difficulty: 5 }] }],
    ['brak typu odpowiedzi', { questions: [{ ...valid, answerType: undefined }] }],
    ['nieznany typ odpowiedzi', { questions: [{ ...valid, answerType: 'kolor' }] }],
    ['data, która nie jest liczbą', { questions: [{ ...valid, answerType: 'data', answers: ['rok 1410'] }] }],
    ['pusta lista pomyłek', { questions: [{ ...valid, wrongAnswers: [] }] }],
    ['pomyłka, która jest poprawną odpowiedzią', { questions: [{ ...valid, answers: ['Ottawa'], wrongAnswers: ['Otawa'] }] }],
  ])('odrzuca bazę: %s', (_, raw) => {
    expect(() => parseQuestionBank(raw)).toThrow();
  });
});

describe('QUESTION_BANK', () => {
  it('zawiera 50 pytań', () => {
    expect(QUESTION_BANK).toHaveLength(50);
  });

  it('ma pytania z każdej kategorii', () => {
    for (const category of CATEGORIES) {
      expect(QUESTION_BANK.some((q) => q.category === category)).toBe(true);
    }
  });

  it('daty i liczby mają liczbową pierwszą odpowiedź', () => {
    for (const q of QUESTION_BANK.filter((q) => q.answerType === 'data' || q.answerType === 'liczba')) {
      expect(q.answers[0]).toMatch(/^\d+$/);
    }
  });

  it('każda zapisana odpowiedź jest akceptowana przez sprawdzanie', () => {
    for (const q of QUESTION_BANK) {
      for (const answer of q.answers) {
        expect(isCorrectAnswer(answer, q.answers)).toBe(true);
      }
    }
  });
});
