import { formatEntry, getLogEntries, resetLog } from '@/lib/log';

import { ApiKeyError, ApiKeyStore, maskApiKey, validateApiKey } from '../ApiKeyStore';
import { MemorySecretStorage, VALID_KEY } from '../testing/fakes';

async function loaded(storage = new MemorySecretStorage()) {
  const store = new ApiKeyStore(storage);
  await store.load();
  return { store, storage };
}

async function errorOf(promise: Promise<unknown>): Promise<ApiKeyError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiKeyError) return error;
    throw new Error(`Oczekiwano ApiKeyError, jest ${String(error)}`);
  }
  throw new Error('Oczekiwano błędu');
}

beforeEach(() => resetLog());

describe('validateApiKey', () => {
  it('przycina spacje i znaki nowej linii', () => {
    expect(validateApiKey(`  ${VALID_KEY}\n`)).toEqual({ ok: true, key: VALID_KEY });
  });

  it.each([
    ['pusty', ''],
    ['same spacje', '   '],
    ['spacja w środku', 'sk-proj-abc def0123456789xyz'],
    ['bez sk-', 'pk-proj-0123456789abcdefghij'],
    ['za krótki', 'sk-123'],
    ['za długi', `sk-${'a'.repeat(400)}`],
  ])('odrzuca: %s', (_, input) => {
    const result = validateApiKey(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe('maskApiKey', () => {
  it('pokazuje tylko początek i 4 ostatnie znaki', () => {
    expect(maskApiKey(VALID_KEY)).toBe('sk-…WXYZ');
    expect(maskApiKey(VALID_KEY)).not.toContain('TESTOWY');
  });

  it('pusty klucz: pusty tekst', () => {
    expect(maskApiKey('')).toBe('');
  });

  it('krótki tekst nie zdradza żadnego znaku', () => {
    expect(maskApiKey('sk-abc')).toBe('••••');
  });
});

describe('ApiKeyStore', () => {
  it('przed wczytaniem nie ma klucza', () => {
    const store = new ApiKeyStore(new MemorySecretStorage(VALID_KEY));
    expect(store.isLoaded()).toBe(false);
    expect(store.getKey()).toBe('');
  });

  it('wczytuje klucz zapisany na telefonie', async () => {
    const { store } = await loaded(new MemorySecretStorage(VALID_KEY));
    expect(store.isLoaded()).toBe(true);
    expect(store.getKey()).toBe(VALID_KEY);
  });

  it('load jest jednorazowy', async () => {
    const storage = new MemorySecretStorage(VALID_KEY);
    const read = jest.spyOn(storage, 'read');
    const store = new ApiKeyStore(storage);
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('zapisuje przycięty klucz w magazynie', async () => {
    const { store, storage } = await loaded();
    await expect(store.save(` ${VALID_KEY} `)).resolves.toBe(VALID_KEY);
    expect(storage.value).toBe(VALID_KEY);
    expect(store.getKey()).toBe(VALID_KEY);
  });

  it('po ponownym uruchomieniu klucz dalej jest', async () => {
    const first = await loaded();
    await first.store.save(VALID_KEY);
    const { store } = await loaded(first.storage);
    expect(store.getKey()).toBe(VALID_KEY);
  });

  it('niepoprawny klucz: błąd invalid, nic nie jest zapisywane', async () => {
    const { store, storage } = await loaded();
    const error = await errorOf(store.save('hasło'));
    expect(error.kind).toBe('invalid');
    expect(storage.writes).toBe(0);
    expect(store.getKey()).toBe('');
  });

  it('usuwa klucz', async () => {
    const { store, storage } = await loaded(new MemorySecretStorage(VALID_KEY));
    await store.clear();
    expect(storage.value).toBeNull();
    expect(store.getKey()).toBe('');
  });

  it('zapis przed load najpierw czeka na wczytanie (stary zapis nie nadpisuje nowego klucza)', async () => {
    const storage = new MemorySecretStorage('sk-stary-0123456789abcdefgh');
    const store = new ApiKeyStore(storage);
    await store.save(VALID_KEY);
    await store.load();
    expect(store.getKey()).toBe(VALID_KEY);
  });

  it('zapis i usunięcie po sobie: wygrywa ostatnie', async () => {
    const { store, storage } = await loaded();
    await Promise.all([store.save(VALID_KEY), store.clear()]);
    expect(storage.value).toBeNull();
    expect(store.getKey()).toBe('');

    await Promise.all([store.clear(), store.save(VALID_KEY)]);
    expect(storage.value).toBe(VALID_KEY);
    expect(store.getKey()).toBe(VALID_KEY);
  });

  it('powiadamia subskrybentów o wczytaniu, zapisie i usunięciu', async () => {
    const store = new ApiKeyStore(new MemorySecretStorage());
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    await store.load();
    await store.save(VALID_KEY);
    await store.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    await store.save(VALID_KEY);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  describe('błędy magazynu', () => {
    it('błąd odczytu: brak klucza i ostrzeżenie', async () => {
      const storage = new MemorySecretStorage(VALID_KEY);
      storage.failReads = true;
      const { store } = await loaded(storage);
      expect(store.isLoaded()).toBe(true);
      expect(store.getKey()).toBe('');
      expect(getLogEntries({ tag: 'ustawienia', minLevel: 'warn' })).toHaveLength(1);
    });

    it('błąd zapisu: stary klucz zostaje', async () => {
      const old = 'sk-stary-0123456789abcdefgh';
      const { store, storage } = await loaded(new MemorySecretStorage(old));
      storage.failWrites = true;
      const error = await errorOf(store.save(VALID_KEY));
      expect(error.kind).toBe('storage');
      expect(store.getKey()).toBe(old);
      expect(storage.value).toBe(old);
    });

    it('błąd usuwania: klucz zostaje', async () => {
      const { store, storage } = await loaded(new MemorySecretStorage(VALID_KEY));
      storage.failRemoves = true;
      const error = await errorOf(store.clear());
      expect(error.kind).toBe('storage');
      expect(store.getKey()).toBe(VALID_KEY);
    });

    it('po błędzie kolejka działa dalej', async () => {
      const { store, storage } = await loaded();
      storage.failWrites = true;
      await errorOf(store.save(VALID_KEY));
      storage.failWrites = false;
      await store.save(VALID_KEY);
      expect(store.getKey()).toBe(VALID_KEY);
    });
  });

  it('klucz nie trafia do logów', async () => {
    const storage = new MemorySecretStorage(VALID_KEY);
    const { store } = await loaded(storage);
    await store.save(VALID_KEY);
    await errorOf(store.save(`${VALID_KEY} x`));
    storage.failWrites = true;
    await errorOf(store.save(VALID_KEY));
    await store.clear();

    const entries = getLogEntries({ tag: 'ustawienia' });
    expect(entries.length).toBeGreaterThanOrEqual(3);
    const dump = entries.map(formatEntry).join('\n');
    expect(dump).not.toContain(VALID_KEY);
    expect(dump).not.toContain('TESTOWY');
  });
});
