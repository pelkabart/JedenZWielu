/** Te same granice co na serwerze (`server/src/rooms.ts`) – serwer i tak sprawdza je drugi raz. */
export const NICK_MIN = 2;
export const NICK_MAX = 16;

/** Przycina i skleja spacje. Zwraca `null`, gdy nick po tym ma złą długość. */
export function normalizeNick(raw: string): string | null {
  const nick = raw.trim().replace(/\s+/g, ' ');
  return nick.length >= NICK_MIN && nick.length <= NICK_MAX ? nick : null;
}
