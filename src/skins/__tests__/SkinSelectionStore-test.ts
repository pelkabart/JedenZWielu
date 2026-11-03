import { buildCatalog } from '../catalog';
import { SkinSelectionStore, type SkinStorage } from '../SkinSelectionStore';
import { skinFiles } from '../testing/fixtures';

const SKINS = buildCatalog([...skinFiles('player', '201'), ...skinFiles('player', '202')]).player;

class MemoryStorage implements SkinStorage {
  failReads = false;
  failWrites = false;
  writes: string[] = [];

  constructor(public text: string | null = null) {}

  async read() {
    if (this.failReads) throw new Error('odczyt');
    return this.text;
  }

  async write(text: string) {
    if (this.failWrites) throw new Error('zapis');
    // Pierwszy zapis trwa dłużej: kolejność musi wynikać z kolejki, a nie z czasu.
    if (this.writes.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    this.writes.push(text);
    this.text = text;
  }
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('SkinSelectionStore', () => {
  it('przed wczytaniem nie ma skórki, a bez zapisu bierze pierwszą', async () => {
    const store = new SkinSelectionStore(new MemoryStorage(), SKINS);
    expect(store.getSelected()).toBeNull();
    await store.load();
    expect(store.getSelected()?.id).toBe('player/201');
  });

  it('wybór przeżywa ponowne uruchomienie', async () => {
    const storage = new MemoryStorage();
    await new SkinSelectionStore(storage, SKINS).select('player/202');
    const next = new SkinSelectionStore(storage, SKINS);
    await next.load();
    expect(next.getSelected()?.id).toBe('player/202');
  });

  it.each([
    ['uszkodzony JSON', '{oj'],
    ['null w JSON', 'null'],
    ['zły typ', '{"skinId":5}'],
    ['usunięta skórka', '{"skinId":"player/999"}'],
  ])('%s: pierwsza skórka zamiast błędu', async (_name, text) => {
    const store = new SkinSelectionStore(new MemoryStorage(text), SKINS);
    await store.load();
    expect(store.getSelected()?.id).toBe('player/201');
  });

  it('błąd odczytu: pierwsza skórka', async () => {
    const storage = new MemoryStorage('{"skinId":"player/202"}');
    storage.failReads = true;
    const store = new SkinSelectionStore(storage, SKINS);
    await store.load();
    expect(store.getSelected()?.id).toBe('player/201');
  });

  it('błąd zapisu: wybór działa do końca sesji', async () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const store = new SkinSelectionStore(storage, SKINS);
    await expect(store.select('player/202')).resolves.toBeUndefined();
    expect(store.getSelected()?.id).toBe('player/202');
  });

  it('nieznana skórka jest ignorowana', async () => {
    const storage = new MemoryStorage();
    const store = new SkinSelectionStore(storage, SKINS);
    await store.load();
    await store.select('male/001');
    expect(store.getSelected()?.id).toBe('player/201');
    expect(storage.writes).toEqual([]);
  });

  it('szybkie wybory: ostatni wygrywa także w zapisie', async () => {
    const storage = new MemoryStorage();
    const store = new SkinSelectionStore(storage, SKINS);
    await Promise.all([store.select('player/202'), store.select('player/201')]);
    expect(store.getSelected()?.id).toBe('player/201');
    expect(JSON.parse(storage.text!)).toEqual({ skinId: 'player/201' });
  });

  it('powiadamia subskrybentów, a po wypisaniu już nie', async () => {
    const store = new SkinSelectionStore(new MemoryStorage(), SKINS);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    await store.load();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await store.select('player/202');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('brak skórek gracza nie wywraca wyboru', async () => {
    const store = new SkinSelectionStore(new MemoryStorage(), []);
    await store.load();
    expect(store.getSelected()).toBeNull();
  });
});
