import { isCorrectAnswer } from '../answers';
import type { Question } from '../types';

/**
 * Silnik rund „Gorący Ziemniak” (PDF „Quiz Frenzy”). Czysty: nie losuje i nie loguje.
 * Losowe decyzje (kto dostaje ziemniak po błędzie, kto startuje) podaje wywołujący w akcji `next`.
 */

export class PotatoRuleError extends Error {}

export const POTATO = {
  /** Życia w rundzie 1. */
  lives: 3,
  /** Punkty osłony w rundzie 2. */
  shield: 3,
  /** Czas sprintu (runda 3). */
  sprintMs: 60_000,
  /** Kara za błąd lub brak odpowiedzi w sprincie. */
  sprintPenaltyMs: 1_000,
  /** Szanse w rundzie 4 wg miejsca w sprincie (1., 2., 3.). */
  awards: [3, 2, 1],
} as const;

export type PotatoPhase = 'round1' | 'round2' | 'sprint' | 'duel' | 'finished';

export interface PotatoPlayer {
  id: string;
  name: string;
  isHuman: boolean;
  botId?: string;
  seat: number;
  /** Życia (runda 1 i finał). */
  lives: number;
  /** Punkty osłony (runda 2). */
  shield: number;
  /** Punkty w sprincie. */
  points: number;
  errors: number;
  eliminated: boolean;
  eliminatedAt: number | null;
  blindPassUsed: boolean;
}

export interface PotatoState {
  phase: PotatoPhase;
  players: PotatoPlayer[];
  /** Kto ma ziemniaka (odpowiada na bieżące pytanie). */
  holderId: string | null;
  question: Question | null;
  deck: Question[];
  cursor: number;
  /** Mnożnik ładunku w rundzie 2. */
  multiplier: number;
  sprintMsLeft: number;
  eliminations: number;
  ranking: string[] | null;
}

export type PotatoAction =
  | { type: 'start'; holderId: string }
  /** `text` = `null` gdy minął czas. `next` = kto dostaje ziemniak (po poprawnej: rywal, „na siebie” w finale; po błędzie: wybrany przez wywołującego). */
  | { type: 'answer'; playerId: string; text: string | null; next: string }
  /** Odbicie w ciemno (runda 1, raz na gracza): przekazanie bez pytania i bez utraty życia. */
  | { type: 'blindPass'; playerId: string; targetId: string }
  /** Upływ czasu (sprint). */
  | { type: 'tick'; ms: number };

export interface PotatoSetup {
  players: { id: string; name: string; isHuman: boolean; botId?: string }[];
  deck: Question[];
}

export function createPotatoGame({ players, deck }: PotatoSetup): PotatoState {
  if (players.length < 3) throw new PotatoRuleError('Potrzeba co najmniej 3 graczy');
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new PotatoRuleError('Id graczy muszą być unikalne');
  if (deck.length === 0) throw new PotatoRuleError('Brak pytań');
  return {
    phase: 'round1',
    players: players.map((p, seat) => ({
      ...p,
      seat,
      lives: POTATO.lives,
      shield: POTATO.shield,
      points: 0,
      errors: 0,
      eliminated: false,
      eliminatedAt: null,
      blindPassUsed: false,
    })),
    holderId: null,
    question: null,
    deck,
    cursor: 0,
    multiplier: 1,
    sprintMsLeft: POTATO.sprintMs,
    eliminations: 0,
    ranking: null,
  };
}

/** Czysta funkcja: zwraca nowy stan, poprzedni zostaje bez zmian (także przy błędzie). */
export function reducePotato(state: PotatoState, action: PotatoAction): PotatoState {
  if (state.phase === 'finished') throw new PotatoRuleError('Gra jest zakończona');
  const s: PotatoState = { ...state, players: state.players.map((p) => ({ ...p })) };

  switch (action.type) {
    case 'start':
      if (s.holderId !== null) throw new PotatoRuleError('Gra już się zaczęła');
      requireActive(s, action.holderId);
      hand(s, action.holderId);
      break;
    case 'answer':
      answer(s, action.playerId, action.text, action.next);
      break;
    case 'blindPass':
      blindPass(s, action.playerId, action.targetId);
      break;
    case 'tick':
      tick(s, action.ms);
      break;
  }
  return s;
}

// ---------- zapytania ----------

export function activePlayers(state: PotatoState): PotatoPlayer[] {
  return state.players.filter((p) => !p.eliminated);
}

/** Resource, o który toczy się runda: życia, osłona albo punkty w sprincie. */
export function resourceOf(state: PotatoState, player: PotatoPlayer): number {
  if (state.phase === 'round2') return player.shield;
  if (state.phase === 'sprint') return player.points;
  return player.lives;
}

// ---------- obsługa akcji ----------

function answer(s: PotatoState, playerId: string, text: string | null, next: string) {
  if (!s.question || s.holderId === null) throw new PotatoRuleError('Teraz nie ma pytania');
  if (playerId !== s.holderId) throw new PotatoRuleError(`Teraz odpowiada ${s.holderId}, nie ${playerId}`);
  const holder = getPlayer(s, playerId);
  const correct = text !== null && isCorrectAnswer(text, s.question.answers);
  if (!correct) holder.errors++;

  switch (s.phase) {
    case 'round1':
      return answerRound1(s, holder, correct, next);
    case 'round2':
      return answerRound2(s, holder, correct, next);
    case 'sprint':
      return answerSprint(s, holder, correct, next);
    case 'duel':
      return answerDuel(s, holder, correct, next);
    default:
      throw new PotatoRuleError('Teraz nie ma rundy z pytaniami');
  }
}

/** Runda 1: poprawna odpowiedź przekazuje ziemniaka rywalowi; błąd kosztuje życie i resetuje ziemniaka. */
function answerRound1(s: PotatoState, holder: PotatoPlayer, correct: boolean, next: string) {
  if (correct) {
    requireOther(s, holder, next);
    hand(s, next);
    return;
  }
  loseLife(s, holder);
  if (holder.eliminated) {
    enterRound2(s, next);
    return;
  }
  requireActive(s, next);
  hand(s, next);
}

function enterRound2(s: PotatoState, next: string) {
  s.phase = 'round2';
  s.multiplier = 1;
  for (const p of s.players) if (!p.eliminated) p.shield = POTATO.shield;
  requireActive(s, next);
  hand(s, next);
}

/** Runda 2: poprawne podanie podnosi mnożnik; błąd to wybuch — odejmuje punkty osłony równe mnożnikowi. */
function answerRound2(s: PotatoState, holder: PotatoPlayer, correct: boolean, next: string) {
  if (correct) {
    requireOther(s, holder, next);
    s.multiplier++;
    hand(s, next);
    return;
  }
  holder.shield = Math.max(0, holder.shield - s.multiplier);
  s.multiplier = 1;
  if (holder.shield === 0) {
    eliminate(s, holder);
    if (activePlayers(s).length === 3) {
      enterSprint(s, next);
      return;
    }
  }
  requireActive(s, next);
  hand(s, next);
}

function enterSprint(s: PotatoState, next: string) {
  s.phase = 'sprint';
  s.sprintMsLeft = POTATO.sprintMs;
  for (const p of s.players) p.points = 0;
  requireActive(s, next);
  hand(s, next);
}

/** Sprint: +1 za dobrą odpowiedź, −1 s za błąd albo brak odpowiedzi. Ziemniak zawsze rotuje do innego gracza. */
function answerSprint(s: PotatoState, holder: PotatoPlayer, correct: boolean, next: string) {
  if (correct) holder.points++;
  else s.sprintMsLeft = Math.max(0, s.sprintMsLeft - POTATO.sprintPenaltyMs);
  requireOther(s, holder, next);
  if (s.sprintMsLeft === 0) {
    finishSprint(s);
    return;
  }
  hand(s, next);
}

/** Koniec sprintu: 3/2/1 szanse wg miejsca, zwycięzca ma pierwszy atak w finale. */
function finishSprint(s: PotatoState) {
  s.question = null;
  const ranked = activePlayers(s).sort((a, b) => b.points - a.points || a.errors - b.errors || a.seat - b.seat);
  ranked.forEach((p, place) => {
    if (place < POTATO.awards.length) p.lives = POTATO.awards[place];
  });
  s.phase = 'duel';
  hand(s, ranked[0].id);
}

/**
 * Finał jak w „1 z 10”: poprawna odpowiedź daje punkt, nikt nie odzyskuje szans ani ich nie traci.
 * Błąd odbiera szansę. `next` to rywal (atak) albo odpowiadający („na siebie”).
 */
function answerDuel(s: PotatoState, holder: PotatoPlayer, correct: boolean, next: string) {
  if (correct) {
    holder.points++;
  } else {
    loseLife(s, holder);
  }
  if (activePlayers(s).length === 1) {
    finish(s);
    return;
  }
  requireActive(s, next);
  hand(s, next);
}

function blindPass(s: PotatoState, playerId: string, targetId: string) {
  if (s.phase !== 'round1') throw new PotatoRuleError('Odbicie w ciemno jest tylko w rundzie 1');
  if (playerId !== s.holderId) throw new PotatoRuleError(`Ziemniaka nie ma ${playerId}`);
  const player = getPlayer(s, playerId);
  if (player.blindPassUsed) throw new PotatoRuleError(`${playerId} już użył odbicia w ciemno`);
  requireOther(s, player, targetId);
  player.blindPassUsed = true;
  hand(s, targetId);
}

function tick(s: PotatoState, ms: number) {
  if (s.phase !== 'sprint') throw new PotatoRuleError('Zegar liczy tylko w sprincie');
  if (ms < 0) throw new PotatoRuleError('Upływ czasu nie może być ujemny');
  s.sprintMsLeft = Math.max(0, s.sprintMsLeft - ms);
  if (s.sprintMsLeft === 0) finishSprint(s);
}

function finish(s: PotatoState) {
  s.phase = 'finished';
  s.question = null;
  s.holderId = null;
  // Najpierw zostający (zwycięzca), potem odpadający w odwrotnej kolejności odpadania.
  s.ranking = [...s.players]
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0) || a.seat - b.seat;
    })
    .map((p) => p.id);
}

// ---------- pomocnicze ----------

function getPlayer(s: PotatoState, id: string): PotatoPlayer {
  const player = s.players.find((p) => p.id === id);
  if (!player) throw new PotatoRuleError(`Nieznany gracz "${id}"`);
  return player;
}

function requireActive(s: PotatoState, id: string) {
  const player = getPlayer(s, id);
  if (player.eliminated) throw new PotatoRuleError(`${id} już odpadł`);
}

function requireOther(s: PotatoState, holder: PotatoPlayer, id: string) {
  requireActive(s, id);
  if (id === holder.id) throw new PotatoRuleError('Nie można przekazać ziemniaka sobie');
}

function hand(s: PotatoState, id: string) {
  s.holderId = id;
  s.question = s.deck[s.cursor % s.deck.length];
  s.cursor++;
}

function loseLife(s: PotatoState, player: PotatoPlayer) {
  player.lives = Math.max(0, player.lives - 1);
  if (player.lives === 0) eliminate(s, player);
}

function eliminate(s: PotatoState, player: PotatoPlayer) {
  // Odpadający nie ma już żadnych kropek (życia ani osłony), żeby ekran pokazywał zero.
  player.lives = 0;
  player.shield = 0;
  player.eliminated = true;
  s.eliminations++;
  player.eliminatedAt = s.eliminations;
}
