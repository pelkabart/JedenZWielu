import { createLogger } from '@/lib/log';

import {
  CATEGORY_FILE_EXTENSION,
  categoryFileName,
  isCategoryFileName,
  MAX_CATEGORY_FILE_BYTES,
  parseCategoryFile,
  serializeCategoryFile,
  uniqueSetName,
} from './categoryFile';
import { CategoryError } from './errors';
import type { QuestionSetStore } from './QuestionSetStore';
import type { PickedFile } from './sourceFiles';
import { MAX_CUSTOM_SETS, type QuestionSet } from './types';

const log = createLogger('kategorie');

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface ImportQuestionSetDeps {
  store: QuestionSetStore;
  /** Zwraca zawartość pliku jako tekst. */
  readText: (file: PickedFile) => Promise<string>;
}

/**
 * Import pliku `.kat`: limit, rozszerzenie i rozmiar są sprawdzane przed czytaniem pliku.
 * Kategoria trafia do magazynu tak samo jak kategoria z OpenAI (nowe id, limit, walidacja nazwy).
 */
export async function importQuestionSet(file: PickedFile, { store, readText }: ImportQuestionSetDeps): Promise<QuestionSet> {
  await store.load();
  if (!store.canAddMore()) {
    throw new CategoryError('limit', `Można mieć najwyżej ${MAX_CUSTOM_SETS} własne kategorie. Usuń którąś, żeby zaimportować nową.`);
  }
  if (!isCategoryFileName(file.name)) {
    throw new CategoryError('import-extension', `Można importować tylko pliki .${CATEGORY_FILE_EXTENSION} (wybrano „${file.name}”).`);
  }
  if (file.size <= 0) throw new CategoryError('import-size', `Plik „${file.name}” jest pusty.`);
  if (file.size > MAX_CATEGORY_FILE_BYTES) {
    throw new CategoryError('import-size', `Plik „${file.name}” jest za duży na kategorię.`);
  }

  let text: string;
  try {
    text = await readText(file);
  } catch (error) {
    log.warn('Nie udało się odczytać pliku kategorii', { error: errorText(error) });
    throw new CategoryError('file-read', `Nie udało się odczytać pliku „${file.name}”.`);
  }

  const imported = parseCategoryFile(text);
  const name = uniqueSetName(imported.name, store.getSets());
  log.info('Importuję kategorię', { questions: imported.questions.length, rejected: imported.rejected, renamed: name !== imported.name });
  return store.add({ name, questions: imported.questions, sourceFiles: imported.sourceFiles });
}

export interface ExportQuestionSetDeps {
  /** Zapisuje plik w miejscu wybranym przez gracza; `false` = gracz anulował. */
  saveFile: (fileName: string, text: string) => Promise<boolean>;
  now?: () => Date;
}

/** Eksport własnej kategorii do pliku `.kat`. Zwraca nazwę pliku albo `null`, gdy gracz anulował. */
export async function exportQuestionSet(set: QuestionSet, { saveFile, now = () => new Date() }: ExportQuestionSetDeps): Promise<string | null> {
  if (set.builtIn) throw new CategoryError('default-set', 'Kategorii domyślnej nie można eksportować.');
  const fileName = categoryFileName(set.name);
  const text = serializeCategoryFile(set, now());

  let saved: boolean;
  try {
    saved = await saveFile(fileName, text);
  } catch (error) {
    log.warn('Nie udało się zapisać pliku kategorii', { setId: set.id, error: errorText(error) });
    throw new CategoryError('export-write', 'Nie udało się zapisać pliku. Wybierz inny folder.');
  }
  if (!saved) {
    log.debug('Eksport anulowany', { setId: set.id });
    return null;
  }
  log.info('Wyeksportowano kategorię', { setId: set.id, questions: set.questions.length, bytes: text.length });
  return fileName;
}
