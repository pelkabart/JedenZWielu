import * as SecureStore from 'expo-secure-store';

import type { SecretStorage } from '../ApiKeyStore';

/**
 * Wpis w `expo-secure-store`: na Androidzie `SharedPreferences` zaszyfrowane kluczem z Android Keystore.
 * Wtyczka `expo-secure-store` w app.json wyłącza ten magazyn z kopii zapasowej Androida.
 */
export function secureKeyStorage(name: string): SecretStorage {
  return {
    read: () => SecureStore.getItemAsync(name),
    write: (value) => SecureStore.setItemAsync(name, value),
    remove: () => SecureStore.deleteItemAsync(name),
  };
}
