import type { TextStorage } from '@/categories/QuestionSetStore';
import { createLogger } from '@/lib/log';

const log = createLogger('ustawienia');

export type VolumeKind = 'music' | 'voice';

/**
 * Głośność w procentach (0–100, liczby całkowite). 100 = dotychczasowy poziom danego dźwięku.
 * `…Enabled = false` wycisza dźwięk całkiem, a zapamiętana głośność wraca po ponownym włączeniu.
 */
export interface VolumeSettings {
  music: number;
  voice: number;
  musicEnabled: boolean;
  voiceEnabled: boolean;
}

type SettingKey = keyof VolumeSettings;

export const DEFAULT_VOLUME: VolumeSettings = { music: 100, voice: 100, musicEnabled: true, voiceEnabled: true };

const KEYS: SettingKey[] = ['music', 'voice', 'musicEnabled', 'voiceEnabled'];

const ENABLED_KEY = { music: 'musicEnabled', voice: 'voiceEnabled' } as const satisfies Record<VolumeKind, SettingKey>;

/** Czy dany dźwięk jest włączony. */
export function isEnabled(settings: VolumeSettings, kind: VolumeKind): boolean {
  return settings[ENABLED_KEY[kind]];
}

/** Przycina do 0–100 i zaokrągla; `NaN` i nieliczby dają `fallback`. */
export function clampVolume(value: unknown, fallback = 100): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Czyta zapisane ustawienia; każde pole osobno, zły format = wartość domyślna. */
export function parseVolumeSettings(text: string | null): VolumeSettings {
  if (text === null || text.trim() === '') return { ...DEFAULT_VOLUME };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    log.warn('Uszkodzony plik głośności – wartości domyślne');
    return { ...DEFAULT_VOLUME };
  }
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  // Brak pola albo zły typ (np. stary plik sprzed włącznika) = dźwięk włączony.
  const flag = (value: unknown) => (typeof value === 'boolean' ? value : true);
  return {
    music: clampVolume(record.music, DEFAULT_VOLUME.music),
    voice: clampVolume(record.voice, DEFAULT_VOLUME.voice),
    musicEnabled: flag(record.musicEnabled),
    voiceEnabled: flag(record.voiceEnabled),
  };
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Głośność muzyki i lektora zapisana na telefonie. `preview` zmienia tylko pamięć (suwak w ruchu),
 * `set` także zapisuje. Zapisy idą po kolei i łączą się: gdy zapis trwa, następny zapisze najnowszy stan.
 */
export class VolumeStore {
  private settings: VolumeSettings = { ...DEFAULT_VOLUME };
  private loading: Promise<void> | null = null;
  private loaded = false;
  /** Pola zmienione przez gracza przed wczytaniem pliku – wczytanie ich nie nadpisuje. */
  private readonly touched = new Set<SettingKey>();
  private saving: Promise<void> | null = null;
  private dirty = false;
  private saveFailed = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: TextStorage) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Ten sam obiekt, dopóki nic się nie zmieni (dla `useSyncExternalStore`). */
  getSettings = (): VolumeSettings => this.settings;

  /** Czy ostatni zapis się nie udał (ustawienie działa, ale nie przetrwa ponownego uruchomienia). */
  didSaveFail = () => this.saveFailed;

  isLoaded() {
    return this.loaded;
  }

  /** Wczytuje ustawienia raz; kolejne wywołania czekają na to samo wczytanie. */
  load(): Promise<void> {
    this.loading ??= this.readStorage();
    return this.loading;
  }

  /** Zmiana w trakcie przesuwania suwaka: od razu słychać, bez zapisu. */
  preview(kind: VolumeKind, value: number) {
    this.update(kind, value);
  }

  /** Zmiana ostateczna (puszczony suwak): od razu słychać i zapisuje się na telefonie. */
  set(kind: VolumeKind, value: number): Promise<void> {
    this.update(kind, value);
    log.info('Głośność', { kind, value: this.settings[kind] });
    return this.save();
  }

  /** Włącza albo wyłącza dźwięk (przełącznik w ustawieniach) i zapisuje. Głośność suwaka zostaje. */
  setEnabled(kind: VolumeKind, enabled: boolean): Promise<void> {
    this.change(ENABLED_KEY[kind], enabled);
    log.info(enabled ? 'Dźwięk włączony' : 'Dźwięk wyłączony', { kind });
    return this.save();
  }

  /** Zapisuje bieżący stan. Gdy zapis już trwa, zapisze najnowszy stan zaraz po nim. */
  save(): Promise<void> {
    if (this.saving !== null) {
      this.dirty = true;
      return this.saving;
    }
    this.saving = (async () => {
      await this.load();
      do {
        this.dirty = false;
        await this.write();
      } while (this.dirty);
      this.saving = null;
    })();
    return this.saving;
  }

  private async write() {
    const snapshot = this.settings;
    try {
      await this.storage.write(JSON.stringify(snapshot));
      this.setSaveFailed(false);
      log.debug('Zapisano głośność', { ...snapshot });
    } catch (error) {
      log.error('Nie udało się zapisać głośności', { error: errorMessage(error) });
      this.setSaveFailed(true);
    }
  }

  private update(kind: VolumeKind, value: number) {
    this.change(kind, clampVolume(value, this.settings[kind]));
  }

  private change<K extends SettingKey>(key: K, value: VolumeSettings[K]) {
    if (!this.loaded) this.touched.add(key);
    if (value === this.settings[key]) return;
    this.settings = { ...this.settings, [key]: value };
    this.notify();
  }

  private setSaveFailed(value: boolean) {
    if (this.saveFailed === value) return;
    this.saveFailed = value;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private async readStorage() {
    let saved: VolumeSettings = { ...DEFAULT_VOLUME };
    try {
      saved = parseVolumeSettings(await this.storage.read());
    } catch (error) {
      log.warn('Nie udało się odczytać głośności', { error: errorMessage(error) });
    }
    this.loaded = true;
    const next: VolumeSettings = { ...this.settings };
    for (const key of KEYS) if (!this.touched.has(key)) Object.assign(next, { [key]: saved[key] });
    log.info('Wczytano głośność', { ...next, keptUserChanges: this.touched.size });
    if (KEYS.some((key) => next[key] !== this.settings[key])) {
      this.settings = next;
      this.notify();
    }
  }
}
