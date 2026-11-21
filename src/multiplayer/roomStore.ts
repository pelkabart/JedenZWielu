import { CONFIG_SERVER_URL } from '@/backend/serverUrl';
import { fileStorage } from '@/categories/device/fileStorage';

import { RoomClient, type SocketLike } from './RoomClient';

/** Wspólne połączenie multiplayera dla ekranów `app/multiplayer/`. WebSocket jest wbudowany w React Native (działa w Expo Go). */
export const roomClient = new RoomClient({
  serverUrl: CONFIG_SERVER_URL,
  createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
});

/** Ostatni nick gracza, w katalogu dokumentów aplikacji. */
export const nickStorage = fileStorage('multiplayer-nick.json');
