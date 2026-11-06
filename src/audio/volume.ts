import type { VolumeSettings, VolumeStore } from '@/settings/VolumeStore';

/**
 * Głośność odtwarzacza muzyki (0–1). `base` to poziom tego utworu przy 100% w ustawieniach,
 * więc suwak zmienia głośność, a proporcje między muzyką i lektorem zostają.
 */
export function musicGain(base: number, settings: VolumeSettings): number {
  return settings.musicEnabled ? base * (settings.music / 100) : 0;
}

/** Głośność odtwarzacza lektora (0–1). Wyłączony lektor = 0 (gra po cichu, tempo gry bez zmian). */
export function voiceGain(settings: VolumeSettings): number {
  return settings.voiceEnabled ? settings.voice / 100 : 0;
}

/**
 * Ustawia głośność lektora teraz i przy każdej zmianie w ustawieniach. Przy 0% klip gra dalej
 * (cicho) i kończy się normalnie, więc przebieg gry się nie zmienia. Zwraca funkcję odpinającą.
 */
export function bindVoiceVolume(player: { volume: number }, store: Pick<VolumeStore, 'getSettings' | 'subscribe'>) {
  const apply = () => {
    player.volume = voiceGain(store.getSettings());
  };
  apply();
  return store.subscribe(apply);
}
