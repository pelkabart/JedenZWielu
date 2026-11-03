import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { volumeStore } from '@/settings/volume';

import { musicGain } from './volume';

/**
 * Głośność muzyki w rozgrywce przy 100% w ustawieniach. Lektor mówi głośniej, więc muzyka jest cicho,
 * a na czas czytania spada jeszcze bardziej (`DUCKED_VOLUME`). Suwak „Muzyka” skaluje oba poziomy.
 */
const GAME_VOLUME = 0.22;
const DUCKED_VOLUME = 0.066;

let player: AudioPlayer | null = null;
let ducked = false;

function currentVolume(): number {
  return musicGain(ducked ? DUCKED_VOLUME : GAME_VOLUME, volumeStore.getSettings());
}

function applyVolume() {
  if (player !== null) player.volume = currentVolume();
}

function getPlayer(): AudioPlayer {
  if (player === null) {
    player = createAudioPlayer(require('../../assets/audio/gra.mp3'));
    player.loop = true;
    player.volume = currentVolume();
  }
  return player;
}

/** Rozgrywka gra: muzyka wznawia się tam, gdzie była. */
export function startGameMusic() {
  getPlayer().play();
}

/** Pauza gry albo wyjście z rozgrywki. */
export function stopGameMusic() {
  player?.pause();
}

/** Czy lektor mówi: wtedy muzyka cichnie, żeby nie zagłuszać pytań. */
export function setGameMusicDucked(value: boolean) {
  ducked = value;
  applyVolume();
}

// Suwak w ustawieniach zmienia głośność już działającego odtwarzacza.
volumeStore.subscribe(applyVolume);
