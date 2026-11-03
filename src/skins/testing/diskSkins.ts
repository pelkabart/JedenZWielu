import type { SkinFile } from '../catalog';

/** Tylko dla testów: aplikacja dostaje tę listę z `require.context`, a Jest czyta prawdziwy folder z dysku. */
interface NodeFs {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string): Uint8Array;
}

const fs = jest.requireActual<NodeFs>('fs');

export const SKINS_ROOT = 'assets/skins';

/** Ścieżki w formacie `require.context`, np. `./male/001/001-normal.png`. */
export function listSkinPaths(folder = '.'): string[] {
  return fs.readdirSync(`${SKINS_ROOT}/${folder}`, { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    return entry.isDirectory() ? listSkinPaths(path) : [path];
  });
}

export function diskSkinFiles(): SkinFile[] {
  return listSkinPaths().map((path, i) => ({ path, asset: i + 1 }));
}

/** Typ koloru z nagłówka PNG (bajt 25); 6 oznacza RGBA. */
export function pngColorType(path: string): number {
  return fs.readFileSync(`${SKINS_ROOT}/${path}`)[25];
}
