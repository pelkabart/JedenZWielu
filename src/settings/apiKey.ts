import { ApiKeyStore } from './ApiKeyStore';
import { secureKeyStorage } from './device/secureKeyStorage';

/** Wspólny klucz API dla ekranów „Ustawienia” i „Nowa kategoria”. Nazwa wpisu jak we wcześniejszej wersji gry. */
export const apiKeyStore = new ApiKeyStore(secureKeyStorage('openai_api_key'));
