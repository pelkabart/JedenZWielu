import { realClock, type Clock } from '@/game/clock';
import { createLogger } from '@/lib/log';

const log = createLogger('ladowanie');

/** Najdłużej tyle czeka ekran ładowania; potem gra rusza z tym, co jest. */
export const LOADING_TIMEOUT_MS = 10_000;

/** Klucz jednej klatki skórki: `<id postaci>:<klatka>`. */
export const frameKey = (ownerId: string, frame: string) => `${ownerId}:${frame}`;

export interface LoadingState {
  /** 0–1: wczytane obrazki i lektor. */
  progress: number;
  ready: boolean;
}

/**
 * Czeka, aż wczytają się wszystkie oczekiwane obrazki i lektor będzie gotowy.
 * Każdy klucz liczy się raz, a gotowość jest zgłaszana dokładnie raz (także po czasie granicznym).
 * Czas graniczny liczy się od `start()`; `stop()` go wstrzymuje (np. odmontowanie ekranu), ponowne `start()` liczy od nowa.
 */
export class LoadingGate {
  private readonly expected: Set<string>;
  private readonly loaded = new Set<string>();
  private voice = false;
  private state: LoadingState;
  private readonly listeners = new Set<() => void>();
  private readonly startedAt: number;
  private timer: unknown = null;

  constructor(
    expectedImages: readonly string[],
    private readonly clock: Clock = realClock,
    private readonly timeoutMs = LOADING_TIMEOUT_MS,
  ) {
    this.expected = new Set(expectedImages);
    this.startedAt = clock.now();
    this.state = { progress: 0, ready: false };
    log.info('Ładowanie gry', { images: this.expected.size });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Ten sam obiekt, dopóki nic się nie zmieni (dla `useSyncExternalStore`). */
  getState = (): LoadingState => this.state;

  /** Obrazek się wczytał (albo nie dał się wczytać: błąd też kończy czekanie na niego). */
  imageLoaded = (key: string) => {
    if (!this.expected.has(key) || this.loaded.has(key)) return;
    this.loaded.add(key);
    this.refresh();
  };

  /** Lektor gotowy albo niedostępny: w obu przypadkach nie ma już na co czekać. */
  voiceReady = () => {
    if (this.voice) return;
    this.voice = true;
    this.refresh();
  };

  /** Uruchamia czas graniczny (ponownie wywołane liczy od nowa). */
  start() {
    this.stop();
    if (this.state.ready) return;
    this.timer = this.clock.setTimeout(() => this.timeout(), this.timeoutMs);
  }

  /** Wstrzymuje czas graniczny. */
  stop() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private timeout() {
    this.timer = null;
    if (this.state.ready) return;
    log.warn('Ładowanie trwa za długo, gra rusza', {
      missingImages: this.expected.size - this.loaded.size,
      voice: this.voice,
    });
    this.finish();
  }

  private refresh() {
    if (this.state.ready) return;
    const total = this.expected.size + 1;
    const done = this.loaded.size + (this.voice ? 1 : 0);
    if (done === total) {
      log.info('Gra wczytana', { ms: this.clock.now() - this.startedAt, images: this.loaded.size });
      this.finish();
      return;
    }
    const progress = done / total;
    if (progress === this.state.progress) return;
    this.state = { progress, ready: false };
    this.notify();
  }

  private finish() {
    this.stop();
    this.state = { progress: 1, ready: true };
    this.notify();
  }

  private notify() {
    for (const listener of [...this.listeners]) listener();
  }
}
