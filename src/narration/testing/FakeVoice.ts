import type { Voice } from '../NarrationDirector';

export type FakeVoiceCall = { action: 'say'; texts: string[]; at: number } | { action: 'pause' | 'resume' | 'stop' | 'dispose'; at: number };

/**
 * Atrapa lektora. Zapisuje wywołania (z czasem wg `Date.now`) i udaje mowę:
 * wypowiedź trwa `msPerChar` na znak (na udawanym zegarze Jesta), pauza ją wstrzymuje.
 * Z `msPerChar = null` wypowiedź kończy się dopiero po `finish()`.
 */
export class FakeVoice implements Voice {
  readonly calls: FakeVoiceCall[] = [];
  state: 'idle' | 'speaking' | 'paused' | 'disposed' = 'idle';
  texts: string[] = [];
  /** Akcja, przy której lektor rzuci wyjątek albo (dla `say`) odrzuci obietnicę. */
  failOn: FakeVoiceCall['action'] | null = null;
  private resolve: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private remainingMs = 0;
  private startedAt = 0;

  constructor(private readonly msPerChar: number | null = null) {}

  say(texts: string[]): Promise<void> {
    this.record({ action: 'say', texts, at: Date.now() });
    if (this.failOn === 'say') return Promise.reject(new Error('Awaria syntezy'));
    this.texts = texts;
    this.state = 'speaking';
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
      if (this.msPerChar !== null) {
        this.remainingMs = texts.join(' ').length * this.msPerChar;
        this.run();
      }
    });
  }

  /** Lektor skończył mówić. */
  finish() {
    this.clear();
    this.state = 'idle';
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  pause() {
    this.record({ action: 'pause', at: Date.now() });
    if (this.timer) this.remainingMs -= Date.now() - this.startedAt;
    this.clear();
    this.state = 'paused';
  }

  resume() {
    this.record({ action: 'resume', at: Date.now() });
    this.state = 'speaking';
    if (this.msPerChar !== null) this.run();
  }

  stop() {
    this.record({ action: 'stop', at: Date.now() });
    this.finish();
  }

  dispose() {
    this.record({ action: 'dispose', at: Date.now() });
    this.finish();
    this.state = 'disposed';
  }

  actions() {
    return this.calls.map((c) => c.action);
  }

  /** Teksty kolejnych wypowiedzi. */
  utterances() {
    return this.calls.flatMap((c) => (c.action === 'say' ? [c.texts] : []));
  }

  private run() {
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.finish(), this.remainingMs);
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private record(call: FakeVoiceCall) {
    if (this.state === 'disposed') throw new Error(`Lektor zwolniony, a wywołano ${call.action}`);
    this.calls.push(call);
    if (this.failOn === call.action && call.action !== 'say') throw new Error(`Awaria lektora przy ${call.action}`);
  }
}
