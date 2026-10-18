import { createAudioPlayer } from 'expo-audio';

import type { NarrationPlayer } from './NarrationDirector';

/** Odtwarzacz lektora na `expo-audio` (jest w Expo Go). Jeden na ekran gry; zwalniany w `dispose`. */
export function createExpoNarrationPlayer(): NarrationPlayer {
  const player = createAudioPlayer(null);
  return {
    play(source) {
      // `replace` wczytuje plik od początku, a `play` ruszy, gdy plik będzie gotowy.
      player.replace(source);
      player.play();
    },
    pause: () => player.pause(),
    resume: () => player.play(),
    stop: () => player.pause(),
    dispose: () => player.remove(),
  };
}
