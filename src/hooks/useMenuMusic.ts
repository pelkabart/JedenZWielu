import { useFocusEffect } from 'expo-router';

import { acquireMenuMusic, releaseMenuMusic } from '@/audio/menuMusic';

/**
 * Muzyka menu w tle. Ekran zgłasza się, gdy jest na wierzchu, i wyrejestrowuje, gdy go opuszcza.
 * Dzięki temu melodia płynie przez menu główne i wybór poziomu, a w rozgrywce cichnie.
 */
export function useMenuMusic() {
  useFocusEffect(() => {
    acquireMenuMusic();
    return () => releaseMenuMusic();
  });
}
