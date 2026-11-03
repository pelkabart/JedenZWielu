import { ApiKeyStore } from './ApiKeyStore';
import { CONFIG_API_KEY } from './configApiKey';
import { secureKeyStorage } from './device/secureKeyStorage';

/**
 * Wspólny klucz API dla ekranów „Ustawienia” i „Nowa kategoria”. Nazwa wpisu jak we wcześniejszej wersji gry.
 * Gdy na telefonie nie zapisano klucza, używany jest klucz z `.env.local` (`CONFIG_API_KEY`).
 */
export const apiKeyStore = new ApiKeyStore(secureKeyStorage('openai_api_key'), CONFIG_API_KEY);
