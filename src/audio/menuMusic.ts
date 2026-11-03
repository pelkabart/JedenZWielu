import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { createLogger } from '@/lib/log';
import { volumeStore } from '@/settings/volume';

import { isMusicMuted, subscribeMusicMuted } from './musicMute';
import { musicGain } from './volume';

const log = createLogger('muzyka');

/** Głośność muzyki w menu (0–1) przy 100% w ustawieniach. Nie za głośno, żeby nie zagłuszała lektora w grze. */
const MENU_VOLUME = 0.3;
/** Zwłoka przed pauzą: przejście między ekranami menu nie przerywa melodii. */
const PAUSE_DELAY_MS = 400;

/**
 * Jeden odtwarzacz dla całego menu (główne menu i wybór poziomu), żeby melodia
 * płynęła dalej przy przejściu, zamiast zaczynać się od początku.
 */
let player: AudioPlayer | null = null;
let activeScreens = 0;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

function currentVolume(): number {
  return musicGain(MENU_VOLUME, volumeStore.getSettings(), isMusicMuted());
}

function applyVolume() {
  if (player !== null) player.volume = currentVolume();
}

function getPlayer(): AudioPlayer {
  if (player === null) {
    player = createAudioPlayer(require('../../assets/audio/menu.mp3'));
    player.loop = true;
    player.volume = currentVolume();
  }
  return player;
}

// Wyciszenie i suwak w ustawieniach zmieniają głośność już działającego odtwarzacza.
subscribeMusicMuted(applyVolume);
volumeStore.subscribe(applyVolume);

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
