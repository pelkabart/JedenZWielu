/** Tak jak na serwerze (`server/src/rooms.ts`): 5 znaków, bez 0/O i 1/I. */
export const CODE_LENGTH = 5;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Do pola tekstowego: wielkie litery, bez spacji, maks. 5 znaków. */
export function normalizeCodeInput(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, CODE_LENGTH);
}

/** Czy wpis ma pełną długość i tylko znaki z alfabetu kodów. */
export function isCompleteCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}
