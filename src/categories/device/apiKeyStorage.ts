import * as SecureStore from 'expo-secure-store';

import { createLogger } from '@/lib/log';

const KEY = 'openai_api_key';
const log = createLogger('kategorie');

/** Klucz API gracza w szyfrowanym magazynie systemu; nigdy w kodzie ani w APK. */
export async function loadApiKey(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(KEY)) ?? '';
  } catch (error) {
    log.warn('Nie udało się odczytać klucza API', { error: error instanceof Error ? error.message : String(error) });
    return '';
  }
}

export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, apiKey.trim());
  } catch (error) {
    log.warn('Nie udało się zapamiętać klucza API', { error: error instanceof Error ? error.message : String(error) });
  }
}
