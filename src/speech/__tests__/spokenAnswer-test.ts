import type { Question } from '@/game/types';

import { chooseSpokenAnswer, normalizeSpokenAnswer } from '../spokenAnswer';

const question = (answers: string[]): Question => ({
  id: 'q',
  category: 'Historia',
  question: 'Pytanie?',
  answers,
  answerType: 'osoba',
  difficulty: 1,
});

describe('normalizeSpokenAnswer', () => {
  it('liczebnik porządkowy po imieniu zamienia na cyfrę rzymską, jak w bazie', () => {
    expect(normalizeSpokenAnswer('Mieszko pierwszy')).toBe('Mieszko I');
    expect(normalizeSpokenAnswer('Bolesław Pierwszy Chrobry')).toBe('Bolesław I Chrobry');
    expect(normalizeSpokenAnswer('Jan trzeci Sobieski')).toBe('Jan III Sobieski');
    expect(normalizeSpokenAnswer('Elżbieta druga')).toBe('Elżbieta II');
  });

  it('usuwa kropkę na końcu i odstępy', () => {
    expect(normalizeSpokenAnswer('  Ottawa.  ')).toBe('Ottawa');
    expect(normalizeSpokenAnswer('1410')).toBe('1410');
  });

  it('nie rusza słów, które tylko wyglądają na liczebnik', () => {
    expect(normalizeSpokenAnswer('pierwszy')).toBe('pierwszy');
    expect(normalizeSpokenAnswer('drugi raz')).toBe('drugi raz');
  });
});

describe('chooseSpokenAnswer', () => {
  it('bierze najbardziej prawdopodobną wersję, gdy żadna nie jest poprawna', () => {
    expect(chooseSpokenAnswer(['Kraków', 'krakowie'], question(['Warszawa']))).toBe('Kraków');
  });

  it('bierze pierwszą poprawną wersję, nawet jeśli nie jest najbardziej prawdopodobna', () => {
    expect(chooseSpokenAnswer(['Mieszko pierwszy', 'mieszko 1', 'Mieszko'], question(['Mieszko I', 'Mieszko']))).toBe('Mieszko I');
    expect(chooseSpokenAnswer(['Otawa w', 'Ottawa'], question(['Ottawa']))).toBe('Ottawa');
  });

  it('literówki rozpoznawania są tolerowane tak samo jak przy pisaniu', () => {
    expect(chooseSpokenAnswer(['Otawa'], question(['Ottawa']))).toBe('Otawa');
  });

  it('nic nie usłyszano: null', () => {
    expect(chooseSpokenAnswer([], question(['Ottawa']))).toBeNull();
    expect(chooseSpokenAnswer(['', '  ', '.'], question(['Ottawa']))).toBeNull();
  });
});
