import {
  CATEGORY_FILE_FORMAT,
  CATEGORY_FILE_VERSION,
  categoryFileName,
  isCategoryFileName,
  parseCategoryFile,
  serializeCategoryFile,
  uniqueSetName,
} from '../categoryFile';
import { CategoryError } from '../errors';
import { sanitizeGeneratedQuestions } from '../generatedQuestions';
import { MIN_QUESTIONS } from '../openaiGenerator';
import { MAX_SET_NAME_LENGTH } from '../QuestionSetStore';
import { generatedItems } from '../testing/fakes';
import type { QuestionSet } from '../types';

const fileText = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: CATEGORY_FILE_FORMAT,
    version: CATEGORY_FILE_VERSION,
    name: 'Biologia',
    exportedAt: '2026-11-03T12:00:00.000Z',
    sourceFiles: ['notatki.pdf'],
    questions: generatedItems(30),
    ...overrides,
  });

function customSet(count = 30): QuestionSet {
  return {
    id: 'set-abc',
    name: 'Biologia',
    builtIn: false,
    createdAt: 1,
    sourceFiles: ['notatki.pdf', 'slajdy.pptx'],
    // Tak jak zapisane zestawy: po walidacji (bez pustych list pomyłek).
    questions: sanitizeGeneratedQuestions({ questions: generatedItems(count) }, 'set-abc').questions,
  };
}

function errorOf(fn: () => unknown): CategoryError {
  try {
    fn();
  } catch (error) {
    if (error instanceof CategoryError) return error;
    throw error;
  }
  throw new Error('Oczekiwano błędu');
}

describe('isCategoryFileName', () => {
  it.each([
    ['biologia.kat', true],
    ['BIOLOGIA.KAT', true],
    ['moja kategoria (2).kat', true],
    ['biologia.kat.json', false],
    ['biologia.json', false],
    ['kat', false],
    ['biologia.katx', false],
    ['notatki.pdf', false],
  ])('%s → %s', (name, expected) => {
    expect(isCategoryFileName(name)).toBe(expected);
  });
});

describe('categoryFileName', () => {
  it.each([
    ['Biologia', 'Biologia.kat'],
    ['Historia: 1/2', 'Historia_ 1_2.kat'],
    ['a\\b*c?d"e<f>g|h', 'a_b_c_d_e_f_g_h.kat'],
    ['   ', 'kategoria.kat'],
    ['..ukryta', 'ukryta.kat'],
    ['Żółć i gęślą', 'Żółć i gęślą.kat'],
  ])('%j → %j', (name, expected) => {
    expect(categoryFileName(name)).toBe(expected);
  });
});

describe('serializeCategoryFile', () => {
  it('zapisuje zwykły JSON z formatem, wersją i pytaniami bez id', () => {
    const text = serializeCategoryFile(customSet(), new Date('2026-11-03T12:00:00.000Z'));
    const raw = JSON.parse(text);
    expect(raw).toMatchObject({
      format: CATEGORY_FILE_FORMAT,
      version: CATEGORY_FILE_VERSION,
      name: 'Biologia',
      exportedAt: '2026-11-03T12:00:00.000Z',
      sourceFiles: ['notatki.pdf', 'slajdy.pptx'],
    });
    expect(raw.questions).toHaveLength(30);
    expect(raw.questions[0]).not.toHaveProperty('id');
  });

  it('plik z eksportu da się odczytać z tymi samymi pytaniami', () => {
    const set = customSet();
    const imported = parseCategoryFile(serializeCategoryFile(set));
    expect(imported.name).toBe(set.name);
    expect(imported.sourceFiles).toEqual(set.sourceFiles);
    expect(imported.rejected).toBe(0);
    expect(imported.questions.map(({ id: _id, ...q }) => q)).toEqual(set.questions.map(({ id: _id, ...q }) => q));
  });
});

describe('parseCategoryFile', () => {
  it('odczytuje poprawny plik i nadaje nowe id', () => {
    const imported = parseCategoryFile(fileText());
    expect(imported.name).toBe('Biologia');
    expect(imported.questions).toHaveLength(30);
    expect(new Set(imported.questions.map((q) => q.id)).size).toBe(30);
  });

  it('przycina spacje w nazwie, a brak listy plików źródłowych to pusta lista', () => {
    const imported = parseCategoryFile(fileText({ name: '  Biologia  ', sourceFiles: undefined }));
    expect(imported.name).toBe('Biologia');
    expect(imported.sourceFiles).toEqual([]);
  });

  it.each([
    ['nie JSON', '{to nie json', /to nie jest JSON/],
    ['tablica', '[]', /brak obiektu/],
    ['null', 'null', /brak obiektu/],
    ['inny format', fileText({ format: 'cos-innego' }), /nieznany format/],
    ['brak formatu', fileText({ format: undefined }), /nieznany format/],
    ['nowsza wersja', fileText({ version: 2 }), /wersja 2/],
    ['pusta nazwa', fileText({ name: '   ' }), /brak nazwy/],
    ['nazwa nie tekst', fileText({ name: 7 }), /brak nazwy/],
    ['brak pytań', fileText({ questions: undefined }), /brak listy pytań/],
  ])('%s → import-format', (_label, text, message) => {
    const error = errorOf(() => parseCategoryFile(text));
    expect(error.kind).toBe('import-format');
    expect(error.message).toMatch(message);
  });

  it('odrzuca złe pytania pojedynczo i pomija powtórzenia', () => {
    const good = generatedItems(25);
    const questions = [...good, { question: '' }, 'tekst', { ...good[0] }, { ...good[1], answerType: 'kolor' }];
    const imported = parseCategoryFile(fileText({ questions }));
    expect(imported.questions).toHaveLength(25);
    expect(imported.rejected).toBe(4);
  });

  it('za mało poprawnych pytań to błąd too-few-questions', () => {
    const error = errorOf(() => parseCategoryFile(fileText({ questions: generatedItems(MIN_QUESTIONS - 1) })));
    expect(error.kind).toBe('too-few-questions');
  });

  it('dokładnie minimum pytań przechodzi', () => {
    expect(parseCategoryFile(fileText({ questions: generatedItems(MIN_QUESTIONS) })).questions).toHaveLength(MIN_QUESTIONS);
  });
});

describe('uniqueSetName', () => {
  const sets = (...names: string[]) => names.map((name) => ({ name }));

  it('wolna nazwa zostaje', () => {
    expect(uniqueSetName('Biologia', sets('Domyślna'))).toBe('Biologia');
  });

  it('zajęta nazwa (bez względu na wielkość liter i ogonki) dostaje numer', () => {
    expect(uniqueSetName('Biologia', sets('Domyślna', 'BIOLOGIA'))).toBe('Biologia (2)');
    expect(uniqueSetName('Domyslna', sets('Domyślna'))).toBe('Domyslna (2)');
  });

  it('pomija zajęte numery', () => {
    expect(uniqueSetName('Biologia', sets('Biologia', 'Biologia (2)'))).toBe('Biologia (3)');
  });

  it('nie przekracza limitu długości nazwy', () => {
    const long = 'x'.repeat(MAX_SET_NAME_LENGTH + 10);
    const first = uniqueSetName(long, []);
    expect(first).toHaveLength(MAX_SET_NAME_LENGTH);
    const second = uniqueSetName(long, sets(first));
    expect(second.length).toBeLessThanOrEqual(MAX_SET_NAME_LENGTH);
    expect(second.endsWith(' (2)')).toBe(true);
  });
});
