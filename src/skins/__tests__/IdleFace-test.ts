import type { Expression } from '../catalog';
import { hostExpression, podiumExpression } from '../expression';
import { IDLE_FACE, IdleFace } from '../IdleFace';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup(rngValue: number, smileChance = 0) {
  const seen: Expression[] = [];
  const face = new IdleFace({ onChange: (e) => seen.push(e), smileChance, rng: () => rngValue });
  return { seen, face };
}

describe('IdleFace', () => {
  it('nie zmienia mimiki przed upływem przerwy', () => {
    const { seen, face } = setup(0);
    face.start();
    jest.advanceTimersByTime(IDLE_FACE.minDelayMs - 1);
    expect(seen).toEqual([]);
    face.stop();
  });

  it('mruga krótko i wraca do otwartych oczu', () => {
    const { seen, face } = setup(0.5);
    face.start();
    const delay = IDLE_FACE.minDelayMs + 0.5 * (IDLE_FACE.maxDelayMs - IDLE_FACE.minDelayMs);
    jest.advanceTimersByTime(delay);
    expect(seen).toEqual(['closed-eyes']);
    jest.advanceTimersByTime(IDLE_FACE.blinkMs);
    expect(seen).toEqual(['closed-eyes', 'normal']);
    face.stop();
  });

  it('mruga wielokrotnie', () => {
    const { seen, face } = setup(0);
    face.start();
    jest.advanceTimersByTime(3 * (IDLE_FACE.minDelayMs + IDLE_FACE.blinkMs));
    expect(seen.filter((e) => e === 'closed-eyes')).toHaveLength(3);
    face.stop();
  });

  it('przy szansie na uśmiech uśmiecha się dłużej niż mruga', () => {
    const { seen, face } = setup(0, 1);
    face.start();
    jest.advanceTimersByTime(IDLE_FACE.minDelayMs);
    expect(seen).toEqual(['smile']);
    jest.advanceTimersByTime(IDLE_FACE.smileMs - 1);
    expect(seen).toEqual(['smile']);
    jest.advanceTimersByTime(1);
    expect(seen).toEqual(['smile', 'normal']);
    face.stop();
  });

  it('stop kasuje zegar, także w trakcie mrugnięcia', () => {
    const { seen, face } = setup(0);
    face.start();
    jest.advanceTimersByTime(IDLE_FACE.minDelayMs);
    face.stop();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(seen).toEqual(['closed-eyes']);
  });

  it('ponowny start nie dubluje zegarów', () => {
    const { face } = setup(0);
    face.start();
    face.start();
    expect(jest.getTimerCount()).toBe(1);
    face.stop();
  });
});

describe('mimika w grze', () => {
  it('dobra odpowiedź to uśmiech, zła to zamknięte oczy', () => {
    expect(podiumExpression({ kind: 'answer', correct: true }, 'normal')).toBe('smile');
    expect(podiumExpression({ kind: 'answer', correct: false }, 'normal')).toBe('closed-eyes');
  });

  it('reakcja na odpowiedź ma pierwszeństwo przed mruganiem', () => {
    expect(podiumExpression({ kind: 'answer', correct: true }, 'closed-eyes')).toBe('smile');
  });

  it('bez odpowiedzi działa mruganie', () => {
    expect(podiumExpression(null, 'closed-eyes')).toBe('closed-eyes');
    expect(podiumExpression({ kind: 'thinking' }, 'normal')).toBe('normal');
  });

  it('prowadzący uśmiecha się, gdy trzeba, a poza tym mruga', () => {
    expect(hostExpression(true, 'closed-eyes')).toBe('smile');
    expect(hostExpression(false, 'closed-eyes')).toBe('closed-eyes');
  });
});
