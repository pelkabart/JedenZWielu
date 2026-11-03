import type { Expression } from './catalog';

export const IDLE_FACE = {
  minDelayMs: 2500,
  maxDelayMs: 6000,
  blinkMs: 150,
  smileMs: 1800,
};

export interface IdleFaceOptions {
  onChange: (expression: Expression) => void;
  /** Szansa, że zamiast mrugnięcia postać się uśmiechnie (0–1). */
  smileChance?: number;
  rng?: () => number;
}

/** Mimika postaci, która nic nie robi: co kilka sekund mrugnięcie albo uśmiech. Każda postać ma własny rytm. */
export class IdleFace {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onChange: (expression: Expression) => void;
  private readonly smileChance: number;
  private readonly rng: () => number;

  constructor({ onChange, smileChance = 0, rng = Math.random }: IdleFaceOptions) {
    this.onChange = onChange;
    this.smileChance = smileChance;
    this.rng = rng;
  }

  start() {
    this.stop();
    this.scheduleNext();
  }

  stop() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext() {
    const delay = IDLE_FACE.minDelayMs + this.rng() * (IDLE_FACE.maxDelayMs - IDLE_FACE.minDelayMs);
    this.timer = setTimeout(() => this.showExpression(), delay);
  }

  private showExpression() {
    const smile = this.rng() < this.smileChance;
    this.onChange(smile ? 'smile' : 'closed-eyes');
    this.timer = setTimeout(
      () => {
        this.onChange('normal');
        this.scheduleNext();
      },
      smile ? IDLE_FACE.smileMs : IDLE_FACE.blinkMs,
    );
  }
}
