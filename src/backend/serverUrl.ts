/**
 * Adres serwera gry z pliku `.env.local` (`EXPO_PUBLIC_SERVER_URL=https://…azurecontainerapps.io`).
 * Adres nie jest sekretem – trafia do APK jawnie. Expo CLI wstawia wartość przy budowaniu paczki,
 * więc odwołanie musi być dokładnie `process.env.EXPO_PUBLIC_SERVER_URL` (bez destrukturyzacji).
 * Pusty tekst, gdy adresu nie ustawiono.
 */
export const CONFIG_SERVER_URL: string = process.env.EXPO_PUBLIC_SERVER_URL ?? '';
