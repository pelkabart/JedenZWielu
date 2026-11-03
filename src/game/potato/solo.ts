import { pickOpponents, type GenderLimits } from '../bots/profiles';
import { randomInt, shuffle, type Rng } from '../rng';
import { SOLO_PLAYER_COUNT } from '../rules';
import type { PlayerSetup, Question } from '../types';
import { createPotatoGame, type PotatoState } from './engine';

export const HUMAN_ID = 'human';

export interface PotatoSoloSetup {
  humanName: string;
  questions: Question[];
  rng: Rng;
  /** Limit botów każdej płci (tyle, ile jest skórek). */
  botLimits?: GenderLimits;
}

/** Gra solo w nowych zasadach: człowiek i 4 losowo dobrane boty, człowiek siada na losowym miejscu. */
export function createPotatoSoloGame({ humanName, questions, rng, botLimits }: PotatoSoloSetup): PotatoState {
  const bots: PlayerSetup[] = pickOpponents(rng, SOLO_PLAYER_COUNT - 1, botLimits).map((profile) => ({
    id: profile.id,
    name: profile.name,
    isHuman: false,
    botId: profile.id,
  }));
  const players: PlayerSetup[] = [...bots];
  players.splice(randomInt(rng, 0, bots.length), 0, { id: HUMAN_ID, name: humanName, isHuman: true });
  return createPotatoGame({ players, deck: shuffle(rng, questions) });
}
