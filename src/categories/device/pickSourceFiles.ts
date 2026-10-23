import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import type { PickedFile } from '../sourceFiles';

/**
 * Systemowy wybierak plików. Nie filtrujemy po typach MIME (Android nie zna np. `text/markdown`
 * i ukryłby takie pliki) — format sprawdza `validateSourceFiles`.
 */
export async function pickSourceFiles(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    name: asset.name,
    size: asset.size ?? new File(asset.uri).size,
    uri: asset.uri,
  }));
}

export function readFileBase64(file: PickedFile): Promise<string> {
  return new File(file.uri).base64();
}
