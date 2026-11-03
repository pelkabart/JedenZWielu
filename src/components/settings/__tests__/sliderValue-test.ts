import { SLIDER_STEP, sliderValue, stepSlider } from '../sliderValue';

describe('sliderValue', () => {
  it.each([
    [0, 200, 0],
    [100, 200, 50],
    [200, 200, 100],
    [-30, 200, 0],
    [260, 200, 100],
    [1, 300, 0],
    [2, 300, 1],
  ])('x=%p, szerokość=%p → %p', (x, width, expected) => {
    expect(sliderValue(x, width)).toBe(expected);
  });

  it('tor jeszcze bez rozmiaru albo zły odczyt: 0 zamiast NaN', () => {
    expect(sliderValue(50, 0)).toBe(0);
    expect(sliderValue(NaN, 200)).toBe(0);
  });
});

describe('stepSlider', () => {
  it('krok dla czytnika ekranu, w granicach 0–100', () => {
    expect(stepSlider(50, 1)).toBe(50 + SLIDER_STEP);
    expect(stepSlider(50, -1)).toBe(50 - SLIDER_STEP);
    expect(stepSlider(95, 1)).toBe(100);
    expect(stepSlider(5, -1)).toBe(0);
  });
});
