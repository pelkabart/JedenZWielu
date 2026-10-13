/**
 * Sprawdzanie odpowiedzi otwartych: ignorujemy wielkość liter, polskie znaki,
 * interpunkcję i nadmiarowe spacje, a w dłuższych odpowiedziach tolerujemy literówki.
 */

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,](?=\d)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ile literówek dopuszczamy w zależności od długości poprawnej odpowiedzi. */
export function allowedTypos(normalizedExpected: string): number {
  // Liczby i odpowiedzi z cyframi muszą być dokładne (1410 ≠ 1411).
  if (/\d/.test(normalizedExpected)) return 0;
  const length = normalizedExpected.replace(/ /g, '').length;
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export function isCorrectAnswer(input: string | null, accepted: readonly string[]): boolean {
  if (input === null) return false;
  const given = normalizeAnswer(input);
  if (given === '') return false;
  return accepted.some((answer) => {
    const expected = normalizeAnswer(answer);
    return levenshtein(given, expected) <= allowedTypos(expected);
  });
}
