/** Funkcja losująca z przedziału [0, 1). Wstrzykiwana wszędzie, żeby gra była powtarzalna w testach. */
export type Rng = () => number;

/** Deterministyczny generator mulberry32. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickRandom<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickRandom: pusta lista');
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
