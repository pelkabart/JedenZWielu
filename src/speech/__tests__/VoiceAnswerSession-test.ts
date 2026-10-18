import { QUESTION_BANK } from '@/game/questions';
import { getLogEntries, resetLog } from '@/lib/log';

import { FakeRecognizer } from '../testing/FakeRecognizer';
import { MESSAGES, VoiceAnswerSession } from '../VoiceAnswerSession';

const question = QUESTION_BANK.find((q) => q.answers[0] === 'Ottawa')!;

function setup() {
  const recognizer = new FakeRecognizer();
  const log = { transcripts: [] as string[], answers: [] as string[], listening: [] as boolean[], messages: [] as (string | null)[] };
  const session = new VoiceAnswerSession(recognizer, question, {
    onTranscript: (t) => log.transcripts.push(t),
    onAnswer: (t) => log.answers.push(t),
    onListening: (l) => log.listening.push(l),
    onMessage: (m) => log.messages.push(m),
  });
  return { recognizer, session, log };
}

beforeEach(() => resetLog());

describe('VoiceAnswerSession', () => {
  it('pyta o zgodę, słucha, pokazuje tekst na bieżąco i zatwierdza odpowiedź', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    expect(recognizer.calls).toEqual(['permission', 'start']);
    expect(log.listening).toEqual([true]);

    recognizer.hear('Ota');
    recognizer.finish('Ottawa');
    expect(log.transcripts).toEqual(['Ota', 'Ottawa']);
    expect(log.answers).toEqual(['Ottawa']);
    // Słuchanie wyłączone przed zatwierdzeniem — lektor może od razu powiedzieć wynik.
    expect(log.listening).toEqual([true, false]);
    expect(getLogEntries({ tag: 'mikrofon' }).map((e) => e.message)).toEqual(['Słucham odpowiedzi', 'Rozpoznano odpowiedź']);
  });

  it('zatwierdza najwyżej jedną odpowiedź', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    recognizer.finish('Ottawa');
    await session.start();
    recognizer.finish('Toronto');
    expect(log.answers).toEqual(['Ottawa']);
    expect(recognizer.calls.filter((c) => c === 'start')).toHaveLength(1);
  });

  it('pusty wynik nie jest zatwierdzany', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    recognizer.finish('', ' ');
    expect(log.answers).toEqual([]);
    expect(log.messages.at(-1)).toBe(MESSAGES.nothingHeard);
    // Można spróbować jeszcze raz.
    await session.start();
    recognizer.finish('Ottawa');
    expect(log.answers).toEqual(['Ottawa']);
  });

  it('cisza (no-speech) to komunikat, a nie błąd', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    recognizer.fail('no-speech');
    expect(log.messages.at(-1)).toBe(MESSAGES.nothingHeard);
    expect(log.listening).toEqual([true, false]);
    expect(getLogEntries({ minLevel: 'error' })).toEqual([]);
  });

  it('błąd rozpoznawania: komunikat, sesja kończy się', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    recognizer.fail('network');
    expect(log.messages.at(-1)).toBe(MESSAGES.failed);
    expect(log.listening).toEqual([true, false]);
    expect(getLogEntries({ tag: 'mikrofon', minLevel: 'error' })).toEqual([
      expect.objectContaining({ message: 'Błąd rozpoznawania mowy', data: { code: 'network', message: 'błąd network' } }),
    ]);
  });

  it('brak zgody na mikrofon: komunikat i można dalej pisać', async () => {
    const { recognizer, session, log } = setup();
    recognizer.permission = false;
    await session.start();
    expect(recognizer.calls).toEqual(['permission']);
    expect(log.listening).toEqual([]);
    expect(log.messages.at(-1)).toBe(MESSAGES.noPermission);
  });

  it('gracz może sam zakończyć mówienie', async () => {
    const { recognizer, session } = setup();
    await session.start();
    session.stop();
    expect(recognizer.calls.at(-1)).toBe('stop');
  });

  it('anulowanie (pauza) przerywa słuchanie bez odpowiedzi, potem można zacząć od nowa', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    session.cancel();
    expect(recognizer.calls.at(-1)).toBe('abort');
    expect(log.listening).toEqual([true, false]);
    expect(log.answers).toEqual([]);
    await session.start();
    expect(log.listening).toEqual([true, false, true]);
  });

  it('dispose przerywa słuchanie, a wynik po zakończeniu sesji jest ignorowany', async () => {
    const { recognizer, session, log } = setup();
    await session.start();
    session.dispose();
    expect(recognizer.calls.at(-1)).toBe('abort');
    expect(log.listening).toEqual([true, false]);
    expect(recognizer.listenerCount).toBe(0);
    recognizer.finish('Ottawa');
    expect(log.answers).toEqual([]);
  });

  it('zgoda przyszła po zamknięciu panelu: nie włącza mikrofonu', async () => {
    const { recognizer, session, log } = setup();
    const started = session.start();
    session.dispose();
    await started;
    expect(recognizer.calls).toEqual(['permission']);
    expect(log.listening).toEqual([]);
  });
});
