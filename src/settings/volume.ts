import { fileStorage } from '@/categories/device/fileStorage';

import { VolumeStore } from './VolumeStore';

/** Wspólna głośność dla ekranu „Ustawienia”, muzyki (menu i gra) i lektora. Plik w katalogu dokumentów aplikacji. */
export const volumeStore = new VolumeStore(fileStorage('volume.json'));
