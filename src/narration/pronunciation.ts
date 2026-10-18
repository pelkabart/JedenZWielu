/** espeak czyta cyfry rzymskie jak litery („Mieszko I” → „Mieszko i”), więc po imieniu zamieniamy je na liczebniki. */
const ROMAN_ORDINALS: Record<string, string> = {
  I: 'Pierwszy',
  II: 'Drugi',
  III: 'Trzeci',
  IV: 'Czwarty',
  V: 'Piąty',
  VI: 'Szósty',
};

const ROMAN_AFTER_NAME = /(\p{Lu}\p{Ll}+) (VI|IV|V|I{1,3})(?![\p{L}\p{N}])/gu;

/** Tekst dla syntezatora mowy; na ekranie zostaje oryginał. */
export function toSpeakable(text: string): string {
  return text.replace(ROMAN_AFTER_NAME, (_match, name: string, roman: string) => `${name} ${ROMAN_ORDINALS[roman]}`);
}
