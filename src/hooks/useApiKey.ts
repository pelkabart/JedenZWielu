import { useEffect, useSyncExternalStore } from 'react';

import { apiKeyStore } from '@/settings/apiKey';

/** Zapisany klucz API (pusty tekst, gdy go nie ma); przy pierwszym użyciu wczytuje go z telefonu. */
export function useApiKey() {
  useEffect(() => {
    void apiKeyStore.load();
  }, []);
  return useSyncExternalStore(apiKeyStore.subscribe, apiKeyStore.getKey);
}
