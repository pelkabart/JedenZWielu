import { isQuestion, QUESTION_RISE, riseQuestionEnding, speechEnd } from '../questionIntonation';
import { pitchHz, toneThenSilence } from '../testing/tone';

// Ramka 10 ms ma wtedy całe 220 próbek, więc koniec tonu wypada równo na granicy ramki.
const RATE = 22000;
const TONE_HZ = 150;

describe('isQuestion', () => {
  it('rozpoznaje pytania', () => {
    expect(isQuestion('W którym roku odbyła się bitwa pod Grunwaldem?')).toBe(true);
    expect(isQuestion('Kto napisał „Pana Tadeusza?”')).toBe(true);
    expect(isQuestion('Czy to prawda? ')).toBe(true);
    expect(isQuestion('Ile to jest (w przybliżeniu?)')).toBe(true);
  });

  it('nie rusza zwykłych kwestii', () => {
    expect(isQuestion('Brawo! To poprawna odpowiedź!')).toBe(false);
    expect(isQuestion('Ile jest planet? Osiem.')).toBe(false);
    expect(isQuestion('Pani Krysia, Twoje pytanie.')).toBe(false);
    expect(isQuestion('')).toBe(false);
  });
});

describe('speechEnd', () => {
  it('kończy się na mowie, nie na ciszy po niej', () => {
    const samples = toneThenSilence(RATE, TONE_HZ, 1000, 300);
    expect(speechEnd(samples, RATE)).toBe(RATE);
  });

  it('dla ciszy zwraca 0', () => {
    expect(speechEnd(new Array(RATE).fill(0), RATE)).toBe(0);
    expect(speechEnd([], RATE)).toBe(0);
  });
});

describe('riseQuestionEnding', () => {
  const input = toneThenSilence(RATE, TONE_HZ, 1000, 300);
  const output = riseQuestionEnding(input, RATE);
  const tail = Math.round((RATE * QUESTION_RISE.tailMs) / 1000);
  const end = output.length - Math.round(RATE * 0.3);

  it('podnosi ton końcówki mowy, a nie ciszy po niej', () => {
    const last = output.slice(end - Math.round(RATE * 0.08), end);
    // Ostatnie 80 ms: blisko pełnego wzrostu (4 półtony to ×1,26).
    expect(pitchHz(last, RATE)).toBeGreaterThan(TONE_HZ * 2 ** (3 / 12));
    expect(pitchHz(last, RATE)).toBeLessThan(TONE_HZ * 2 ** (QUESTION_RISE.semitones / 12) * 1.05);
  });

  it('ton rośnie stopniowo', () => {
    const middle = output.slice(end - Math.round(RATE * 0.3), end - Math.round(RATE * 0.22));
    const last = output.slice(end - Math.round(RATE * 0.08), end);
    expect(pitchHz(middle, RATE)).toBeLessThan(pitchHz(last, RATE));
  });

  it('początek zdania zostaje bez zmian', () => {
    expect(output.slice(0, RATE - tail)).toEqual(input.slice(0, RATE - tail));
  });

  it('cisza po mowie zostaje bez zmian, a mowa skraca się tylko trochę', () => {
    expect(output.slice(end)).toEqual(input.slice(RATE));
    const shortenedMs = ((input.length - output.length) / RATE) * 1000;
    expect(shortenedMs).toBeGreaterThan(10);
    expect(shortenedMs).toBeLessThan(80);
  });

  it('krótkie pytanie też idzie w górę', () => {
    const short = toneThenSilence(RATE, TONE_HZ, 200, 0);
    const risen = riseQuestionEnding(short, RATE);
    expect(risen.length).toBeLessThan(short.length);
    expect(pitchHz(risen.slice(-Math.round(RATE * 0.04)), RATE)).toBeGreaterThan(TONE_HZ * 1.1);
  });

  it('cisza i pusty dźwięk wracają bez zmian', () => {
    const silence = new Array(RATE).fill(0);
    expect(riseQuestionEnding(silence, RATE)).toEqual(silence);
    expect(riseQuestionEnding([], RATE)).toEqual([]);
  });
});
