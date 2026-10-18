import { narratedQuestion, type SoloView } from '@/game/controller/SoloController';
import { createLogger } from '@/lib/log';

import { QUESTION_AUDIO, type AudioCatalog } from './questionAudio';

const log = createLogger('lektor');

/** Samo odtwarzanie; w aplikacji `expo-audio`, w testach atrapa. */
export interface NarrationPlayer {
  /** Wczytuje nagranie i gra je od początku. */
  play(source: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Zwalnia odtwarzacz; potem nie wolno go używać. */
  dispose(): void;
}

/** To, co udostępnia `SoloController`. */
export interface ViewSource {
  subscribe(listener: () => void): () => void;
  getView(): SoloView;
}

type PlayerAction = 'play' | 'pause' | 'resume' | 'stop' | 'dispose';

/**
 * Steruje lektorem na podstawie widoku sterownika: gra nagranie pytania z nakładki `reading`
 * i tylko wtedy, gdy gra nie jest wstrzymana. Dźwięk zawsze wynika z bieżącego widoku,
 * więc pominięcie czytania, pauza czy wyjście z gry same go zatrzymują.
 */
export class NarrationDirector {
  private current: { questionId: string; source: number; started: boolean; playing: boolean } | null = null;
  private unsubscribe: (() => void) | null;

  constructor(
    private readonly views: ViewSource,
    private readonly player: NarrationPlayer,
    private readonly catalog: AudioCatalog = QUESTION_AUDIO,
  ) {
    this.unsubscribe = views.subscribe(this.sync);
    this.sync();
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.current) this.call('stop', () => this.player.stop());
    this.current = null;
    this.call('dispose', () => this.player.dispose());
    log.debug('Lektor wyłączony');
  }

  private readonly sync = () => {
    const view = this.views.getView();
    const question = narratedQuestion(view);
    const audio = question ? this.catalog.audioFor(question) : undefined;
    const current = this.current;

    if (current && current.questionId !== question?.id) {
      log.debug('Koniec czytania', { questionId: current.questionId });
      this.call('stop', () => this.player.stop());
      this.current = null;
    }
    if (!question || !audio) return;

    this.current ??= { questionId: question.id, source: audio.source, started: false, playing: false };
    const next = this.current;
    if (view.paused && next.playing) {
      log.debug('Lektor wstrzymany', { questionId: next.questionId });
      next.playing = false;
      this.call('pause', () => this.player.pause());
    } else if (!view.paused && !next.playing) {
      next.playing = true;
      if (next.started) {
        log.debug('Lektor wznowiony', { questionId: next.questionId });
        this.call('resume', () => this.player.resume());
      } else {
        next.started = true;
        log.info('Lektor czyta pytanie', { questionId: next.questionId, durationMs: audio.durationMs });
        this.call('play', () => this.player.play(next.source));
      }
    }
  };

  /** Błąd dźwięku nie może przerwać gry — czas czytania i tak liczy sterownik. */
  private call(action: PlayerAction, fn: () => void) {
    try {
      fn();
    } catch (error) {
      log.error('Błąd odtwarzacza', {
        action,
        questionId: this.current?.questionId ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
