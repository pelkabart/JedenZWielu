import { narratedQuestion, type SoloView } from '@/game/controller/SoloController';
import { hostSpeech } from '@/game/controller/hostLine';
import { createLogger } from '@/lib/log';

const log = createLogger('lektor');

/** Synteza mowy na żywo; w aplikacji sherpa-onnx (`sherpaVoice`), w testach atrapa. */
export interface Voice {
  /**
   * Mówi zdania po kolei. Obietnica kończy się, gdy padnie ostatnie zdanie albo gdy wypowiedź
   * zostanie przerwana (`stop`). Odrzucenie = błąd syntezy albo odtwarzania.
   */
  say(texts: string[]): Promise<void>;
  pause(): void;
  resume(): void;
  /** Przerywa bieżącą wypowiedź. */
  stop(): void;
  /** Zwalnia odtwarzacz; potem nie wolno go używać. */
  dispose(): void;
}

/** To, co udostępnia `SoloController`. */
export interface ViewSource {
  subscribe(listener: () => void): () => void;
  getView(): SoloView;
  setSpeaking(speaking: boolean): void;
}

type VoiceAction = 'say' | 'pause' | 'resume' | 'stop' | 'dispose';

interface Utterance {
  id: number;
  texts: string[];
  /** Pytanie czytane w tej wypowiedzi (do logów i do uciszenia po pominięciu czytania). */
  questionId: string | null;
  started: boolean;
  playing: boolean;
}

/**
 * Głos prowadzącego: na podstawie widoku sterownika mówi każdą nową kwestię z dymku,
 * a w czasie czytania (`reading`) także pytanie. Ta sama kwestia nie pada dwa razy z rzędu.
 * Mówi tylko wtedy, gdy gra nie jest wstrzymana, i zgłasza sterownikowi początek i koniec wypowiedzi.
 */
export class NarrationDirector {
  private current: Utterance | null = null;
  private nextId = 1;
  /** Ostatnia kwestia z dymku (zdania połączone) i ostatnio czytane pytanie. */
  private lastHost: string | null = null;
  private lastQuestionId: string | null = null;
  private unsubscribe: (() => void) | null;

  constructor(
    private readonly views: ViewSource,
    private readonly voice: Voice,
  ) {
    this.unsubscribe = views.subscribe(this.sync);
    this.sync();
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.end('wyjście z gry');
    this.call('dispose', () => this.voice.dispose());
    log.debug('Lektor wyłączony');
  }

  private readonly sync = () => {
    const view = this.views.getView();
    const host = hostSpeech(view);
    const hostText = host.join(' ');
    const question = narratedQuestion(view);

    const texts: string[] = [];
    if (hostText !== this.lastHost) texts.push(...host);
    if (question && question.id !== this.lastQuestionId) texts.push(question.question);
    // Pominięte czytanie: pytanie milknie, nawet jeśli kwestia w dymku się nie zmieniła.
    const readingEnded = this.lastQuestionId !== null && question === null && this.current?.questionId != null;
    this.lastHost = hostText;
    this.lastQuestionId = question?.id ?? null;

    if (view.listening) {
      // Mikrofon słucha odpowiedzi gracza — lektor nie może mówić, bo rozpoznawanie by go usłyszało.
      this.end('mikrofon');
      return;
    }
    if (texts.length > 0) {
      // Bez zgłaszania końca: sterownik nie może ruszyć dalej w przerwie między starą a nową kwestią.
      this.end('nowa kwestia', false);
      this.current = {
        id: this.nextId++,
        texts,
        questionId: question && texts.includes(question.question) ? question.id : null,
        started: false,
        playing: false,
      };
      this.views.setSpeaking(true);
    } else if (readingEnded) {
      this.end('pominięte czytanie');
    }

    const utterance = this.current;
    if (!utterance) return;
    if (view.paused && utterance.playing) {
      log.debug('Lektor wstrzymany', { questionId: utterance.questionId });
      utterance.playing = false;
      this.call('pause', () => this.voice.pause());
    } else if (!view.paused && !utterance.playing) {
      utterance.playing = true;
      if (utterance.started) {
        log.debug('Lektor wznowiony', { questionId: utterance.questionId });
        this.call('resume', () => this.voice.resume());
      } else {
        utterance.started = true;
        this.start(utterance, view);
      }
    }
  };

  private start(utterance: Utterance, view: SoloView) {
    log.info('Prowadzący mówi', {
      sentences: utterance.texts.length,
      questionId: utterance.questionId,
      overlay: view.overlay?.kind ?? null,
    });
    let spoken: Promise<void>;
    try {
      spoken = this.voice.say(utterance.texts);
    } catch (error) {
      spoken = Promise.reject(error);
    }
    spoken.then(
      () => this.finished(utterance.id, null),
      (error: unknown) => this.finished(utterance.id, error),
    );
  }

  /** Koniec wypowiedzi zgłoszony przez lektora; liczy się tylko dla bieżącej (przerwane mogą skończyć się później). */
  private finished(id: number, error: unknown) {
    if (error !== null) {
      log.error('Błąd lektora', { error: error instanceof Error ? error.message : String(error) });
    }
    if (this.current?.id !== id) return;
    log.debug('Koniec wypowiedzi', { questionId: this.current.questionId });
    this.current = null;
    this.views.setSpeaking(false);
  }

  /** Przerywa bieżącą wypowiedź (nowa kwestia, pominięte czytanie, wyjście z gry). */
  private end(reason: string, notify = true) {
    const utterance = this.current;
    if (!utterance) return;
    this.current = null;
    if (utterance.started) {
      log.debug('Przerwano wypowiedź', { reason, questionId: utterance.questionId });
      this.call('stop', () => this.voice.stop());
    }
    if (notify) this.views.setSpeaking(false);
  }

  /** Błąd lektora nie może przerwać gry. */
  private call(action: VoiceAction, fn: () => void) {
    try {
      fn();
    } catch (error) {
      log.error('Błąd lektora', { action, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
