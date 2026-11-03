import { clearLog, getLogEntries } from '@/lib/log';

import { buildCatalog } from '../catalog';
import { hostFiles, skinFiles, standardFiles } from '../testing/fixtures';

const warnings = () => getLogEntries({ tag: 'skorki', minLevel: 'warn' });

beforeEach(() => {
  clearLog();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('buildCatalog', () => {
  it('rozkłada skórki na pule według folderów', () => {
    const catalog = buildCatalog(standardFiles());
    expect(catalog.male.map((s) => s.id)).toEqual(['male/001', 'male/002', 'male/003']);
    expect(catalog.female.map((s) => s.id)).toEqual(['female/101', 'female/102', 'female/103']);
    expect(catalog.player.map((s) => s.id)).toEqual(['player/201']);
    expect(catalog.host?.pool).toBe('host');
    expect(warnings()).toEqual([]);
  });

  it('każda klatka trafia pod swoją mimikę', () => {
    const [skin] = buildCatalog(skinFiles('male', '001')).male;
    const assets = skinFiles('male', '001').map((f) => f.asset);
    expect([skin.frames.normal, skin.frames.smile, skin.frames['closed-eyes']]).toEqual(assets);
  });

  it('nowy folder pojawia się bez zmian w kodzie', () => {
    const catalog = buildCatalog([...standardFiles(), ...skinFiles('female', 'nowa-104'), ...skinFiles('player', '202')]);
    expect(catalog.female.map((s) => s.id)).toContain('female/nowa-104');
    expect(catalog.player.map((s) => s.id)).toEqual(['player/201', 'player/202']);
  });

  it('brak klatki normal: skórka jest pomijana z ostrzeżeniem', () => {
    const files = skinFiles('male', '001').filter((f) => !f.path.endsWith('-normal.png'));
    expect(buildCatalog(files).male).toEqual([]);
    expect(warnings().map((w) => w.message)).toContain('Pominięto skórkę bez klatki normal');
  });

  it('brak innej klatki: zastępuje ją normal', () => {
    const files = skinFiles('male', '001').filter((f) => !f.path.endsWith('-smile.png'));
    const [skin] = buildCatalog(files).male;
    expect(skin.frames.smile).toBe(skin.frames.normal);
    expect(warnings()).toHaveLength(1);
  });

  it('nieznany plik: pomijany z ostrzeżeniem', () => {
    const catalog = buildCatalog([
      { path: './male/001/001-eyes-closed.png', asset: 1 },
      { path: './male/001/podglad.png', asset: 2 },
      { path: './aliens/301/301-normal.png', asset: 3 },
      ...skinFiles('male', '002'),
    ]);
    expect(catalog.male.map((s) => s.id)).toEqual(['male/002']);
    expect(warnings()).toHaveLength(3);
  });

  it('brak prowadzącego i pusty folder nie wywracają katalogu', () => {
    expect(buildCatalog([])).toEqual({ male: [], female: [], player: [], host: null });
    expect(buildCatalog(hostFiles()).host).not.toBeNull();
  });
});
