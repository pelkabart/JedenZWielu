import * as DocumentPicker from 'expo-document-picker';
import { Directory, File } from 'expo-file-system';

import { CATEGORY_FILE_MIME_TYPE } from '../categoryFile';
import type { PickedFile } from '../sourceFiles';

/**
 * Wybór pliku `.kat` do importu. Android nie zna typu MIME `.kat`, więc nie filtrujemy
 * po typie — rozszerzenie sprawdza `importQuestionSet`. `null` = gracz anulował.
 */
export async function pickCategoryFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true, type: '*/*' });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { name: asset.name, size: asset.size ?? new File(asset.uri).size, uri: asset.uri };
}

export function readCategoryFileText(file: PickedFile): Promise<string> {
  return new File(file.uri).text();
}

function isPickerCancelled(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : '';
  return /cancel/i.test(typeof code === 'string' ? code : '') || /cancel/i.test(message);
}

/**
 * Zapis pliku w folderze wybranym przez gracza (Storage Access Framework).
 * Typ `application/octet-stream`, żeby system nie dokleił `.json` do nazwy. `false` = anulowano.
 */
export async function saveCategoryFile(fileName: string, text: string): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isPickerCancelled(error)) return false;
    throw error;
  }
  const file = directory.createFile(fileName, CATEGORY_FILE_MIME_TYPE);
  file.write(text);
  return true;
}
