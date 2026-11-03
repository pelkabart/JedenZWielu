import { QUESTION_BANK } from '@/game/questions';
import { getLogEntries, resetLog } from '@/lib/log';

import { CATEGORY_FILE_FORMAT, CATEGORY_FILE_VERSION, MAX_CATEGORY_FILE_BYTES } from '../categoryFile';
import { CategoryError } from '../errors';
import { QuestionSetStore } from '../QuestionSetStore';
import type { PickedFile } from '../sourceFiles';
import { generatedItems, MemoryStorage } from '../testing/fakes';
import { exportQuestionSet, importQuestionSet } from '../transferQuestionSet';
import { DEFAULT_SET_ID, MAX_CUSTOM_SETS } from '../types';

const picked = (name = 'biologia.kat', size = 4096): PickedFile => ({ name, size, uri: `file:///cache/${name}` });

const katText = (name = 'Biologia', count = 30) =>
  JSON.stringify({ format: CATEGORY_FILE_FORMAT, version: CATEGORY_FILE_VERSION, name, sourceFiles: ['notatki.pdf'], questions: generatedItems(count) });

function setup(text = katText()) {
  const storage = new MemoryStorage();
  const store = new QuestionSetStore({ storage, defaultQuestions: QUESTION_BANK, now: () => 1_700_000_000_000 });
  const readText = jest.fn(async (_file: PickedFile) => text);
  return { store, storage, readText };
}

async function errorOf(promise: Promise<unknown>): Promise<CategoryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CategoryError) return error;
    throw error;
  }
  throw new Error('Oczekiwano błędu');
}

beforeEach(() => resetLog());

describe('importQuestionSet', () => {
  it('zapisuje zaimportowaną kategorię jak każdą własną', async () => {
    const { store, storage, readText } = setup();
    const set = await importQuestionSet(picked(), { store, readText });

    expect(set).toMatchObject({ name: 'Biologia', builtIn: false, sourceFiles: ['notatki.pdf'] });
    expect(set.questions).toHaveLength(30);
    expect(set.questions.every((q) => q.id.startsWith(`${set.id}-`))).toBe(true);
    expect(store.customCount()).toBe(1);
    expect(storage.writes).toBe(1);
    expect(store.questionsForSet(set.id)).toBe(set.questions);
  });

  it('odrzuca plik bez rozszerzenia .kat i go nie czyta', async () => {
    const { store, readText } = setup();
    const error = await errorOf(importQuestionSet(picked('biologia.json'), { store, readText }));
    expect(error.kind).toBe('import-extension');
    expect(readText).not.toHaveBeenCalled();
    expect(store.customCount()).toBe(0);
  });

  it.each([
    ['pusty', 0],
    ['za duży', MAX_CATEGORY_FILE_BYTES + 1],
  ])('odrzuca za duży i pusty plik bez czytania (%s)', async (_label, size) => {
    const { store, readText } = setup();
    const error = await errorOf(importQuestionSet(picked('biologia.kat', size), { store, readText }));
    expect(error.kind).toBe('import-size');
    expect(readText).not.toHaveBeenCalled();
  });

  it('przy limicie nie czyta pliku', async () => {
    const { store, readText } = setup();
    for (let i = 0; i < MAX_CUSTOM_SETS; i++) await importQuestionSet(picked(), { store, readText });
    readText.mockClear();
    const error = await errorOf(importQuestionSet(picked(), { store, readText }));
    expect(error.kind).toBe('limit');
    expect(readText).not.toHaveBeenCalled();
  });

  it('zajęta nazwa dostaje numer', async () => {
    const { store, readText } = setup();
    const first = await importQuestionSet(picked(), { store, readText });
    const second = await importQuestionSet(picked(), { store, readText });
    expect(first.name).toBe('Biologia');
    expect(second.name).toBe('Biologia (2)');
    expect(second.id).not.toBe(first.id);
  });

  it('błąd odczytu to file-read', async () => {
    const { store, readText } = setup();
    readText.mockRejectedValueOnce(new Error('EACCES'));
    const error = await errorOf(importQuestionSet(picked(), { store, readText }));
    expect(error.kind).toBe('file-read');
    expect(store.customCount()).toBe(0);
  });

  it('zły plik nic nie zapisuje', async () => {
    const { store, storage, readText } = setup('{"format":"inny"}');
    const error = await errorOf(importQuestionSet(picked(), { store, readText }));
    expect(error.kind).toBe('import-format');
    expect(storage.writes).toBe(0);
  });

  it('loguje liczby, a nie treść pytań', async () => {
    const { store, readText } = setup();
    await importQuestionSet(picked(), { store, readText });
    const entry = getLogEntries().find((e) => e.message === 'Importuję kategorię');
    expect(entry?.data).toEqual({ questions: 30, rejected: 0, renamed: false });
  });
});

describe('exportQuestionSet', () => {
  async function withCustomSet() {
    const { store, readText } = setup();
    const set = await importQuestionSet(picked(), { store, readText });
    return { store, set };
  }

  it('zapisuje plik <nazwa>.kat ze zwykłym JSON-em', async () => {
    const { set } = await withCustomSet();
    const saveFile = jest.fn(async () => true);
    const fileName = await exportQuestionSet(set, { saveFile, now: () => new Date('2026-11-03T12:00:00.000Z') });

    expect(fileName).toBe('Biologia.kat');
    const [name, text] = saveFile.mock.calls[0] as unknown as [string, string];
    expect(name).toBe('Biologia.kat');
    expect(JSON.parse(text)).toMatchObject({ format: CATEGORY_FILE_FORMAT, name: 'Biologia', exportedAt: '2026-11-03T12:00:00.000Z' });
  });

  it('nie eksportuje kategorii domyślnej', async () => {
    const { store } = await withCustomSet();
    const saveFile = jest.fn(async () => true);
    const error = await errorOf(exportQuestionSet(store.getSet(DEFAULT_SET_ID)!, { saveFile }));
    expect(error.kind).toBe('default-set');
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('anulowany zapis to brak eksportu', async () => {
    const { set } = await withCustomSet();
    expect(await exportQuestionSet(set, { saveFile: async () => false })).toBeNull();
  });

  it('błąd zapisu to export-write', async () => {
    const { set } = await withCustomSet();
    const error = await errorOf(
      exportQuestionSet(set, {
        saveFile: async () => {
          throw new Error('brak uprawnień');
        },
      }),
    );
    expect(error.kind).toBe('export-write');
  });
});
