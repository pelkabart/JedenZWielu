import { useEffect, useSyncExternalStore } from 'react';

import { skinSelectionStore } from '@/skins/selection';

/** Skórka gracza; przy pierwszym użyciu wczytuje zapis z telefonu. */
export function useSelectedSkin() {
  useEffect(() => {
    void skinSelectionStore.load();
  }, []);
  return useSyncExternalStore(skinSelectionStore.subscribe, skinSelectionStore.getSelected);
}
