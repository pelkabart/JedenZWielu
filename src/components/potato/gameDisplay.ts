import type { PotatoOverlay } from '@/game/potato/controller/PotatoController';
import type { Question } from '@/game/types';

/**
 * Co pokazać na ekranie gry. Silnik rozdaje następne pytanie już przy zatwierdzeniu odpowiedzi,
 * więc w czasie wyniku widać to, na które odpowiadano, a w czasie planszy żadne: inaczej gracz
 * czytałby kolejne pytanie, zanim ruszy jego czas. Przy wskazywaniu pytanie jest już rozliczone.
 */
export function shownQuestion(overlay: PotatoOverlay | null, current: Question | null, picking = false): Question | null {
  if (picking) return null;
  if (overlay === null) return current;
  return overlay.kind === 'reveal' ? overlay.question : null;
}

/** Kogo podświetlić: tego, kto właśnie odpowiedział, a nie tego, kto dostanie następne pytanie. */
export function spotlightId(overlay: PotatoOverlay | null, holderId: string | null): string | null {
  if (overlay === null) return holderId;
  return overlay.kind === 'reveal' ? overlay.playerId : null;
}

/** Tryb odbicia w ciemno dotyczy tylko pytania, przy którym go włączono. */
export function blindModeOn(armedAtCursor: number | null, cursor: number, available: boolean): boolean {
  return available && armedAtCursor === cursor;
}

/**
 * Pełne sekundy do końca, jak na zegarze: 5, 4, 3, 2, 1. Przed startem licznika `null`.
 * `now` może być starsze niż początek licznika, więc wynik nie przekracza `totalMs`.
 */
export function secondsLeft(deadline: number | null, now: number, totalMs: number | null = null): number | null {
  if (deadline === null) return null;
  const left = totalMs === null ? deadline - now : Math.min(deadline - now, totalMs);
  return Math.max(0, Math.ceil(left / 1000));
}

/** Kolory miejsc przy stole, gdy postać nie ma skórki. */
export const SEAT_COLORS = ['#FF7A9C', '#4FD1E8', '#FFC83D', '#8BE07A', '#B98CFF'];

const MULTIPLIER_COLORS = ['#FFC83D', '#FF9F2E', '#FF3D57'];

/** Im wyższy mnożnik, tym groźniejszy kolor: od żółtego do czerwonego. */
export function multiplierColor(multiplier: number): string {
  const level = Math.max(1, Math.floor(multiplier)) - 1;
  return MULTIPLIER_COLORS[Math.min(level, MULTIPLIER_COLORS.length - 1)];
}

/** Napis na środku ekranu po zmianie mnożnika: spadek do ×1 to wybuch. */
export function multiplierBurstText(multiplier: number): string {
  return multiplier > 1 ? `×${multiplier}` : 'BUM!';
}
