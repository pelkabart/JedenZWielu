import { fileStorage } from '@/categories/device/fileStorage';

import { skinCatalog } from './skinAssets';
import { SkinSelectionStore } from './SkinSelectionStore';

/** Wspólny wybór skórki dla wszystkich ekranów. */
export const skinSelectionStore = new SkinSelectionStore(fileStorage('selected-skin.json'), skinCatalog.player);
