import { getLogEntries, resetLog } from '@/lib/log';
import { TEST_BANK } from '@/game/testing/fixtures';
import type { Question } from '@/game/types';

import { CategoryError } from '../errors';
import { QuestionSetStore, STORAGE_VERSION, validateSetName } from '../QuestionSetStore';
import { MemoryStorage } from '../testing/fakes';
import { DEFAULT_SET_ID, DEFAULT_SET_NAME, MAX_CUSTOM_SETS, type QuestionSet } from '../types';

const custom = (prefix: string, count = 5): Question[] =>
  TEST_BANK.slice(0, count).map((q, i) => ({ ...q, id: `${prefix}-${i}`, question: `${prefix}: ${q.question}` }));

function newStore(storage = new MemoryStorage()) {
  let clock = 1_000;
  const store = new QuestionSetStore({ storage, defaultQuestions: TEST_BANK, now: () => clock++ });
  return { store, storage };
}

async function loaded(storage = new MemoryStorage()) {
  const result = newStore(storage);
  await result.store.load();
  return result;
}

async function errorOf(promise: Promise<unknown>): Promise<CategoryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CategoryError) return error;
    throw new Error(`Oczekiwano CategoryError, jest ${String(error)}`);
  }
  throw new Error('Oczekiwano błędu');
}

beforeEach(() => resetLog());

describe('kategoria domyślna', () => {
  it('jest pierwsza na liście, także przed wczytaniem zapisu', () => {
    const { store } = newStore();
    expect(store.getSets()).toHaveLength(1);
    expect(store.getSets()[0]).toEqual(
      expect.objectContaining({ id: DEFAULT_SET_ID, name: DEFAULT_SET_NAME, builtIn: true, questions: TEST_BANK }),
    );
  });

  it('domyślnej nie da się usunąć', async () => {
    const { store } = await loaded();
    expect((await errorOf(store.remove(DEFAULT_SET_ID))).kind).toBe('default-set');
    expect(store.getSets()[0].id).toBe(DEFAULT_SET_ID);
  });

  it('nie jest zapisywana w pamięci telefonu', async () => {
    const { store, storage } = await loaded();
    await store.add({ name: 'Moja', questions: custom('a'), sourceFiles: ['a.pdf'] });
    const saved = JSON.parse(storage.text ?? '{}');
    expect(saved.sets.map((s: QuestionSet) => s.name)).toEqual(['Moja']);
  });
});

describe('dodawanie i usuwanie', () => {
  it('dodaje zestaw za domyślnym, z nowymi id pytań i datą', async () => {
    const { store } = await loaded();
    const set = await store.add({ name: '  Biologia ', questions: custom('x'), sourceFiles: ['bio.pdf'] });

    expect(set.name).toBe('Biologia');
    expect(set.builtIn).toBe(false);
    expect(set.sourceFiles).toEqual(['bio.pdf']);
    expect(set.createdAt).toEqual(expect.any(Number));
    expect(set.id).not.toBe(DEFAULT_SET_ID);
    expect(set.questions.every((q) => q.id.startsWith(`${set.id}-`))).toBe(true);
    expect(new Set(set.questions.map((q) => q.id)).size).toBe(set.questions.length);
    expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Biologia']);
  });

  it('nadaje różne id zestawom dodanym jeden po drugim', async () => {
    const { store } = await loaded();
    const a = await store.add({ name: 'A', questions: custom('a'), sourceFiles: [] });
    const b = await store.add({ name: 'B', questions: custom('b'), sourceFiles: [] });
    expect(a.id).not.toBe(b.id);
  });

  it(`pozwala dodać ${MAX_CUSTOM_SETS} własne zestawy`, async () => {
    const { store } = await loaded();
    for (let i = 0; i < MAX_CUSTOM_SETS; i++) {
      expect(store.canAddMore()).toBe(true);
      await store.add({ name: `Zestaw ${i}`, questions: custom(`s${i}`), sourceFiles: [] });
    }
    expect(store.customCount()).toBe(MAX_CUSTOM_SETS);
    expect(store.canAddMore()).toBe(false);
  });

  it('nie pozwala dodać czwartego zestawu', async () => {
    const { store, storage } = await loaded();
    for (let i = 0; i < MAX_CUSTOM_SETS; i++) {
      await store.add({ name: `Zestaw ${i}`, questions: custom(`s${i}`), sourceFiles: [] });
    }
    const writes = storage.writes;
    expect((await errorOf(store.add({ name: 'Czwarty', questions: custom('d'), sourceFiles: [] }))).kind).toBe('limit');
    expect(store.customCount()).toBe(MAX_CUSTOM_SETS);
    expect(storage.writes).toBe(writes);
  });

  it('dwa jednoczesne dodania przy dwóch zestawach: przechodzi tylko jedno', async () => {
    const { store } = await loaded();
    await store.add({ name: 'A', questions: custom('a'), sourceFiles: [] });
    await store.add({ name: 'B', questions: custom('b'), sourceFiles: [] });

    const results = await Promise.allSettled([
      store.add({ name: 'C', questions: custom('c'), sourceFiles: [] }),
      store.add({ name: 'D', questions: custom('d'), sourceFiles: [] }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(store.customCount()).toBe(MAX_CUSTOM_SETS);
  });

  it('po usunięciu zestawu można dodać kolejny', async () => {
    const { store } = await loaded();
    const sets = [];
    for (let i = 0; i < MAX_CUSTOM_SETS; i++) {
      sets.push(await store.add({ name: `Zestaw ${i}`, questions: custom(`s${i}`), sourceFiles: [] }));
    }
    await store.remove(sets[1].id);
    expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Zestaw 0', 'Zestaw 2']);
    expect(store.canAddMore()).toBe(true);
    await store.add({ name: 'Nowy', questions: custom('n'), sourceFiles: [] });
    expect(store.customCount()).toBe(MAX_CUSTOM_SETS);
  });

  it('usunięcie nieistniejącego zestawu → not-found', async () => {
    const { store } = await loaded();
    expect((await errorOf(store.remove('nie-ma'))).kind).toBe('not-found');
  });

  it('zestaw bez pytań jest odrzucany', async () => {
    const { store } = await loaded();
    expect((await errorOf(store.add({ name: 'Pusty', questions: [], sourceFiles: [] }))).kind).toBe('no-questions');
  });

  it('zła nazwa jest odrzucana', async () => {
    const { store } = await loaded();
    await store.add({ name: 'Biologia', questions: custom('a'), sourceFiles: [] });
    expect((await errorOf(store.add({ name: 'BIOLOGIA', questions: custom('b'), sourceFiles: [] }))).kind).toBe('name');
  });

  it('błąd zapisu: zestaw nie jest dodany, a błąd to storage', async () => {
    const { store, storage } = await loaded();
    storage.failWrites = true;
    expect((await errorOf(store.add({ name: 'A', questions: custom('a'), sourceFiles: [] }))).kind).toBe('storage');
    expect(store.customCount()).toBe(0);
    expect(getLogEntries({ tag: 'kategorie', minLevel: 'error' })).toHaveLength(1);
  });

  it('powiadamia subskrybentów i zmienia referencję listy tylko przy zmianie', async () => {
    const { store } = await loaded();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSets();
    expect(store.getSets()).toBe(before);

    const set = await store.add({ name: 'A', questions: custom('a'), sourceFiles: [] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSets()).not.toBe(before);

    unsubscribe();
    await store.remove(set.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('zapis na telefonie', () => {
  it('zestawy przeżywają ponowne uruchomienie', async () => {
    const { store, storage } = await loaded();
    const set = await store.add({ name: 'Chemia', questions: custom('c'), sourceFiles: ['chem.pdf'] });

    const { store: restarted } = await loaded(storage);
    expect(restarted.getSets()).toEqual([store.getSets()[0], set]);
  });

  it('load jest idempotentne i wczytuje zapis raz', async () => {
    const storage = new MemoryStorage();
    const read = jest.spyOn(storage, 'read');
    const { store } = newStore(storage);
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.isLoaded()).toBe(true);
  });

  it('add przed load najpierw wczytuje zapis (nie nadpisuje starych zestawów)', async () => {
    const { storage } = await loaded();
    const { store: first } = newStore(storage);
    await first.load();
    await first.add({ name: 'Stary', questions: custom('s'), sourceFiles: [] });

    const { store } = newStore(storage);
    await store.add({ name: 'Nowy', questions: custom('n'), sourceFiles: [] });
    expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Stary', 'Nowy']);
  });

  it('loguje liczbę wczytanych zestawów', async () => {
    const storage = new MemoryStorage();
    const { store } = await loaded(storage);
    await store.add({ name: 'A', questions: custom('a'), sourceFiles: [] });
    resetLog();
    await loaded(storage);
    expect(getLogEntries({ tag: 'kategorie' })).toEqual([
      expect.objectContaining({ level: 'info', message: 'Wczytano kategorie', data: { custom: 1 } }),
    ]);
  });

  describe('uszkodzony zapis', () => {
    const validSet = (id: string, name: string) => ({
      id,
      name,
      builtIn: false,
      createdAt: 5,
      sourceFiles: [],
      questions: custom(id),
    });

    it.each([
      ['zły JSON', '{"version": 1, "sets": ['],
      ['nieznana wersja', JSON.stringify({ version: 999, sets: [] })],
      ['brak tablicy', JSON.stringify({ version: STORAGE_VERSION })],
      ['nie obiekt', '"tekst"'],
    ])('%s: same domyślne pytania i ostrzeżenie', async (_, text) => {
      const { store } = await loaded(new MemoryStorage(text));
      expect(store.getSets().map((s) => s.id)).toEqual([DEFAULT_SET_ID]);
      expect(getLogEntries({ tag: 'kategorie', minLevel: 'warn' })).toHaveLength(1);
    });

    it('pomija pojedynczy zepsuty zestaw, pozostałe zostają', async () => {
      const broken = { ...validSet('b', 'Zepsuty'), questions: [{ id: 'q', question: '' }] };
      const text = JSON.stringify({ version: STORAGE_VERSION, sets: [validSet('a', 'Dobry'), broken, { name: 7 }] });
      const { store } = await loaded(new MemoryStorage(text));
      expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Dobry']);
      expect(getLogEntries({ tag: 'kategorie', minLevel: 'warn' })).toHaveLength(2);
    });

    it('zapis z więcej niż trzema zestawami: wczytuje pierwsze trzy', async () => {
      const sets = ['a', 'b', 'c', 'd'].map((id) => validSet(id, `Zestaw ${id}`));
      const { store } = await loaded(new MemoryStorage(JSON.stringify({ version: STORAGE_VERSION, sets })));
      expect(store.customCount()).toBe(MAX_CUSTOM_SETS);
    });

    it('błąd odczytu: same domyślne pytania', async () => {
      const storage = new MemoryStorage();
      storage.read = async () => {
        throw new Error('Brak dostępu');
      };
      const { store } = await loaded(storage);
      expect(store.getSets().map((s) => s.id)).toEqual([DEFAULT_SET_ID]);
      expect(store.isLoaded()).toBe(true);
    });
  });
});

describe('questionsForSet', () => {
  it('zwraca pytania wybranego zestawu', async () => {
    const { store } = await loaded();
    const set = await store.add({ name: 'A', questions: custom('a', 7), sourceFiles: [] });
    expect(store.questionsForSet(set.id)).toBe(set.questions);
    expect(store.questionsForSet(DEFAULT_SET_ID)).toBe(TEST_BANK);
  });

  it('nieznany zestaw: pytania domyślne', async () => {
    const { store } = await loaded();
    expect(store.questionsForSet('usuniety')).toBe(TEST_BANK);
    expect(getLogEntries({ tag: 'kategorie', minLevel: 'warn' })).toEqual([
      expect.objectContaining({ data: { setId: 'usuniety' } }),
    ]);
  });
});

describe('validateSetName', () => {
  const existing: QuestionSet[] = [
    { id: DEFAULT_SET_ID, name: DEFAULT_SET_NAME, builtIn: true, createdAt: null, sourceFiles: [], questions: [] },
    { id: 'z', name: 'Żywienie', builtIn: false, createdAt: 1, sourceFiles: [], questions: [] },
  ];

  it('przycina spacje i przyjmuje nazwę do 30 znaków', () => {
    expect(validateSetName('  Biologia  ', existing)).toEqual({ ok: true, name: 'Biologia' });
    expect(validateSetName('x'.repeat(30), existing)).toEqual({ ok: true, name: 'x'.repeat(30) });
  });

  it.each([
    ['pusta', ''],
    ['same spacje', '    '],
    ['za długa', 'x'.repeat(31)],
    ['zajęta (inna wielkość liter)', 'żywienie'],
    ['zajęta (bez polskich znaków)', 'Zywienie'],
    ['nazwa domyślnej', 'domyslna'],
  ])('odrzuca: %s', (_, name) => {
    const result = validateSetName(name, existing);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toBe('');
  });
});
