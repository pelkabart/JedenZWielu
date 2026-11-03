/**
 * Intonacja pytająca. Model głosu czyta pytania płasko (uczył się na monologu), więc po syntezie
 * końcówkę pytania odtwarzamy coraz szybciej, jak przyspieszaną taśmę: ton płynnie rośnie
 * do `semitones` na ostatniej sylabie, a końcówka skraca się o kilkadziesiąt milisekund.
 */

export interface QuestionRise {
  /** O ile półtonów rośnie ton na samym końcu mowy. */
  semitones: number;
  /** Długość obrabianej końcówki mowy (bez ciszy po niej). */
  tailMs: number;
}

/** 4 półtony: wyraźny wzrost; przy 6 ostatnia sylaba brzmiała już sztucznie (zabezpieczenia: lektor.md). */
export const QUESTION_RISE: QuestionRise = { semitones: 4, tailMs: 450 };

const FRAME_MS = 10;
/** Ramka jest mową, gdy jest głośniejsza niż ta część najgłośniejszej ramki. */
const SPEECH_LEVEL = 0.02;

/** Tekst kończy się znakiem zapytania (także przed cudzysłowem albo nawiasem). */
export function isQuestion(text: string): boolean {
  return /\?["'”»)\]\s]*$/u.test(text);
}

/** Indeks tuż za końcem mowy (cisza doklejona przez syntezę zostaje za nim); 0 dla samej ciszy. */
export function speechEnd(samples: ArrayLike<number>, sampleRate: number): number {
  const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const levels: number[] = [];
  for (let start = 0; start < samples.length; start += frame) {
    const end = Math.min(samples.length, start + frame);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    levels.push(Math.sqrt(sum / (end - start)));
  }
  const threshold = Math.max(0, ...levels) * SPEECH_LEVEL;
  if (threshold === 0) return 0;
  for (let f = levels.length - 1; f >= 0; f--) {
    if (levels[f] > threshold) return Math.min(samples.length, (f + 1) * frame);
  }
  return 0;
}

/**
 * Podnosi ton końcówki mowy. Wszystko przed końcówką i cisza po mowie zostają bez zmian.
 * Wzrost przyspiesza (kwadratowo), więc najmocniej słychać go na ostatniej sylabie.
 */
export function riseQuestionEnding(
  samples: ArrayLike<number>,
  sampleRate: number,
  { semitones, tailMs }: QuestionRise = QUESTION_RISE,
): number[] {
  const end = speechEnd(samples, sampleRate);
  if (end === 0) return Array.from(samples);

  const start = Math.max(0, end - Math.round((sampleRate * tailMs) / 1000));
  const length = end - start;
  const last = samples.length - 1;
  const out: number[] = [];
  for (let i = 0; i < start; i++) out.push(samples[i]);

  for (let pos = start; pos < end; ) {
    const i = Math.floor(pos);
    const frac = pos - i;
    out.push(samples[i] * (1 - frac) + samples[Math.min(i + 1, last)] * frac);
    const t = (pos - start) / length;
    pos += 2 ** ((semitones * t * t) / 12);
  }

  for (let i = end; i < samples.length; i++) out.push(samples[i]);
  return out;
}
