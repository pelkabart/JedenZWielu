import manifest from '@/assets/audio/questions/manifest.json';
import { QUESTION_BANK } from '@/game/questions';
import { DEFAULT_RULES } from '@/game/rules';
import type { Question } from '@/game/types';
import { getLogEntries, resetLog } from '@/lib/log';

import { AudioCatalog, NARRATION_TAIL_MS, QUESTION_AUDIO } from '../questionAudio';
import { QUESTION_AUDIO_SOURCES } from '../questionAudioSources';

const REGENERATE = 'uruchom scripts/narration/generate_question_audio.py';

const question = (id: string, text: string): Question => ({
  id,
  category: 'Historia',
  question: text,
  answers: ['x'],
  answerType: 'nazwa',
  difficulty: 1,
});

beforeEach(() => resetLog());

describe('nagrania pytań z bazy', () => {
  it('każde pytanie z bazy ma nagranie zrobione z aktualnej treści', () => {
    const stale = QUESTION_BANK.filter((q) => QUESTION_AUDIO.audioFor(q) === undefined).map((q) => q.id);
    // Gdy test nie przechodzi: ktoś dodał albo zmienił pytanie — `REGENERATE`.
    expect({ stale, hint: stale.length ? REGENERATE : null }).toEqual({ stale: [], hint: null });
  });

  it('w katalogu nie ma nagrań usuniętych pytań', () => {
    const bankIds = QUESTION_BANK.map((q) => q.id).sort();
    expect(QUESTION_AUDIO.ids().sort()).toEqual(bankIds);
    expect(Object.keys(QUESTION_AUDIO_SOURCES).sort()).toEqual(bankIds);
    expect(Object.keys(manifest.questions).sort()).toEqual(bankIds);
  });

  it('każde nagranie jest dołączone do aplikacji', () => {
    // `require` brakującego pliku wywraca już import tego modułu (w Jeście i w Metro), więc tu wystarczy,
    // że każde pytanie ma wpis; wartość to identyfikator zasobu.
    for (const q of QUESTION_BANK) expect(QUESTION_AUDIO_SOURCES[q.id]).toEqual(expect.any(Number));
  });

  it('długości nagrań są realne (ani cisza, ani urwane, ani dłuższe niż czas na odpowiedź)', () => {
    for (const q of QUESTION_BANK) {
      const { durationMs } = QUESTION_AUDIO.audioFor(q)!;
      const msPerChar = durationMs / q.question.length;
      expect({ id: q.id, ok: msPerChar > 25 && msPerChar < 150 }).toEqual({ id: q.id, ok: true });
      expect(durationMs).toBeLessThan(DEFAULT_RULES.answerTimeMs);
    }
  });

  it('katalog wczytuje się bez ostrzeżeń', () => {
    const catalog = new AudioCatalog(manifest, QUESTION_AUDIO_SOURCES);
    expect(catalog.size).toBe(QUESTION_BANK.length);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });
});

describe('AudioCatalog', () => {
  const sources = { a: 101 };

  it('czas czytania = długość nagrania + margines', () => {
    const catalog = new AudioCatalog({ questions: { a: { text: 'Pytanie?', durationMs: 2000 } } }, sources);
    expect(catalog.narrationMs(question('a', 'Pytanie?'))).toBe(2000 + NARRATION_TAIL_MS);
    expect(catalog.audioFor(question('a', 'Pytanie?'))).toEqual({ source: 101, durationMs: 2000, text: 'Pytanie?' });
  });

  it('pytanie bez nagrania: 0 ms i jedno ostrzeżenie', () => {
    const catalog = new AudioCatalog({ questions: {} }, {});
    const q = question('nowe', 'Nowe pytanie?');
    expect(catalog.narrationMs(q)).toBe(0);
    expect(catalog.narrationMs(q)).toBe(0);
    expect(getLogEntries({ tag: 'lektor', minLevel: 'warn' })).toEqual([
      expect.objectContaining({ message: 'Pytanie zostanie pokazane bez lektora', data: { questionId: 'nowe', reason: 'brak nagrania' } }),
    ]);
  });

  it('nagranie ze starej treści nie jest używane', () => {
    const catalog = new AudioCatalog({ questions: { a: { text: 'Stara treść?', durationMs: 2000 } } }, sources);
    const edited = question('a', 'Nowa treść?');
    expect(catalog.audioFor(edited)).toBeUndefined();
    expect(catalog.narrationMs(edited)).toBe(0);
    expect(getLogEntries({ tag: 'lektor' }).at(-1)?.data).toEqual({ questionId: 'a', reason: 'nagranie ze starej treści' });
  });

  it('pomija wpis bez pliku albo z błędną długością', () => {
    const catalog = new AudioCatalog(
      { questions: { a: { text: 'A?', durationMs: 0 }, b: { text: 'B?', durationMs: 1000 } } },
      { a: 1 },
    );
    expect(catalog.size).toBe(0);
    expect(getLogEntries({ tag: 'lektor', minLevel: 'warn' }).map((e) => e.data?.questionId)).toEqual(['a', 'b']);
  });
});
