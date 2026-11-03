import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { acquireMenuMusic, releaseMenuMusic } from '@/audio/menuMusic';
import { playsMenuMusic } from '@/audio/menuMusicRoutes';

/** Muzyka menu dla całej aplikacji (w głównym układzie): gra na każdym ekranie poza rozgrywką. */
export function useMenuMusic() {
  const plays = playsMenuMusic(usePathname());

  useEffect(() => {
    if (!plays) return;
    acquireMenuMusic();
    return () => releaseMenuMusic();
  }, [plays]);
}
