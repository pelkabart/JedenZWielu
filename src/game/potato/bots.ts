import { pickRandom, type Rng } from '../rng';
import { activePlayers, resourceOf, type PotatoState } from './engine';

/** Szansa, że bot wskaże lidera (pozostałe 40% to rywal z najmniejszym zasobem), wg PDF „Quiz Frenzy”. */
export const LEADER_TARGET_CHANCE = 0.6;

/**
 * Kogo bot wskazuje, gdy ma przekazać ziemniaka. Kandydaci: aktywni gracze inni niż `fromId`
 * (przy resecie po błędzie `fromId` = `null`, wtedy każdy aktywny). Priorytet: lider 60%, rywal o najmniejszym zasobie 40%.
 */
export function pickTarget(state: PotatoState, fromId: string | null, rng: Rng): string {
  const candidates = activePlayers(state).filter((p) => p.id !== fromId);
  if (candidates.length === 0) throw new Error('pickTarget: brak kandydatów');

  const top = Math.max(...candidates.map((p) => resourceOf(state, p)));
  const weakest = Math.min(...candidates.map((p) => resourceOf(state, p)));
  const leaders = candidates.filter((p) => resourceOf(state, p) === top);
  const weak = candidates.filter((p) => resourceOf(state, p) === weakest);

  const pool = rng() < LEADER_TARGET_CHANCE ? leaders : weak;
  return pickRandom(rng, pool.length > 0 ? pool : candidates).id;
}
