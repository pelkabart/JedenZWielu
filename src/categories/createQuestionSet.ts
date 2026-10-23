import { createLogger } from '@/lib/log';

import { CategoryError } from './errors';
import { generateQuestionSet, NO_API_KEY_MESSAGE, type FetchLike } from './openaiGenerator';
import { validateSetName, type QuestionSetStore } from './QuestionSetStore';
import { describeSourceFileProblem, mimeTypeFor, validateSourceFiles, type PickedFile, type SourceFile } from './sourceFiles';
import { MAX_CUSTOM_SETS, type QuestionSet } from './types';

const log = createLogger('kategorie');

export type CreationStep = 'reading' | 'generating' | 'saving';

export interface CreateQuestionSetDeps {
  store: QuestionSetStore;
  /** Zwraca zawartość pliku w base64. */
  readFile: (file: PickedFile) => Promise<string>;
  /** Klucz z ustawień; pusty = błąd `no-api-key` przed czytaniem plików. */
  apiKey: string;
  fetch?: FetchLike;
  onProgress?: (step: CreationStep) => void;
}

/**
 * Cały proces z ekranu „Nowa kategoria”: nazwa i limit → pliki → OpenAI → zapis.
 * Wszystko, co da się sprawdzić bez internetu, jest sprawdzane przed wysłaniem plików
 * (zapytanie do OpenAI kosztuje).
 */
export async function createQuestionSet(
  input: { name: string; files: PickedFile[] },
  { store, readFile, apiKey, fetch, onProgress }: CreateQuestionSetDeps,
): Promise<QuestionSet> {
  await store.load();
  if (!store.canAddMore()) {
    throw new CategoryError('limit', `Można mieć najwyżej ${MAX_CUSTOM_SETS} własne kategorie. Usuń którąś, żeby dodać nową.`);
  }
  const name = validateSetName(input.name, store.getSets());
  if (!name.ok) throw new CategoryError('name', name.reason);
  const problem = validateSourceFiles(input.files);
  if (problem) throw new CategoryError('files', describeSourceFileProblem(problem));
  if (apiKey.trim() === '') throw new CategoryError('no-api-key', NO_API_KEY_MESSAGE);

  log.info('Tworzę kategorię', { files: input.files.length, bytes: input.files.reduce((sum, f) => sum + f.size, 0) });

  onProgress?.('reading');
  const files: SourceFile[] = [];
  for (const file of input.files) {
    try {
      files.push({ name: file.name, mimeType: mimeTypeFor(file.name) ?? 'application/octet-stream', base64: await readFile(file) });
    } catch (error) {
      log.warn('Nie udało się odczytać pliku', { name: file.name, error: error instanceof Error ? error.message : String(error) });
      throw new CategoryError('file-read', `Nie udało się odczytać pliku „${file.name}”.`);
    }
  }

  onProgress?.('generating');
  const { questions } = await generateQuestionSet({ apiKey, files, setName: name.name, setId: 'nowa', fetch });

  onProgress?.('saving');
  return store.add({ name: name.name, questions, sourceFiles: input.files.map((f) => f.name) });
}
