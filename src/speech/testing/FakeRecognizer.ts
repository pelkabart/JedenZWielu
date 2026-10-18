import type { Recognizer, RecognizerEvent } from '../VoiceAnswerSession';

/** Atrapa rozpoznawania mowy: test sam „mówi” (`hear`, `finish`) i zgłasza błędy. */
export class FakeRecognizer implements Recognizer {
  permission = true;
  readonly calls: string[] = [];
  private readonly listeners = new Set<(event: RecognizerEvent) => void>();

  requestPermission() {
    this.calls.push('permission');
    return Promise.resolve(this.permission);
  }

  start() {
    this.calls.push('start');
  }

  stop() {
    this.calls.push('stop');
  }

  abort() {
    this.calls.push('abort');
    this.emit({ type: 'error', code: 'aborted', message: '' });
    this.emit({ type: 'end' });
  }

  onEvent(listener: (event: RecognizerEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get listenerCount() {
    return this.listeners.size;
  }

  /** Wynik na bieżąco (gracz jeszcze mówi). */
  hear(text: string) {
    this.emit({ type: 'result', transcripts: [text], isFinal: false });
  }

  /** Gracz skończył mówić: wynik końcowy z wersjami i koniec słuchania. */
  finish(...transcripts: string[]) {
    this.emit({ type: 'result', transcripts, isFinal: true });
    this.emit({ type: 'end' });
  }

  fail(code: string) {
    this.emit({ type: 'error', code, message: `błąd ${code}` });
    this.emit({ type: 'end' });
  }

  private emit(event: RecognizerEvent) {
    for (const listener of [...this.listeners]) listener(event);
  }
}
