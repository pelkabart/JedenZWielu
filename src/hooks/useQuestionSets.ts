import { useEffect, useSyncExternalStore } from 'react';

import { questionSetStore } from '@/categories/questionSets';

/** Lista kategorii (domyślna pierwsza); przy pierwszym użyciu wczytuje zapis z telefonu. */
export function useQuestionSets() {
  useEffect(() => {
    void questionSetStore.load();
  }, []);
  return useSyncExternalStore(questionSetStore.subscribe, questionSetStore.getSets);
}
