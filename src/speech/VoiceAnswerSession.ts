import type { Question } from '@/game/types';
import { createLogger } from '@/lib/log';

import { chooseSpokenAnswer } from './spokenAnswer';

const log = createLogger('mikrofon');

export type RecognizerEvent =
  /** `transcripts`: wersje tego, co usłyszano, od najbardziej prawdopodobnej. */
  | { type: 'result'; transcripts: string[]; isFinal: boolean }
  | { type: 'error'; code: string; message: string }
  /** Zawsze na końcu, także po błędzie. */
  | { type: 'end' };

/** Rozpoznawanie mowy; w aplikacji `expo-speech-recognition`, w testach atrapa. */
export interface Recognizer {
  requestPermission(): Promise<boolean>;
  /** Słucha po polsku, aż gracz skończy mówić. */
  start(): void;
  /** Kończy słuchanie i zwraca wynik końcowy. */
  stop(): void;
  /** Przerywa bez wyniku. */
  abort(): void;
  onEvent(listener: (event: RecognizerEvent) => void): () => void;
}

export interface VoiceAnswerCallbacks {
  /** Tekst rozpoznawany na bieżąco (pokazywany w polu odpowiedzi). */
  onTranscript(text: string): void;
  /** Gotowa odpowiedź — zatwierdzana tak samo jak wpisana. */
  onAnswer(text: string): void;
  /** Czy mikrofon słucha (sterownik ucisza wtedy lektora). */
  onListening(listening: boolean): void;
  /** Komunikat dla gracza; `null` = brak. */
  onMessage(message: string | null): void;
}

export const MESSAGES = {
  noPermission: 'Brak dostępu do mikrofonu — wpisz odpowiedź.',
  nothingHeard: 'Nie usłyszałem odpowiedzi — powiedz jeszcze raz albo wpisz.',
  failed: 'Rozpoznawanie mowy nie działa — wpisz odpowiedź.',
} as const;

/** Błędy, które znaczą tylko „nic nie usłyszano”. */
const NOTHING_HEARD = new Set(['no-speech', 'speech-timeout', 'nomatch']);

/**
 * Jedna próba odpowiedzi głosem na jedno pytanie. Zatwierdza najwyżej jedną odpowiedź;
 * zdarzenia po `dispose` (np. spóźniony wynik po zmianie pytania) są ignorowane.
 */
export class VoiceAnswerSession {
  private listening = false;
  private answered = false;
  private disposed = false;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly recognizer: Recognizer,
    private readonly question: Question,
    private readonly callbacks: VoiceAnswerCallbacks,
  ) {
    this.unsubscribe = recognizer.onEvent(this.handle);
  }

  get isListening() {
    return this.listening;
  }

  async start() {
    if (this.listening || this.answered || this.disposed) return;
    this.callbacks.onMessage(null);
    let granted = false;
    try {
      granted = await this.recognizer.requestPermission();
    } catch (error) {
      log.error('Nie udało się zapytać o mikrofon', { error: error instanceof Error ? error.message : String(error) });
    }
    if (this.disposed) return;
    if (!granted) {
      log.info('Brak zgody na mikrofon');
      this.callbacks.onMessage(MESSAGES.noPermission);
      return;
    }
    this.setListening(true);
    log.info('Słucham odpowiedzi', { questionId: this.question.id });
    try {
      this.recognizer.start();
    } catch (error) {
      log.error('Nie udało się włączyć mikrofonu', { error: error instanceof Error ? error.message : String(error) });
      this.callbacks.onMessage(MESSAGES.failed);
      this.setListening(false);
    }
  }

  /** Gracz skończył mówić (drugie dotknięcie mikrofonu). */
  stop() {
    if (this.listening) this.recognizer.stop();
  }

  /** Przerywa słuchanie bez odpowiedzi (np. pauza gry); można potem zacząć od nowa. */
  cancel() {
    if (!this.listening) return;
    log.debug('Anulowano słuchanie', { questionId: this.question.id });
    this.recognizer.abort();
    this.setListening(false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.listening) {
      log.debug('Przerwano słuchanie', { questionId: this.question.id });
      this.recognizer.abort();
    }
    this.setListening(false);
    this.unsubscribe();
  }

  private readonly handle = (event: RecognizerEvent) => {
    if (this.disposed || !this.listening) return;
    switch (event.type) {
      case 'result': {
        if (!event.isFinal) {
          if (event.transcripts[0]) this.callbacks.onTranscript(event.transcripts[0]);
          return;
        }
        const answer = chooseSpokenAnswer(event.transcripts, this.question);
        log.info('Rozpoznano odpowiedź', { questionId: this.question.id, alternatives: event.transcripts.length, empty: answer === null });
        if (answer === null) {
          this.callbacks.onMessage(MESSAGES.nothingHeard);
          return;
        }
        this.answered = true;
        // Najpierw wyłączamy słuchanie, żeby lektor mógł od razu powiedzieć wynik odpowiedzi.
        this.setListening(false);
        this.callbacks.onTranscript(answer);
        this.callbacks.onAnswer(answer);
        return;
      }
      case 'error':
        if (event.code === 'aborted') return;
        if (NOTHING_HEARD.has(event.code)) {
          this.callbacks.onMessage(MESSAGES.nothingHeard);
        } else {
          log.error('Błąd rozpoznawania mowy', { code: event.code, message: event.message });
          this.callbacks.onMessage(event.code === 'not-allowed' ? MESSAGES.noPermission : MESSAGES.failed);
        }
        return;
      case 'end':
        this.setListening(false);
        return;
    }
  };

  private setListening(listening: boolean) {
    if (this.listening === listening) return;
    this.listening = listening;
    this.callbacks.onListening(listening);
  }
}
