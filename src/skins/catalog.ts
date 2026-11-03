import { createLogger } from '@/lib/log';

const log = createLogger('skorki');

export const EXPRESSIONS = ['normal', 'smile', 'closed-eyes'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const POOLS = ['male', 'female', 'player', 'host'] as const;
export type SkinPool = (typeof POOLS)[number];

/** Wynik `require` na grafice: liczba na telefonie, obiekt na webie. */
export type SkinAsset = number | { uri?: string };

export interface Skin {
  /** Np. `male/001`; unikalne także między pulami. */
  id: string;
  pool: SkinPool;
  frames: Record<Expression, SkinAsset>;
}

export interface SkinCatalog {
  male: Skin[];
  female: Skin[];
  player: Skin[];
  host: Skin | null;
}

export interface SkinFile {
  /** Ścieżka względem `assets/skins`, np. `./male/001/001-smile.png`. */
  path: string;
  asset: SkinAsset;
}

/** `./<pula>/[<id>/]<cokolwiek>-<mimika>.png`; prowadzący leży bezpośrednio w swoim folderze. */
const SKIN_FILE = /^\.\/([^/]+)\/(?:([^/]+)\/)?[^/]*-(normal|smile|closed-eyes)\.png$/;

const isPool = (value: string): value is SkinPool => (POOLS as readonly string[]).includes(value);

/** Układa katalog z listy plików. Pula, id i mimika wynikają wyłącznie ze ścieżki. */
export function buildCatalog(files: readonly SkinFile[]): SkinCatalog {
  const found = new Map<string, { pool: SkinPool; frames: Partial<Record<Expression, SkinAsset>> }>();

  for (const { path, asset } of files) {
    const match = SKIN_FILE.exec(path);
    if (!match || !isPool(match[1])) {
      log.warn('Pominięto nieznany plik skórki', { path });
      continue;
    }
    const pool = match[1];
    const id = `${pool}/${match[2] ?? 'default'}`;
    const entry = found.get(id) ?? { pool, frames: {} };
    entry.frames[match[3] as Expression] = asset;
    found.set(id, entry);
  }

  const catalog: SkinCatalog = { male: [], female: [], player: [], host: null };
  for (const id of [...found.keys()].sort()) {
    const { pool, frames } = found.get(id)!;
    const normal = frames.normal;
    if (normal === undefined) {
      log.warn('Pominięto skórkę bez klatki normal', { id });
      continue;
    }
    const missing = EXPRESSIONS.filter((expression) => frames[expression] === undefined);
    if (missing.length > 0) log.warn('Skórce brakuje klatek, użyta będzie normal', { id, missing: missing.join(',') });
    const skin: Skin = {
      id,
      pool,
      frames: {
        normal,
        smile: frames.smile ?? normal,
        'closed-eyes': frames['closed-eyes'] ?? normal,
      },
    };
    if (pool === 'host') catalog.host ??= skin;
    else catalog[pool].push(skin);
  }
  log.info('Wczytano skórki', {
    male: catalog.male.length,
    female: catalog.female.length,
    player: catalog.player.length,
    host: catalog.host !== null,
  });
  return catalog;
}
