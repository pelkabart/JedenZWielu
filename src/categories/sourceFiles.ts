export const MAX_SOURCE_FILES = 9;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** OpenAI przyjmuje do 50 MB na zapytanie; base64 powiększa pliki o 1/3. */
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

/** Formaty, z których Responses API wyciąga tekst (`input_file`). */
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const SUPPORTED_EXTENSIONS = Object.keys(MIME_TYPES);
export const SUPPORTED_MIME_TYPES = Object.values(MIME_TYPES);

/** Plik wybrany przez gracza, jeszcze nie wczytany. */
export interface PickedFile {
  name: string;
  size: number;
  uri: string;
}

/** Plik gotowy do wysłania. */
export interface SourceFile {
  name: string;
  mimeType: string;
  base64: string;
}

export type SourceFileProblem =
  | { kind: 'no-files' }
  | { kind: 'too-many-files'; count: number }
  | { kind: 'unsupported-type'; name: string }
  | { kind: 'empty-file'; name: string }
  | { kind: 'file-too-large'; name: string; size: number }
  | { kind: 'total-too-large'; size: number }
  | { kind: 'duplicate'; name: string };

/** Typ MIME po rozszerzeniu (wybierak plików nie zawsze go podaje); `null` = nieobsługiwany. */
export function mimeTypeFor(name: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return (match && MIME_TYPES[match[1].toLowerCase()]) ?? null;
}

/** Sprawdza wybrane pliki przed wczytaniem; zwraca pierwszy problem albo `null`. */
export function validateSourceFiles(files: Pick<PickedFile, 'name' | 'size'>[]): SourceFileProblem | null {
  if (files.length === 0) return { kind: 'no-files' };
  if (files.length > MAX_SOURCE_FILES) return { kind: 'too-many-files', count: files.length };

  const names = new Set<string>();
  for (const { name, size } of files) {
    if (mimeTypeFor(name) === null) return { kind: 'unsupported-type', name };
    if (names.has(name)) return { kind: 'duplicate', name };
    names.add(name);
    if (size <= 0) return { kind: 'empty-file', name };
    if (size > MAX_FILE_BYTES) return { kind: 'file-too-large', name, size };
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return { kind: 'total-too-large', size: total };
  return null;
}

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

export function describeSourceFileProblem(problem: SourceFileProblem): string {
  switch (problem.kind) {
    case 'no-files':
      return 'Wybierz przynajmniej jeden plik.';
    case 'too-many-files':
      return `Można wybrać najwyżej ${MAX_SOURCE_FILES} plików (wybrano ${problem.count}).`;
    case 'unsupported-type':
      return `Plik „${problem.name}” ma nieobsługiwany format. Obsługiwane: ${SUPPORTED_EXTENSIONS.join(', ')}.`;
    case 'empty-file':
      return `Plik „${problem.name}” jest pusty.`;
    case 'file-too-large':
      return `Plik „${problem.name}” ma ${megabytes(problem.size)}, a można najwyżej ${megabytes(MAX_FILE_BYTES)}.`;
    case 'total-too-large':
      return `Pliki mają razem ${megabytes(problem.size)}, a można najwyżej ${megabytes(MAX_TOTAL_BYTES)}.`;
    case 'duplicate':
      return `Plik „${problem.name}” został wybrany dwa razy.`;
  }
}
