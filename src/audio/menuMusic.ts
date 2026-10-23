import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { createLogger } from '@/lib/log';

const log = createLogger('muzyka');

/** Głośność muzyki w menu (0–1). Nie za głośno, żeby nie zagłuszała lektora w grze. */
const MENU_VOLUME = 0.4;
/** Zwłoka przed pauzą: przejście między ekranami menu nie przerywa melodii. */
const PAUSE_DELAY_MS = 400;

/**
 * Jeden odtwarzacz dla całego menu (główne menu i wybór poziomu), żeby melodia
 * płynęła dalej przy przejściu, zamiast zaczynać się od początku.
 */
let player: AudioPlayer | null = null;
let activeScreens = 0;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
/** Wyciszenie muzyki dla całej aplikacji (także dla przyszłej muzyki w grze). */
let muted = false;
const muteListeners = new Set<() => void>();

function currentVolume(): number {
  return muted ? 0 : MENU_VOLUME;
}

function getPlayer(): AudioPlayer {
  if (player === null) {
    player = createAudioPlayer(require('../../assets/audio/menu.mp3'));
    player.loop = true;
    player.volume = currentVolume();
  }
  return player;
}

export function isMusicMuted(): boolean {
  return muted;
}

/** Przełącza wyciszenie. Melodia dalej płynie na zerowej głośności, więc po włączeniu gra od tego samego miejsca. */
export function toggleMusicMuted() {
  muted = !muted;
  if (player !== null) player.volume = currentVolume();
  log.info('Muzyka', { muted });
  for (const listener of muteListeners) listener();
}

export function subscribeMusicMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

/** Ekran menu jest na wierzchu: muzyka gra (wznawia się tam, gdzie była). */
export function acquireMenuMusic() {
  activeScreens++;
  if (pauseTimer !== null) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
  getPlayer().play();
  log.debug('Muzyka menu: gra', { screens: activeScreens });
}

/** Ekran menu zszedł z wierzchu. Jeśli żaden nie jest aktywny, muzyka pauzuje po krótkiej zwłoce. */
export function releaseMenuMusic() {
  activeScreens = Math.max(0, activeScreens - 1);
  if (activeScreens > 0 || pauseTimer !== null) return;
  pauseTimer = setTimeout(() => {
    pauseTimer = null;
    if (activeScreens === 0) {
      getPlayer().pause();
      log.debug('Muzyka menu: pauza');
    }
  }, PAUSE_DELAY_MS);
}
