/**
 * Klucz OpenAI wpisany przez programistę w pliku `.env.local` (w .gitignore, wzór: `.env.example`).
 * Expo CLI wstawia tu wartość przy budowaniu paczki, więc trzeba odwoływać się do niej dokładnie tak:
 * `process.env.EXPO_PUBLIC_OPENAI_API_KEY` (bez destrukturyzacji). Pusty tekst, gdy pliku/klucza nie ma.
 */
export const CONFIG_API_KEY: string = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
