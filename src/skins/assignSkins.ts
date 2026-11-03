import { getBotProfile, type GenderLimits } from '@/game/bots/profiles';
import { shuffle, type Rng } from '@/game/rng';
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

/** Ilu botów każdej płci może wejść do gry, żeby każdy dostał własną skórkę. */
export function genderLimits(catalog: SkinCatalog): GenderLimits {
  return { male: catalog.male.length, female: catalog.female.length };
}

/**
 * Bot dostaje skórkę swojej płci, każdą najwyżej raz. Gracz ma własną pulę, która nie pokrywa się z botami.
 * `rng` powinien być osobnym generatorem: losowania generatora gry zmieniłyby jej przebieg.
 */
export function assignSkins(
  players: readonly SkinnedPlayer[],
  catalog: SkinCatalog,
  humanSkinId: string | null,
  rng: Rng,
): SkinAssignment {
  const pools = { male: shuffle(rng, catalog.male), female: shuffle(rng, catalog.female) };
  const assignment: SkinAssignment = {};

  for (const player of players) {
    if (player.isHuman) {
      assignment[player.id] = catalog.player.find((skin) => skin.id === humanSkinId) ?? catalog.player[0] ?? null;
    } else {
      const gender = player.botId ? getBotProfile(player.botId).gender : null;
      assignment[player.id] = gender ? (pools[gender].pop() ?? null) : null;
    }
    if (assignment[player.id] === null) log.warn('Brak skórki dla gracza', { playerId: player.id });
  }
  log.info('Przydzielono skórki', {
    skins: players.map((player) => `${player.id}=${assignment[player.id]?.id ?? 'brak'}`).join(','),
  });
  return assignment;
}
