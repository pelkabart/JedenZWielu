/** Sztuczny „głos” do testów intonacji: ton o stałej wysokości, potem cisza. */
export function toneThenSilence(sampleRate: number, hz: number, toneMs: number, silenceMs: number): number[] {
  const tone = Math.round((sampleRate * toneMs) / 1000);
  const silence = Math.round((sampleRate * silenceMs) / 1000);
  const samples: number[] = [];
  for (let i = 0; i < tone; i++) samples.push(0.5 * Math.sin((2 * Math.PI * hz * i) / sampleRate));
  for (let i = 0; i < silence; i++) samples.push(0);
  return samples;
}

/**
 * Średnia wysokość tonu z przejść przez zero w górę (wystarczy dla czystego tonu).
 * Chwilę przejścia liczymy między próbkami, inaczej w 80 ms dokładność to tylko ok. 12 Hz.
 */
export function pitchHz(samples: number[], sampleRate: number): number {
  const crossings: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a < 0 && b >= 0) crossings.push(i - 1 + a / (a - b));
  }
  if (crossings.length < 2) return 0;
  const periods = crossings.length - 1;
  return (periods * sampleRate) / (crossings[periods] - crossings[0]);
}
