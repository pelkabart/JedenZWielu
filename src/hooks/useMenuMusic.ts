import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useEffect } from 'react';

import { createLogger } from '@/lib/log';

const log = createLogger('muzyka');

/** Głośność muzyki w menu (0–1). Nie za głośno, żeby nie zagłuszała lektora w grze. */
const MENU_VOLUME = 0.4;

/** Pętla i głośność ustawiane na odtwarzaczu, który już istnieje (nie w renderze). */
function configureLoop(player: AudioPlayer) {
  player.loop = true;
  player.volume = MENU_VOLUME;
}

/**
 * Muzyka w tle menu i wyboru poziomu. Gra gdy ekran jest na wierzchu, a pauzuje, gdy gracz
 * wchodzi dalej (np. do rozgrywki). Muzyki w grze nie ma w tym module.
 */
export function useMenuMusic() {
  const player = useAudioPlayer(require('../../assets/audio/menu.mp3'));

  useEffect(() => configureLoop(player), [player]);

  useFocusEffect(() => {
    log.debug('Muzyka menu: start');
    player.play();
    return () => {
      log.debug('Muzyka menu: pauza');
      player.pause();
    };
  });
}
