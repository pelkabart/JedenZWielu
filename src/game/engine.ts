import { isCorrectAnswer } from './answers';
import { DEFAULT_RULES } from './rules';
import { randomInt, shuffle, type Rng } from './rng';
import type {
  AnswerReason,
  Difficulty,
  GameAction,
  GameState,
  PlayerSetup,
  PlayerState,
  Question,
  Rules,
} from './types';

export class GameRuleError extends Error {}

export interface GameSetup {
  players: PlayerSetup[];
  difficulty: Difficulty;
  questions: Question[];
  rng: Rng;
  rules?: Partial<Rules>;
}

export function createGame({ players, difficulty, questions, rng, rules }: GameSetup): GameState {
  const fullRules = { ...DEFAULT_RULES, ...rules };
  if (players.length <= fullRules.finalists) {
    throw new GameRuleError(`Potrzeba więcej niż ${fullRules.finalists} graczy`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new GameRuleError('Id graczy muszą być unikalne');
  }
  if (questions.length === 0) throw new GameRuleError('Brak pytań');

  const playerStates: PlayerState[] = players.map((p, seat) => ({
    ...p,
    seat,
    lives: fullRules.lives,
    score: 0,
    eliminated: false,
    eliminatedOrder: null,
    finalist: false,
    correct: 0,
    wrong: 0,
    questionsWithoutTurn: 0,
  }));

  const stage1Queue: string[] = [];
  for (let round = 0; round < fullRules.stage1QuestionsPerPlayer; round++) {
    stage1Queue.push(...playerStates.map((p) => p.id));
  }

  const state: GameState = {
    rules: fullRules,
    difficulty,
    phase: 'stage1',
    players: playerStates,
    pending: { kind: 'none' },
    deck: shuffle(rng, questions),
    cursor: 0,
    stage1Queue,
    stage2StarterSeat: randomInt(rng, 0, players.length - 1),
    finalQuestionsLeft: fullRules.finalQuestionPool,
    eliminations: 0,
    ranking: null,
    events: [{ type: 'phase', phase: 'stage1' }],
  };
  nextStage1Question(state);
  return state;
}

/** Czysta funkcja: zwraca nowy stan, nie modyfikuje poprzedniego. */
export function reduce(state: GameState, action: GameAction): GameState {
  const s: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    stage1Queue: [...state.stage1Queue],
    events: [...state.events],
  };

  switch (action.type) {
    case 'answer':
      handleAnswer(s, action.playerId, action.text);
      break;
    case 'buzz':
      handleBuzz(s, action.playerId);
      break;
    case 'noBuzz':
      handleNoBuzz(s);
      break;
    case 'pick':
      handlePick(s, action.chooserId, action.targetId);
      break;
  }
  return s;
}

// ---------- zapytania o stan ----------

export function getPlayer(state: GameState, id: string): PlayerState {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new GameRuleError(`Nieznany gracz "${id}"`);
  return player;
}

export function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}

/** Ludzie, którzy w etapie II zbyt długo nie dostali pytania — bot musi wskazać jednego z nich. */
export function overdueHumans(state: GameState, chooserId: string): PlayerState[] {
  const limit = state.rules.maxQuestionsWithoutHuman;
  if (state.phase !== 'stage2' || limit <= 0 || getPlayer(state, chooserId).isHuman) return [];
  return activePlayers(state).filter((p) => p.isHuman && p.id !== chooserId && p.questionsWithoutTurn >= limit);
}

/** Kogo dany gracz może wskazać w obecnej sytuacji. */
export function pickTargets(state: GameState, chooserId: string): PlayerState[] {
  const overdue = overdueHumans(state, chooserId);
  if (overdue.length > 0) return overdue;
  const allowSelf = state.pending.kind === 'pick' && state.pending.allowSelf;
  return activePlayers(state).filter((p) => allowSelf || p.id !== chooserId);
}

// ---------- obsługa akcji ----------

function handleAnswer(s: GameState, playerId: string, text: string | null) {
  const pending = s.pending;
  if (pending.kind !== 'answer') throw new GameRuleError('Teraz nie ma pytania do odpowiedzi');
  if (pending.playerId !== playerId) throw new GameRuleError(`Teraz odpowiada ${pending.playerId}, nie ${playerId}`);

  const player = getPlayer(s, playerId);
  const correct = isCorrectAnswer(text, pending.question.answers);
  s.events.push({ type: 'answer', playerId, questionId: pending.question.id, text, correct });

  if (correct) {
    player.correct++;
  } else {
    player.wrong++;
    loseLife(s, player);
  }

  switch (s.phase) {
    case 'stage1':
      nextStage1Question(s);
      break;
    case 'stage2':
      afterStage2Answer(s, player, correct, pending.pickedBy);
      break;
    case 'final':
      afterFinalAnswer(s, player, correct);
      break;
    default:
      throw new GameRuleError('Gra jest zakończona');
  }
}

function handleBuzz(s: GameState, playerId: string) {
  const pending = s.pending;
  if (pending.kind !== 'buzz') throw new GameRuleError('Teraz nie można się zgłaszać');
  const player = getPlayer(s, playerId);
  if (player.eliminated) throw new GameRuleError(`${playerId} już odpadł`);

  s.events.push({ type: 'buzz', playerId, questionId: pending.question.id });
  s.pending = { kind: 'answer', playerId, question: pending.question, reason: 'buzz', pickedBy: null };
}

function handleNoBuzz(s: GameState) {
  if (s.pending.kind !== 'buzz') throw new GameRuleError('Teraz nie można się zgłaszać');
  s.events.push({ type: 'noBuzz', questionId: s.pending.question.id });
  nextFinalQuestion(s);
}

function handlePick(s: GameState, chooserId: string, targetId: string) {
  const pending = s.pending;
  if (pending.kind !== 'pick') throw new GameRuleError('Teraz nikt nie wskazuje');
  if (pending.chooserId !== chooserId) throw new GameRuleError(`Teraz wskazuje ${pending.chooserId}, nie ${chooserId}`);

  const target = getPlayer(s, targetId);
  if (target.eliminated) throw new GameRuleError(`${targetId} już odpadł`);
  if (targetId === chooserId && !pending.allowSelf) throw new GameRuleError('Nie można wskazać siebie');
  const overdue = overdueHumans(s, chooserId);
  if (overdue.length > 0 && !overdue.some((p) => p.id === targetId)) {
    throw new GameRuleError(`${chooserId} musi wskazać gracza, który długo nie dostał pytania`);
  }

  s.events.push({ type: 'pick', chooserId, targetId });
  const reason: AnswerReason = targetId === chooserId ? 'self' : 'picked';
  if (s.phase === 'final') s.finalQuestionsLeft--;
  askQuestion(s, targetId, reason, chooserId);
}

// ---------- przebieg etapów ----------

function nextStage1Question(s: GameState) {
  while (s.stage1Queue.length > 0) {
    const id = s.stage1Queue.shift()!;
    if (!getPlayer(s, id).eliminated) {
      askQuestion(s, id, 'turn', null);
      return;
    }
  }
  if (activePlayers(s).length <= s.rules.finalists) {
    startFinal(s);
  } else {
    startStage2(s);
  }
}

function startStage2(s: GameState) {
  setPhase(s, 'stage2');
  for (const p of s.players) p.questionsWithoutTurn = 0;
  askQuestion(s, nextActiveSeat(s, s.stage2StarterSeat - 1).id, 'turn', null);
}

function afterStage2Answer(s: GameState, answerer: PlayerState, correct: boolean, pickedBy: string | null) {
  if (activePlayers(s).length <= s.rules.finalists) {
    startFinal(s);
    return;
  }
  if (correct) {
    s.pending = { kind: 'pick', chooserId: answerer.id, allowSelf: false };
  } else if (pickedBy !== null && !getPlayer(s, pickedBy).eliminated) {
    // Wskazany pomylił się — wskazujący wybiera ponownie.
    s.pending = { kind: 'pick', chooserId: pickedBy, allowSelf: false };
  } else {
    askQuestion(s, nextActiveSeat(s, answerer.seat).id, 'turn', null);
  }
}

function startFinal(s: GameState) {
  setPhase(s, 'final');
  for (const p of s.players) {
    if (!p.eliminated) {
      p.finalist = true;
      p.lives = s.rules.finalLives;
      p.score = 0;
    }
  }
  s.finalQuestionsLeft = s.rules.finalQuestionPool;
  nextFinalQuestion(s);
}

function afterFinalAnswer(s: GameState, answerer: PlayerState, correct: boolean) {
  if (correct) {
    answerer.score += s.rules.pointsPerCorrect;
    s.events.push({ type: 'score', playerId: answerer.id, points: s.rules.pointsPerCorrect, total: answerer.score });
    if (activePlayers(s).length > 1 && s.finalQuestionsLeft > 0) {
      s.pending = { kind: 'pick', chooserId: answerer.id, allowSelf: true };
      return;
    }
  }
  nextFinalQuestion(s);
}

function nextFinalQuestion(s: GameState) {
  const active = activePlayers(s);
  if (active.length === 0 || s.finalQuestionsLeft <= 0) {
    finish(s);
    return;
  }
  s.finalQuestionsLeft--;
  if (active.length === 1) {
    // Ostatni finalista gra sam o jak najlepszy wynik, aż straci szanse lub skończy się pula.
    askQuestion(s, active[0].id, 'solo', null);
    return;
  }
  const question = drawQuestion(s);
  s.events.push({ type: 'question', questionId: question.id, playerId: null });
  s.pending = { kind: 'buzz', question };
}

function finish(s: GameState) {
  s.ranking = computeRanking(s.players);
  setPhase(s, 'finished');
  s.pending = { kind: 'none' };
  s.events.push({ type: 'gameOver', ranking: s.ranking });
}

/** Finaliści wg punktów, potem szans i czasu przetrwania; reszta wg kolejności odpadania. */
export function computeRanking(players: PlayerState[]): string[] {
  const survival = (p: PlayerState) => (p.eliminatedOrder === null ? Infinity : p.eliminatedOrder);
  return [...players]
    .sort((a, b) => {
      if (a.finalist !== b.finalist) return a.finalist ? -1 : 1;
      if (a.finalist && a.score !== b.score) return b.score - a.score;
      if (a.finalist && a.lives !== b.lives) return b.lives - a.lives;
      if (survival(a) !== survival(b)) return survival(b) - survival(a);
      return a.seat - b.seat;
    })
    .map((p) => p.id);
}

// ---------- pomocnicze ----------

function askQuestion(s: GameState, playerId: string, reason: AnswerReason, pickedBy: string | null) {
  if (s.phase === 'stage2') {
    for (const p of s.players) {
      if (!p.eliminated) p.questionsWithoutTurn = p.id === playerId ? 0 : p.questionsWithoutTurn + 1;
    }
  }
  const question = drawQuestion(s);
  s.events.push({ type: 'question', questionId: question.id, playerId });
  s.pending = { kind: 'answer', playerId, question, reason, pickedBy };
}

function drawQuestion(s: GameState): Question {
  const question = s.deck[s.cursor % s.deck.length];
  s.cursor++;
  return question;
}

function loseLife(s: GameState, player: PlayerState) {
  player.lives = Math.max(0, player.lives - 1);
  s.events.push({ type: 'lifeLost', playerId: player.id, livesLeft: player.lives });
  if (player.lives === 0) {
    player.eliminated = true;
    s.eliminations++;
    player.eliminatedOrder = s.eliminations;
    s.events.push({ type: 'eliminated', playerId: player.id });
  }
}

/** Następny aktywny gracz siedzący za miejscem `afterSeat` (zgodnie z ruchem wskazówek). */
function nextActiveSeat(s: GameState, afterSeat: number): PlayerState {
  const n = s.players.length;
  for (let offset = 1; offset <= n; offset++) {
    const candidate = s.players[(((afterSeat + offset) % n) + n) % n];
    if (!candidate.eliminated) return candidate;
  }
  throw new GameRuleError('Brak aktywnych graczy');
}

function setPhase(s: GameState, phase: GameState['phase']) {
  s.phase = phase;
  s.events.push({ type: 'phase', phase });
}
