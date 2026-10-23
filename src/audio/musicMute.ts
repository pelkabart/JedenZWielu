import { createLogger } from '@/lib/log';

const log = createLogger('muzyka');

/** Wyciszenie muzyki dla całej aplikacji: wspólne dla menu i rozgrywki. */
let muted = false;
const listeners = new Set<() => void>();

export function isMusicMuted(): boolean {
  return muted;
}

/** Przełącza wyciszenie. Muzyka dalej płynie na zerowej głośności, więc po włączeniu gra od tego samego miejsca. */
export function toggleMusicMuted() {
  muted = !muted;
  log.info('Muzyka', { muted });
  for (const listener of listeners) listener();
}

export function subscribeMusicMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
