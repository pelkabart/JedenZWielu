import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { isMusicMuted, subscribeMusicMuted } from './musicMute';

/**
 * Głośność muzyki w rozgrywce. Lektor mówi na pełnej głośności, więc muzyka jest cicho,
 * a na czas czytania spada jeszcze bardziej (`DUCKED_VOLUME`).
 */
const GAME_VOLUME = 0.2;
const DUCKED_VOLUME = 0.06;

let player: AudioPlayer | null = null;
let ducked = false;

function currentVolume(): number {
  if (isMusicMuted()) return 0;
  return ducked ? DUCKED_VOLUME : GAME_VOLUME;
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
  if (player !== null) player.volume = currentVolume();
}

subscribeMusicMuted(() => {
  if (player !== null) player.volume = currentVolume();
});
