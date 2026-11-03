import { createLogger } from '@/lib/log';

import type { Skin } from './catalog';

const log = createLogger('skorki');

/** Jedna wartość tekstowa zapisana na telefonie; zgodna z `fileStorage`. */
export interface SkinStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Skórka wybrana przez gracza. To tylko wygląd, więc błąd magazynu nigdy nie blokuje gry. */
export class SkinSelectionStore {
  private selected: Skin | null = null;
  private loading: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: SkinStorage,
    private readonly skins: readonly Skin[],
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** `null` przed wczytaniem albo gdy nie ma żadnej skórki gracza. */
  getSelected = (): Skin | null => this.selected;

  /** Wczytuje wybór raz; kolejne wywołania czekają na to samo wczytanie. */
  load(): Promise<void> {
    this.loading ??= this.readStorage();
    return this.loading;
  }

  /** Zmienia skórkę na ekranie jeszcze przed zapisem; zapisy idą po kolei, żeby starszy nie nadpisał nowszego. */
  select(id: string): Promise<void> {
    const skin = this.skins.find((candidate) => candidate.id === id);
    if (!skin) {
      log.warn('Nieznana skórka', { id });
      return Promise.resolve();
    }
    const run = this.queue
      .then(() => this.load())
      .then(async () => {
        this.setSelected(skin);
        try {
          await this.storage.write(JSON.stringify({ skinId: skin.id }));
          log.info('Wybrano skórkę', { id: skin.id });
        } catch (error) {
          log.warn('Nie udało się zapisać skórki', { error: errorMessage(error) });
        }
      });
    this.queue = run;
    return run;
  }

  private setSelected(skin: Skin | null) {
    this.selected = skin;
    this.listeners.forEach((listener) => listener());
  }

  private async readStorage() {
    let savedId: unknown = null;
    try {
      const text = await this.storage.read();
      if (text !== null) savedId = (JSON.parse(text) as { skinId?: unknown } | null)?.skinId ?? null;
    } catch (error) {
      log.warn('Nie udało się odczytać skórki', { error: errorMessage(error) });
    }
    const saved = this.skins.find((skin) => skin.id === savedId);
    if (savedId !== null && !saved) log.warn('Zapisanej skórki już nie ma', { savedId: String(savedId) });
    this.setSelected(saved ?? this.skins[0] ?? null);
  }
}
