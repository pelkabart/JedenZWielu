import { BOT_PROFILES } from '@/game/bots/profiles';
import { clearLog, getLogEntries } from '@/lib/log';

import { assignSkins, availableBotSkins } from '../assignSkins';
import { buildCatalog } from '../catalog';
import { botSkinFiles, hostFiles, skinFiles } from '../testing/fixtures';

const human: { id: string; isHuman: boolean; botId?: string } = { id: 'human', isHuman: true };
const asPlayer = (botId: string) => ({ id: botId, isHuman: false, botId });
const catalogFor = (profiles: typeof BOT_PROFILES) => buildCatalog([...botSkinFiles(profiles), ...skinFiles('player', '201'), ...hostFiles()]);

beforeEach(() => {
  clearLog();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('assignSkins', () => {
  it('każdy bot dostaje skórkę ze swojego profilu', () => {
    const assignment = assignSkins(BOT_PROFILES.map((p) => asPlayer(p.id)), catalogFor(BOT_PROFILES), null);
    for (const profile of BOT_PROFILES) expect(assignment[profile.id]?.id).toBe(profile.skinId);
  });

  it('gracz dostaje wybraną skórkę', () => {
    const catalog = buildCatalog([...skinFiles('player', '201'), ...skinFiles('player', '202')]);
    expect(assignSkins([human], catalog, 'player/202').human?.id).toBe('player/202');
  });

  it('nieznana wybrana skórka: gracz dostaje pierwszą dostępną', () => {
    const catalog = catalogFor([]);
    expect(assignSkins([human], catalog, 'player/usunieta').human?.id).toBe('player/201');
    expect(assignSkins([human], catalog, null).human?.id).toBe('player/201');
  });

  it('brak pliku skórki: bot zostaje bez niej i jest ostrzeżenie', () => {
    const [owner, second, third] = BOT_PROFILES;
    const assignment = assignSkins([owner, second, third].map((p) => asPlayer(p.id)), catalogFor([owner]), null);
    expect(assignment[owner.id]?.id).toBe(owner.skinId);
    expect(assignment[second.id]).toBeNull();
    expect(assignment[third.id]).toBeNull();
    expect(getLogEntries({ tag: 'skorki', minLevel: 'warn' })).toHaveLength(2);
  });
});

describe('availableBotSkins', () => {
  it('zawiera skórki botów, bez gracza i prowadzącego', () => {
    const [first, second] = BOT_PROFILES;
    expect(availableBotSkins(catalogFor([first, second]))).toEqual(new Set([first.skinId, second.skinId]));
  });
});
