import type { NarrationPlayer } from '../NarrationDirector';

export type FakePlayerCall = { action: 'play'; source: number; at: number } | { action: 'pause' | 'resume' | 'stop' | 'dispose'; at: number };

/** Atrapa odtwarzacza: zapisuje wywołania (z czasem wg `Date.now`) i pilnuje, czy coś gra. */
export class FakeNarrationPlayer implements NarrationPlayer {
  readonly calls: FakePlayerCall[] = [];
  state: 'idle' | 'playing' | 'paused' | 'disposed' = 'idle';
  source: number | null = null;
  /** Akcja, przy której odtwarzacz rzuci wyjątek (symulacja błędu `expo-audio`). */
  failOn: FakePlayerCall['action'] | null = null;

  play(source: number) {
    this.record({ action: 'play', source, at: Date.now() });
    this.source = source;
    this.state = 'playing';
  }

  pause() {
    this.record({ action: 'pause', at: Date.now() });
    this.state = 'paused';
  }

  resume() {
    this.record({ action: 'resume', at: Date.now() });
    this.state = 'playing';
  }

  stop() {
    this.record({ action: 'stop', at: Date.now() });
    this.state = 'idle';
  }

  dispose() {
    this.record({ action: 'dispose', at: Date.now() });
    this.state = 'disposed';
  }

  actions() {
    return this.calls.map((c) => c.action);
  }

  private record(call: FakePlayerCall) {
    if (this.state === 'disposed') throw new Error(`Odtwarzacz zwolniony, a wywołano ${call.action}`);
    this.calls.push(call);
    if (this.failOn === call.action) throw new Error(`Awaria odtwarzacza przy ${call.action}`);
  }
}
