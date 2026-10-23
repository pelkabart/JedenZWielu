import { createLogger } from '@/lib/log';

const log = createLogger('ustawienia');

const KEY_PREFIX = 'sk-';
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 300;

/** Jedna wartość w szyfrowanym magazynie telefonu (na urządzeniu: `expo-secure-store`). */
export interface SecretStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}

export type ApiKeyErrorKind = 'invalid' | 'storage';

/** Błąd z ekranu ustawień; `message` jest gotowy do pokazania graczowi. */
export class ApiKeyError extends Error {
  constructor(
    readonly kind: ApiKeyErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

export type ApiKeyCheck = { ok: true; key: string } | { ok: false; reason: string };

/** Sprawdza wklejony klucz, zanim trafi do magazynu (spacja na końcu dałaby błąd 401 dopiero po kilku minutach). */
export function validateApiKey(input: string): ApiKeyCheck {
  const key = input.trim();
  if (key === '') return { ok: false, reason: 'Wpisz klucz API.' };
  if (/\s/.test(key)) return { ok: false, reason: 'Klucz nie może zawierać spacji ani przejść do nowej linii.' };
  if (!key.startsWith(KEY_PREFIX)) return { ok: false, reason: `Klucz OpenAI zaczyna się od „${KEY_PREFIX}”.` };
  if (key.length < MIN_KEY_LENGTH) return { ok: false, reason: 'Klucz jest za krótki – skopiuj go w całości.' };
  if (key.length > MAX_KEY_LENGTH) return { ok: false, reason: 'Klucz jest za długi – sprawdź, co zostało wklejone.' };
  return { ok: true, key };
}

/** `sk-…abcd` – tyle wystarczy, żeby rozpoznać klucz, a nie da się go odczytać przez ramię. */
export function maskApiKey(key: string): string {
  if (key === '') return '';
  if (key.length < MIN_KEY_LENGTH) return '••••';
  return `${KEY_PREFIX}…${key.slice(-4)}`;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Klucz API OpenAI zapisany na telefonie. Zapis i usuwanie idą po kolei (po wczytaniu), a stan
 * w pamięci zmienia się dopiero po udanym zapisie. Logi mówią tylko, czy klucz jest – nigdy jaki.
 */
export class ApiKeyStore {
  private key = '';
  private loading: Promise<void> | null = null;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: SecretStorage) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Pusty tekst, gdy klucza nie ma (albo jeszcze nie wczytano). */
  getKey = (): string => this.key;

  isLoaded() {
    return this.loaded;
  }

  /** Wczytuje klucz raz; kolejne wywołania czekają na to samo wczytanie. */
  load(): Promise<void> {
    this.loading ??= this.readStorage();
    return this.loading;
  }

  /** Zapisuje klucz (przycięty) i go zwraca. */
  save(input: string): Promise<string> {
    return this.serial(async () => {
      const check = validateApiKey(input);
      if (!check.ok) throw new ApiKeyError('invalid', check.reason);
      try {
        await this.storage.write(check.key);
      } catch (error) {
        log.error('Nie udało się zapisać klucza API', { error: errorMessage(error) });
        throw new ApiKeyError('storage', 'Nie udało się zapisać klucza w pamięci telefonu.');
      }
      log.info('Zapisano klucz API', { replaced: this.key !== '' });
      this.setKey(check.key);
      return check.key;
    });
  }

  clear(): Promise<void> {
    return this.serial(async () => {
      try {
        await this.storage.remove();
      } catch (error) {
        log.error('Nie udało się usunąć klucza API', { error: errorMessage(error) });
        throw new ApiKeyError('storage', 'Nie udało się usunąć klucza z pamięci telefonu.');
      }
      log.info('Usunięto klucz API');
      this.setKey('');
    });
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.load()).then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private setKey(key: string) {
    this.key = key;
    this.listeners.forEach((listener) => listener());
  }

  private async readStorage() {
    let key = '';
    try {
      key = (await this.storage.read())?.trim() ?? '';
    } catch (error) {
      log.warn('Nie udało się odczytać klucza API', { error: errorMessage(error) });
    }
    this.loaded = true;
    log.info('Wczytano ustawienia', { saved: key !== '' });
    this.setKey(key);
  }
}
