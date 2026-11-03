import { playsMenuMusic } from '../menuMusicRoutes';

interface NodeFs {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
}

const fs = jest.requireActual<NodeFs>('fs');

/** Trasy z plików w `src/app`, tak jak liczy je Expo Router. */
function allRoutes(folder = ''): string[] {
  return fs.readdirSync(`src/app${folder}`, { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) return allRoutes(path);
    if (entry.name.startsWith('_')) return [];
    return [path.replace(/\.tsx$/, '').replace(/\/index$/, '') || '/'];
  });
}

describe('playsMenuMusic', () => {
  it('gra na każdym ekranie aplikacji poza rozgrywką', () => {
    const routes = allRoutes();
    expect(routes).toEqual(expect.arrayContaining(['/', '/settings', '/categories', '/solo', '/solo/game']));
    expect(routes.filter((route) => !playsMenuMusic(route))).toEqual(['/solo/game']);
  });
});
