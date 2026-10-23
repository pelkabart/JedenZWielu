import { pickOpponents } from './bots/profiles';
import { createGame } from './engine';
import { DIFFICULTY_PRESETS, SOLO_PLAYER_COUNT } from './rules';
import { randomInt, type Rng } from './rng';
import type { Difficulty, GameState, PlayerSetup, Question, Rules } from './types';

export const HUMAN_ID = 'human';

export interface SoloSetup {
  difficulty: Difficulty;
  humanName: string;
  questions: Question[];
  rng: Rng;
  rules?: Partial<Rules>;
}

/** Gra jednoosobowa: człowiek + 4 losowo dobrane boty. */
export function createSoloGame({ difficulty, humanName, questions, rng, rules }: SoloSetup): GameState {
  const bots: PlayerSetup[] = pickOpponents(rng, SOLO_PLAYER_COUNT - 1).map((profile) => ({
    id: profile.id,
    name: profile.name,
    isHuman: false,
    botId: profile.id,
  }));
  // Gracz siada na losowym miejscu, więc nie zawsze odpowiada pierwszy.
  const players: PlayerSetup[] = [...bots];
  players.splice(randomInt(rng, 0, bots.length), 0, { id: HUMAN_ID, name: humanName, isHuman: true });
  // Czas odpowiedzi zależy od poziomu; jawnie podane `rules` go nadpisują.
  const timed = { answerTimeMs: DIFFICULTY_PRESETS[difficulty].answerTimeMs, ...rules };
  return createGame({ players, difficulty, questions, rng, rules: timed });
}
