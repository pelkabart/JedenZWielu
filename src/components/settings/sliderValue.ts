/** Wartość suwaka 0–100 z położenia palca na torze o szerokości `width` (poza torem = koniec zakresu). */
export function sliderValue(x: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(x)) return 0;
  return Math.min(100, Math.max(0, Math.round((x / width) * 100)));
}

/** Krok dla czytnika ekranu („zwiększ” / „zmniejsz”). */
export const SLIDER_STEP = 10;

export function stepSlider(value: number, direction: 1 | -1): number {
  return Math.min(100, Math.max(0, value + direction * SLIDER_STEP));
}
