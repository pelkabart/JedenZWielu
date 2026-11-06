import { MemoryStorage } from '@/categories/testing/fakes';
import { formatEntry, getLogEntries, resetLog } from '@/lib/log';

import { clampVolume, DEFAULT_VOLUME, parseVolumeSettings, VolumeStore } from '../VolumeStore';

beforeEach(() => resetLog());

const saved = (storage: MemoryStorage) => JSON.parse(storage.text ?? 'null');

describe('clampVolume', () => {
  it.each([
    [50, 50],
    [0, 0],
    [100, 100],
    [-10, 0],
    [250, 100],
    [33.6, 34],
    [NaN, 100],
    [Infinity, 100],
    ['70', 100],
    [null, 100],
  ])('%p → %p', (input, expected) => {
    expect(clampVolume(input)).toBe(expected);
  });

  it('zła wartość daje podaną wartość zapasową', () => {
    expect(clampVolume(undefined, 40)).toBe(40);
  });
});

describe('parseVolumeSettings', () => {
  it.each([
    ['brak pliku', null, DEFAULT_VOLUME],
    ['pusty plik', '', DEFAULT_VOLUME],
    ['ucięty JSON', '{"music": 4', DEFAULT_VOLUME],
    ['nie obiekt', '42', DEFAULT_VOLUME],
    ['null', 'null', DEFAULT_VOLUME],
    ['poprawny', '{"music": 40, "voice": 0}', { ...DEFAULT_VOLUME, music: 40, voice: 0 }],
    ['brak jednego pola', '{"voice": 30}', { ...DEFAULT_VOLUME, music: 100, voice: 30 }],
    ['tekst zamiast liczby', '{"music": "głośno", "voice": 20}', { ...DEFAULT_VOLUME, music: 100, voice: 20 }],
    ['poza zakresem i ułamki', '{"music": 250, "voice": -5.5}', { ...DEFAULT_VOLUME, music: 100, voice: 0 }],
    ['stary plik bez włączników = włączone', '{"music": 40, "voice": 60}', { music: 40, voice: 60, musicEnabled: true, voiceEnabled: true }],
    ['wyłączony lektor', '{"voice": 60, "voiceEnabled": false}', { ...DEFAULT_VOLUME, voice: 60, voiceEnabled: false }],
    ['zły typ włącznika = włączony', '{"musicEnabled": "nie", "voiceEnabled": 0}', DEFAULT_VOLUME],
  ])('%s', (_name, text, expected) => {
    expect(parseVolumeSettings(text)).toEqual(expected);
  });

  it('uszkodzony plik zostawia ostrzeżenie w logach', () => {
    parseVolumeSettings('{zepsute');
    expect(getLogEntries().some((e) => e.level === 'warn' && e.tag === 'ustawienia')).toBe(true);
  });
});

describe('VolumeStore', () => {
  it('domyślnie obie głośności na 100%', async () => {
    const store = new VolumeStore(new MemoryStorage());
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 100, voice: 100 });
    await store.load();
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 100, voice: 100 });
  });

  it('wczytuje zapisane wartości i powiadamia subskrybentów', async () => {
    const store = new VolumeStore(new MemoryStorage('{"music": 25, "voice": 60}'));
    const listener = jest.fn();
    store.subscribe(listener);
    await store.load();
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 25, voice: 60 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.isLoaded()).toBe(true);
  });

  it('load czyta plik tylko raz', async () => {
    const storage = new MemoryStorage('{"music": 25}');
    const read = jest.spyOn(storage, 'read');
    const store = new VolumeStore(storage);
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('uszkodzony plik: wartości domyślne', async () => {
    const store = new VolumeStore(new MemoryStorage('###'));
    await store.load();
    expect(store.getSettings()).toEqual(DEFAULT_VOLUME);
  });

  it('błąd odczytu: wartości domyślne i ostrzeżenie', async () => {
    const storage = new MemoryStorage();
    storage.read = async () => {
      throw new Error('EIO');
    };
    const store = new VolumeStore(storage);
    await store.load();
    expect(store.getSettings()).toEqual(DEFAULT_VOLUME);
    expect(getLogEntries().some((e) => e.level === 'warn' && formatEntry(e).includes('EIO'))).toBe(true);
  });

  it('set zmienia wartość, powiadamia i zapisuje', async () => {
    const storage = new MemoryStorage();
    const store = new VolumeStore(storage);
    const listener = jest.fn();
    store.subscribe(listener);
    await store.set('music', 40);
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 40, voice: 100 });
    expect(listener).toHaveBeenCalled();
    expect(saved(storage)).toEqual({ ...DEFAULT_VOLUME, music: 40, voice: 100 });
  });

  it('set przycina wartość do 0–100', async () => {
    const storage = new MemoryStorage();
    const store = new VolumeStore(storage);
    await store.set('voice', 140);
    await store.set('music', -3);
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 0, voice: 100 });
    expect(saved(storage)).toEqual({ ...DEFAULT_VOLUME, music: 0, voice: 100 });
  });

  it('set z NaN zostawia poprzednią wartość', async () => {
    const store = new VolumeStore(new MemoryStorage());
    await store.set('music', 30);
    await store.set('music', NaN);
    expect(store.getSettings().music).toBe(30);
  });

  it('preview nie zapisuje', async () => {
    const storage = new MemoryStorage();
    const store = new VolumeStore(storage);
    await store.load();
    store.preview('music', 10);
    store.preview('music', 20);
    await Promise.resolve();
    expect(store.getSettings().music).toBe(20);
    expect(storage.writes).toBe(0);
  });

  it('ta sama wartość nie powiadamia (ten sam obiekt dla useSyncExternalStore)', async () => {
    const store = new VolumeStore(new MemoryStorage());
    await store.load();
    const before = store.getSettings();
    const listener = jest.fn();
    store.subscribe(listener);
    store.preview('music', 100);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSettings()).toBe(before);
  });

  it('zapisy się łączą, w pliku najnowsza wartość', async () => {
    const storage = new MemoryStorage();
    const store = new VolumeStore(storage);
    await store.load();
    const all = [store.set('music', 10), store.set('music', 20), store.set('voice', 30), store.set('music', 40)];
    await Promise.all(all);
    expect(saved(storage)).toEqual({ ...DEFAULT_VOLUME, music: 40, voice: 30 });
    expect(storage.writes).toBeLessThanOrEqual(2);
  });

  it('zmiana przed wczytaniem nie zostaje nadpisana', async () => {
    const storage = new MemoryStorage('{"music": 20, "voice": 20}');
    const store = new VolumeStore(storage);
    store.preview('voice', 70);
    await store.load();
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 20, voice: 70 });
  });

  it('zapis przed wczytaniem czeka na wczytanie i zachowuje pozostałe pole z pliku', async () => {
    const storage = new MemoryStorage('{"music": 20, "voice": 20}');
    const store = new VolumeStore(storage);
    await store.set('voice', 70);
    expect(saved(storage)).toEqual({ ...DEFAULT_VOLUME, music: 20, voice: 70 });
  });

  it('błąd zapisu: głośność działa, saveFailed; udany zapis to czyści', async () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const store = new VolumeStore(storage);
    await store.set('music', 35);
    expect(store.getSettings().music).toBe(35);
    expect(store.didSaveFail()).toBe(true);
    expect(getLogEntries().some((e) => e.level === 'error' && e.tag === 'ustawienia')).toBe(true);

    storage.failWrites = false;
    await store.set('music', 45);
    expect(store.didSaveFail()).toBe(false);
    expect(saved(storage)).toEqual({ ...DEFAULT_VOLUME, music: 45, voice: 100 });
  });

  it('logi zawierają tylko liczby', async () => {
    const store = new VolumeStore(new MemoryStorage());
    await store.set('voice', 55);
    const text = getLogEntries().map(formatEntry).join('\n');
    expect(text).toContain('voice');
    expect(text).toContain('55');
  });

  it('setEnabled wyłącza i włącza dźwięk, zapisuje i zachowuje głośność suwaka', async () => {
    const storage = new MemoryStorage('{"voice": 40}');
    const store = new VolumeStore(storage);
    const listener = jest.fn();
    store.subscribe(listener);
    await store.setEnabled('voice', false);
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, voice: 40, voiceEnabled: false });
    expect(saved(storage)).toEqual({ ...DEFAULT_VOLUME, voice: 40, voiceEnabled: false });
    expect(listener).toHaveBeenCalled();
    expect(getLogEntries().some((e) => e.level === 'info' && e.message === 'Dźwięk wyłączony')).toBe(true);

    await store.setEnabled('voice', true);
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, voice: 40 });
  });

  it('wyłączenie przed wczytaniem nie zostaje nadpisane plikiem', async () => {
    const store = new VolumeStore(new MemoryStorage('{"music": 30, "musicEnabled": true}'));
    void store.setEnabled('music', false);
    await store.load();
    expect(store.getSettings()).toEqual({ ...DEFAULT_VOLUME, music: 30, musicEnabled: false });
  });

  it('ten sam stan włącznika nie powiadamia', async () => {
    const store = new VolumeStore(new MemoryStorage());
    await store.load();
    const before = store.getSettings();
    await store.setEnabled('music', true);
    expect(store.getSettings()).toBe(before);
  });
});
