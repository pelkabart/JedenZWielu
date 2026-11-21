import type { TextStorage } from '@/categories/QuestionSetStore';
import { createLogger } from '@/lib/log';

import { NICK_MAX } from './nick';

const log = createLogger('multiplayer');

/** Ostatni wpisany nick (żeby nie wpisywać go przy każdej grze). Zły albo brakujący plik = pusty tekst. */
export async function loadNick(storage: TextStorage): Promise<string> {
  try {
    const text = await storage.read();
    if (!text) return '';
    const data: unknown = JSON.parse(text);
    const nick = typeof data === 'object' && data !== null ? (data as { nick?: unknown }).nick : undefined;
    return typeof nick === 'string' ? nick.slice(0, NICK_MAX) : '';
  } catch (e) {
    log.warn('Nie udało się wczytać nicku', { error: e instanceof Error ? e.message : 'unknown' });
    return '';
  }
}

/** Zapisuje nick. Błąd zapisu nie przerywa gry, tylko trafia do logów. */
export async function saveNick(storage: TextStorage, nick: string): Promise<void> {
  try {
    await storage.write(JSON.stringify({ nick }));
  } catch (e) {
    log.warn('Nie udało się zapisać nicku', { error: e instanceof Error ? e.message : 'unknown' });
  }
}
