import { getBotProfile } from '@/game/bots/profiles';
import { createLogger } from '@/lib/log';

import type { Skin, SkinCatalog } from './catalog';

const log = createLogger('skorki');

/** Id gracza → skórka; `null` oznacza rysunek zastępczy (zabrakło skórek w puli). */
export type SkinAssignment = Record<string, Skin | null>;

interface SkinnedPlayer {
  id: string;
  isHuman: boolean;
  botId?: string;
}

/** Skórki, które mogą należeć do botów. Bot z `skinId` spoza tego zbioru nie wchodzi do gry. */
export function availableBotSkins(catalog: SkinCatalog): Set<string> {
  return new Set([...catalog.male, ...catalog.female].map((skin) => skin.id));
}

/** Bot ma stałą skórkę z profilu (`skinId`). Gracz ma własną pulę, która nie pokrywa się z botami. */
export function assignSkins(players: readonly SkinnedPlayer[], catalog: SkinCatalog, humanSkinId: string | null): SkinAssignment {
  const botSkins = [...catalog.male, ...catalog.female];
  const assignment: SkinAssignment = {};

  for (const player of players) {
    if (player.isHuman) {
      assignment[player.id] = catalog.player.find((skin) => skin.id === humanSkinId) ?? catalog.player[0] ?? null;
    } else {
      const skinId = player.botId ? getBotProfile(player.botId).skinId : null;
      assignment[player.id] = botSkins.find((skin) => skin.id === skinId) ?? null;
    }
    if (assignment[player.id] === null) log.warn('Brak skórki dla gracza', { playerId: player.id });
  }
  log.info('Przydzielono skórki', {
    skins: players.map((player) => `${player.id}=${assignment[player.id]?.id ?? 'brak'}`).join(','),
  });
  return assignment;
}
