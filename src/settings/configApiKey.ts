import { createLogger } from '@/lib/log';

const log = createLogger('ustawienia');

const KEY_PREFIX = 'sk-';
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 300;

/** Klucz gotowy do użycia albo pusty tekst. Zły format wychodzi tu, a nie jako błąd 401 po kilku minutach generowania. */
export function resolveApiKey(raw: string | undefined): string {
  const key = raw?.trim() ?? '';
  if (key === '') {
    log.info('Brak klucza API w konfiguracji');
    return '';
  }
  const valid = !/\s/.test(key) && key.startsWith(KEY_PREFIX) && key.length >= MIN_KEY_LENGTH && key.length <= MAX_KEY_LENGTH;
  if (!valid) log.warn('Klucz API w konfiguracji ma zły format, pomijam go', { length: key.length });
  return valid ? key : '';
}

/**
 * Klucz OpenAI z pliku `.env.local` (w .gitignore, wzór: `.env.example`).
 * Expo CLI wstawia tu wartość przy budowaniu paczki, więc trzeba odwoływać się do niej dokładnie tak:
 * `process.env.EXPO_PUBLIC_OPENAI_API_KEY` (bez destrukturyzacji).
 */
export const CONFIG_API_KEY: string = resolveApiKey(process.env.EXPO_PUBLIC_OPENAI_API_KEY);
