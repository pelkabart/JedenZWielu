import { createGame, pickTargets, reduce } from '../engine';
import { createRng } from '../rng';
import type { GameState, Question, Rules } from '../types';

export const TEST_BANK: Question[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i}`,
  category: i % 2 === 0 ? 'Historia' : 'Sport',
  question: `Pytanie testowe ${i}?`,
  answers: [`odpowiedz${i}`],
  answerType: 'nazwa',
  difficulty: 2,
}));

export const PLAYER_IDS = ['p0', 'p1', 'p2', 'p3', 'p4'];

export function newGame(seed = 1, rules?: Partial<Rules>): GameState {
  return createGame({
    players: PLAYER_IDS.map((id) => ({ id, name: id.toUpperCase(), isHuman: true })),
    difficulty: 'normal',
    questions: TEST_BANK,
    rng: createRng(seed),
    rules,
  });
}

export function currentAnswerer(state: GameState): string {
  if (state.pending.kind !== 'answer') throw new Error(`Oczekiwano pytania, jest ${state.pending.kind}`);
  return state.pending.playerId;
}

export function answerRight(state: GameState): GameState {
  if (state.pending.kind !== 'answer') throw new Error(`Oczekiwano pytania, jest ${state.pending.kind}`);
  return reduce(state, { type: 'answer', playerId: state.pending.playerId, text: state.pending.question.answers[0] });
}

export function answerWrong(state: GameState): GameState {
  return reduce(state, { type: 'answer', playerId: currentAnswerer(state), text: 'zupelnie zle' });
}

export function lives(state: GameState) {
  return Object.fromEntries(state.players.map((p) => [p.id, p.lives]));
}

/** Etap I: wszyscy odpowiadają dobrze. */
export function passStage1(state: GameState): GameState {
  let s = state;
  while (s.phase === 'stage1') s = answerRight(s);
  return s;
}

/** Prowadzi grę do finału, eliminując wskazanych graczy (pozostali zawsze odpowiadają dobrze). */
export function driveToFinal(state: GameState, victims: string[]): GameState {
  let s = passStage1(state);
  for (let guard = 0; s.phase === 'stage2'; guard++) {
    if (guard > 200) throw new Error('Etap II nie kończy się');
    const pending = s.pending;
    if (pending.kind === 'answer') {
      s = victims.includes(pending.playerId) ? answerWrong(s) : answerRight(s);
    } else if (pending.kind === 'pick') {
      // Wskazujemy ofiarę, o ile zasady na to pozwalają (np. bot może być zmuszony wskazać człowieka).
      const allowed = pickTargets(s, pending.chooserId).map((p) => p.id);
      const target = victims.find((id) => allowed.includes(id)) ?? allowed[0];
      s = reduce(s, { type: 'pick', chooserId: pending.chooserId, targetId: target });
    }
  }
  return s;
}
