/** Sprawdza prawdziwy folder `assets/skins`, więc źle przygotowana nowa skórka zatrzyma testy przed wydaniem. */
import { BOT_PROFILES } from '@/game/bots/profiles';
import { SOLO_PLAYER_COUNT } from '@/game/rules';
import { clearLog, getLogEntries } from '@/lib/log';

import { availableBotSkins } from '../assignSkins';
import { buildCatalog, EXPRESSIONS } from '../catalog';
import { diskSkinFiles, listSkinPaths, pngColorType } from '../testing/diskSkins';

const RGBA = 6;

describe('prawdziwe skórki', () => {
  it('każdy plik pasuje do konwencji i każda skórka ma komplet klatek', () => {
    clearLog();
    const catalog = buildCatalog(diskSkinFiles());
    expect(getLogEntries({ tag: 'skorki', minLevel: 'warn' })).toEqual([]);
    expect(diskSkinFiles()).toHaveLength(
      EXPRESSIONS.length * (catalog.male.length + catalog.female.length + catalog.player.length + (catalog.host ? 1 : 0)),
    );
  });

  it('każdy plik ma kanał alfa', () => {
    const withoutAlpha = listSkinPaths().filter((path) => pngColorType(path) !== RGBA);
    expect(withoutAlpha).toEqual([]);
  });

  it('jest prowadzący, skórka gracza i dość skórek na pełny skład botów', () => {
    const catalog = buildCatalog(diskSkinFiles());
    const available = availableBotSkins(catalog);
    expect(catalog.host).not.toBeNull();
    expect(catalog.player.length).toBeGreaterThan(0);
    expect(BOT_PROFILES.filter((p) => available.has(p.skinId)).length).toBeGreaterThanOrEqual(SOLO_PLAYER_COUNT - 1);
  });

  it('każda skórka bota ma właściciela w profilach (inaczej nigdy nie pojawi się w grze)', () => {
    const owned = new Set(BOT_PROFILES.map((p) => p.skinId));
    const orphans = [...availableBotSkins(buildCatalog(diskSkinFiles()))].filter((id) => !owned.has(id));
    expect(orphans).toEqual([]);
  });

  it('nazwy zasobów Androida są unikalne', () => {
    // Tak Metro spłaszcza ścieżkę assetu na nazwę zasobu `drawable` przy budowaniu APK.
    const names = listSkinPaths().map((path) =>
      path
        .slice(2)
        .toLowerCase()
        .replace(/\//g, '_')
        .replace(/[^a-z0-9_.]/g, ''),
    );
    expect(new Set(names).size).toBe(names.length);
  });
});
