import { decideAnswer, decideBuzz, decideTarget, type BotAnswer, type BotContext } from './bots/brain';
import { AVERAGE_PLAYER_PROFILE, getBotProfile, type BotProfile } from './bots/profiles';
import { activePlayers, reduce } from './engine';
import type { Rng } from './rng';
import type { GameState, PlayerState, Question } from './types';

const MAX_STEPS = 10000;

export interface SimulationOptions {
  rng: Rng;
  bank?: Question[];
  /** Profil, którym gra człowiek (domyślnie przeciętny gracz). */
  humanProfile?: BotProfile;
  getProfile?: (botId: string) => BotProfile;
}

function profileFor(player: PlayerState, humanProfile: BotProfile, getProfile: (botId: string) => BotProfile): BotProfile {
  if (player.isHuman) return humanProfile;
  if (!player.botId) throw new Error(`Bot ${player.id} nie ma profilu`);
  return getProfile(player.botId);
}

/** Rozgrywa grę do końca, sterując wszystkimi uczestnikami jak botami. */
export function simulateGame(initial: GameState, { rng, bank, humanProfile = AVERAGE_PLAYER_PROFILE, getProfile = getBotProfile }: SimulationOptions) {
  let state = initial;
  const ctx = (player: PlayerState): BotContext => ({
    profile: profileFor(player, humanProfile, getProfile),
    // Poziom trudności wzmacnia tylko boty; "człowiek" gra zawsze tak samo.
    difficulty: player.isHuman ? 'normal' : state.difficulty,
    rng,
    bank,
  });

  for (let step = 0; step < MAX_STEPS; step++) {
    const pending = state.pending;
    switch (pending.kind) {
      case 'none':
        return state;
      case 'answer': {
        const player = state.players.find((p) => p.id === pending.playerId)!;
        const answer = decideAnswer(ctx(player), pending.question, state.rules);
        state = reduce(state, { type: 'answer', playerId: player.id, text: answer.text });
        break;
      }
      case 'buzz': {
        let winner: { id: string; delayMs: number; answer: BotAnswer } | null = null;
        for (const player of activePlayers(state)) {
          const buzz = decideBuzz(ctx(player), pending.question, state.rules);
          if (buzz.delayMs !== null && (winner === null || buzz.delayMs < winner.delayMs)) {
            winner = { id: player.id, delayMs: buzz.delayMs, answer: buzz.answer };
          }
        }
        if (winner === null) {
          state = reduce(state, { type: 'noBuzz' });
        } else {
          state = reduce(state, { type: 'buzz', playerId: winner.id });
          state = reduce(state, { type: 'answer', playerId: winner.id, text: winner.answer.text });
        }
        break;
      }
      case 'pick': {
        const chooser = state.players.find((p) => p.id === pending.chooserId)!;
        const targetId = decideTarget(ctx(chooser), state, chooser.id);
        state = reduce(state, { type: 'pick', chooserId: chooser.id, targetId });
        break;
      }
    }
  }
  throw new Error(`Symulacja nie zakończyła się w ${MAX_STEPS} krokach`);
}
