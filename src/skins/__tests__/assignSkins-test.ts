import { getBotProfile, pickOpponents } from '@/game/bots/profiles';
import { createRng } from '@/game/rng';
import { clearLog, getLogEntries } from '@/lib/log';

import { assignSkins, genderLimits } from '../assignSkins';
import { buildCatalog } from '../catalog';
import { hostFiles, skinFiles, standardFiles } from '../testing/fixtures';

const human: { id: string; isHuman: boolean; botId?: string } = { id: 'human', isHuman: true };

function playersFor(seed: number, catalog = buildCatalog(standardFiles())) {
  const bots = pickOpponents(createRng(seed), 4, genderLimits(catalog)).map((p) => ({ id: p.id, isHuman: false, botId: p.id }));
  return [human, ...bots];
}

beforeEach(() => {
  clearLog();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('assignSkins', () => {
  it('płeć i brak powtórek na wielu ziarnach', () => {
    const catalog = buildCatalog(standardFiles());
    for (let seed = 0; seed < 500; seed++) {
      const players = playersFor(seed, catalog);
      const assignment = assignSkins(players, catalog, 'player/201', createRng(seed + 1));
      const ids = players.map((p) => assignment[p.id]?.id);
      expect(ids).not.toContain(undefined);
      expect(new Set(ids).size).toBe(players.length);
      for (const player of players) {
        const skin = assignment[player.id]!;
        expect(skin.pool).toBe(player.botId ? getBotProfile(player.botId).gender : 'player');
      }
    }
  });

  it('gracz dostaje wybraną skórkę', () => {
    const catalog = buildCatalog([...standardFiles(), ...skinFiles('player', '202')]);
    const assignment = assignSkins(playersFor(1, catalog), catalog, 'player/202', createRng(1));
    expect(assignment.human?.id).toBe('player/202');
  });

  it('nieznana wybrana skórka: gracz dostaje pierwszą dostępną', () => {
    const catalog = buildCatalog(standardFiles());
    expect(assignSkins([human], catalog, 'player/usunieta', createRng(1)).human?.id).toBe('player/201');
    expect(assignSkins([human], catalog, null, createRng(1)).human?.id).toBe('player/201');
  });

  it('z czasem używa wszystkich skórek, także nowych', () => {
    const catalog = buildCatalog([...standardFiles(), ...skinFiles('male', '004'), ...skinFiles('female', '104')]);
    const used = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const assignment = assignSkins(playersFor(seed, catalog), catalog, null, createRng(seed + 7));
      Object.values(assignment).forEach((skin) => used.add(skin!.id));
    }
    expect(used.size).toBe(catalog.male.length + catalog.female.length + catalog.player.length);
  });

  it('brak skórki: bot zostaje bez niej zamiast dostać skórkę drugiej płci', () => {
    const catalog = buildCatalog([...skinFiles('male', '001'), ...hostFiles()]);
    const bots = ['profesor', 'bartek', 'krysia'].map((id) => ({ id, isHuman: false, botId: id }));
    const assignment = assignSkins(bots, catalog, null, createRng(3));
    const skinned = bots.filter((b) => assignment[b.id] !== null);
    expect(skinned).toHaveLength(1);
    expect(getBotProfile(skinned[0].id).gender).toBe('male');
    expect(assignment.krysia).toBeNull();
    expect(getLogEntries({ tag: 'skorki', minLevel: 'warn' })).toHaveLength(2);
  });

  it('ten sam generator daje ten sam przydział', () => {
    const catalog = buildCatalog(standardFiles());
    const players = playersFor(4, catalog);
    const ids = (seed: number) => players.map((p) => assignSkins(players, catalog, null, createRng(seed))[p.id]?.id);
    expect(ids(9)).toEqual(ids(9));
  });
});

describe('genderLimits', () => {
  it('odpowiadają liczbie skórek', () => {
    expect(genderLimits(buildCatalog(standardFiles()))).toEqual({ male: 3, female: 3 });
  });
});
