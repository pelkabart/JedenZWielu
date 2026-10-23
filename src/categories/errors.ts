export type CategoryErrorKind =
  // magazyn zestawów
  | 'name'
  | 'limit'
  | 'default-set'
  | 'not-found'
  | 'no-questions'
  | 'storage'
  // pliki
  | 'files'
  | 'file-read'
  // OpenAI
  | 'no-api-key'
  | 'auth'
  | 'rate-limit'
  | 'server'
  | 'network'
  | 'timeout'
  | 'refused'
  | 'incomplete'
  | 'bad-response'
  | 'too-few-questions';

/** Błąd przy tworzeniu albo usuwaniu kategorii; `message` jest gotowy do pokazania graczowi. */
export class CategoryError extends Error {
  constructor(
    readonly kind: CategoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}
