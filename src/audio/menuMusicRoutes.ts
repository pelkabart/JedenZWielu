/** Ekrany z własną muzyką: tu muzyka menu milknie. */
const ROUTES_WITHOUT_MENU_MUSIC = ['/solo/game'];

/** Czy na tym ekranie gra muzyka menu. Domyślnie tak, więc nowy ekran nie musi o niej pamiętać. */
export function playsMenuMusic(pathname: string): boolean {
  return !ROUTES_WITHOUT_MENU_MUSIC.includes(pathname);
}
