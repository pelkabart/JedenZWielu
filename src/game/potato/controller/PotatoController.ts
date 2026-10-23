import { createLogger } from '@/lib/log';

import { isCorrectAnswer } from '../../answers';
import { decideAnswer, type BotAnswer, type BotContext } from '../../bots/brain';
import { getBotProfile, type BotProfile } from '../../bots/profiles';
import { realClock, type Clock } from '../../controller/SoloController';
import { DEFAULT_RULES, DIFFICULTY_PRESETS } from '../../rules';
import { pickRandom, type Rng } from '../../rng';
import type { Difficulty, Rules } from '../../types';
import { pickTarget } from '../bots';
import { activePlayers, PotatoRuleError, reducePotato, type PotatoPhase, type PotatoState } from '../engine';

const log = createLogger('ziemniak');

export interface PotatoPacing {
  /** Jak długo widać wynik odpowiedzi. */
  revealMs: number;
  /** Jak długo widać plansze zmiany rundy. */
  roundMs: number;
}

export const DEFAULT_POTATO_PACING: PotatoPacing = { revealMs: 1500, roundMs: 2500 };

export type PotatoOverlay =
  | { kind: 'reveal'; playerId: string; text: string | null; correct: boolean; correctAnswer: string }
  | { kind: 'round'; phase: PotatoPhase }
  | { kind: 'finished' };

export interface PotatoView {
  game: PotatoState;
  overlay: PotatoOverlay | null;
  deadline: number | null;
  timerMs: number | null;
  /** Bot, który właśnie „myśli”. */
  thinkingId: string | null;
  /** Gracz odpowiedział poprawnie i wskazuje, komu przekazać ziemniaka (`allowSelf` w finale). */
  awaitingPick: { chooserId: string; allowSelf: boolean } | null;
}

export interface PotatoControllerOptions {
  game: PotatoState;
  difficulty: Difficulty;
  rng: Rng;
  clock?: Clock;
  pacing?: Partial<PotatoPacing>;
  getProfile?: (botId: string) => BotProfile;
}

/**
 * Sterownik rund „Gorący Ziemniak”: tury gracza i botów, czas odpowiedzi, sprint na zegarze
 * i nakładki. Silnik (`reducePotato`) pilnuje zasad; tu tylko czas, losowanie i kolejność kroków.
 */
export class PotatoController {
  private view: PotatoView;
  private readonly listeners = new Set<() => void>();
  private readonly rng: Rng;
  private readonly clock: Clock;
  private readonly pacing: PotatoPacing;
  private readonly getProfile: (botId: string) => BotProfile;
  private readonly difficulty: Difficulty;
  private readonly rules: Rules;
  /** Jeden slot na kolejny krok gry (odpowiedź, nakładka, tura). */
  private timer: unknown = null;
  private sprintTimer: unknown = null;
  private sprintSyncAt = 0;
  /** Poprawna odpowiedź człowieka czeka, aż wskaże, komu przekazać ziemniaka. */
  private pendingAnswer: { playerId: string; text: string | null } | null = null;

  constructor({ game, difficulty, rng, clock = realClock, pacing, getProfile = getBotProfile }: PotatoControllerOptions) {
    this.difficulty = difficulty;
    this.rng = rng;
    this.clock = clock;
    this.pacing = { ...DEFAULT_POTATO_PACING, ...pacing };
    this.getProfile = getProfile;
    this.rules = { ...DEFAULT_RULES, answerTimeMs: DIFFICULTY_PRESETS[difficulty].answerTimeMs };
    this.view = { game, overlay: null, deadline: null, timerMs: null, thinkingId: null, awaitingPick: null };
  }

  // ---------- API dla Reacta ----------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = (): PotatoView => this.view;

  /** Start gry: losuje, kto ma ziemniaka w rundzie 1. Przy gotowym stanie od razu wznawia turę. */
  start() {
    const game = this.view.game;
    if (game.holderId !== null) {
      if (game.phase === 'sprint') this.startSprintClock();
      this.takeTurn();
      return;
    }
    const first = pickRandom(this.rng, activePlayers(game));
    log.info('Start rundy 1', { holder: first.id });
    if (!this.apply({ type: 'start', holderId: first.id })) return;
    this.showRound(() => this.takeTurn());
  }

  /** Odpowiedź człowieka na bieżące pytanie. */
  submitAnswer(text: string) {
    if (!this.isHumanTurn() || text.trim() === '') return;
    this.answerBy(this.view.game.holderId!, text);
  }

  /** Człowiek wskazuje, komu przekazać ziemniaka po poprawnej odpowiedzi (albo sobie w finale). */
  pick(targetId: string) {
    const pick = this.view.awaitingPick;
    const pending = this.pendingAnswer;
    if (!pick || !pending) return;
    const target = this.view.game.players.find((p) => p.id === targetId);
    if (!target || target.eliminated) return;
    if (targetId === pick.chooserId && !pick.allowSelf) return;
    this.commit(pending.playerId, pending.text, targetId);
  }

  /** Odbicie w ciemno: przekazanie ziemniaka bez pytania i bez utraty życia (raz na grę). */
  blindPass(targetId: string) {
    const game = this.view.game;
    if (!this.isHumanTurn() || game.phase !== 'round1') return;
    const me = game.players.find((p) => p.id === game.holderId)!;
    if (me.blindPassUsed) return;
    this.clearMain();
    if (!this.apply({ type: 'blindPass', playerId: me.id, targetId })) {
      this.takeTurn();
      return;
    }
    log.info('Odbicie w ciemno', { targetId });
    this.takeTurn();
  }

  // ---------- kroki gry ----------

  private isHuman(playerId: string | null): boolean {
    return this.view.game.players.some((p) => p.id === playerId && p.isHuman);
  }

  private isHumanTurn(): boolean {
    const { game, overlay, awaitingPick } = this.view;
    return overlay === null && awaitingPick === null && this.isHuman(game.holderId) && game.question !== null;
  }

  private takeTurn() {
    const game = this.view.game;
    if (game.phase === 'finished' || game.holderId === null || game.question === null) return;
    if (this.isHuman(game.holderId)) {
      const holderId = game.holderId!;
      this.update({ awaitingPick: null, thinkingId: null });
      this.countdown(this.rules.answerTimeMs, this.rules.answerTimeMs, () => this.answerBy(holderId, null));
      return;
    }
    const holder = game.players.find((p) => p.id === game.holderId)!;
    const ctx: BotContext = {
      profile: this.getProfile(holder.botId!),
      difficulty: this.difficulty,
      rng: this.rng,
      bank: game.deck,
    };
    const answer: BotAnswer = decideAnswer(ctx, game.question, this.rules);
    this.update({ thinkingId: holder.id });
    this.countdown(this.rules.answerTimeMs, answer.delayMs, () => this.answerBy(holder.id, answer.text));
  }

  /** Odpowiedź gracza na bieżące pytanie: poprawna człowieka czeka na wskazanie, pozostałe od razu idą dalej. */
  private answerBy(playerId: string, text: string | null) {
    this.clearMain();
    if (this.view.game.phase === 'sprint') this.syncSprint();
    const game = this.view.game;
    const question = game.question;
    // Synchronizacja zegaru mogła już zakończyć sprint albo zmienić posiadacza.
    if (!question || game.holderId !== playerId) return;

    const correct = text !== null && isCorrectAnswer(text, question.answers);
    if (correct && this.isHuman(playerId)) {
      this.pendingAnswer = { playerId, text };
      this.update({ thinkingId: null, deadline: null, timerMs: null, awaitingPick: { chooserId: playerId, allowSelf: game.phase === 'duel' } });
      return;
    }
    const next = this.chooseNext(playerId, correct);
    this.commit(playerId, text, next);
  }

  /** Bot wybiera cel; w sprincie i po poprawnej odpowiedzi zawsze inny gracz. */
  private chooseNext(holderId: string, correct: boolean): string {
    const game = this.view.game;
    if (game.phase === 'sprint' || correct) return pickTarget(game, holderId, this.rng);
    return pickTarget(game, null, this.rng);
  }

  private commit(playerId: string, text: string | null, next: string) {
    const before = this.view.game;
    const question = before.question!;
    const correct = text !== null && isCorrectAnswer(text, question.answers);
    if (!this.apply({ type: 'answer', playerId, text, next })) {
      this.takeTurn();
      return;
    }
    log.debug('Odpowiedź', { playerId, correct, next });
    this.pendingAnswer = null;
    this.update({
      overlay: { kind: 'reveal', playerId, text, correct, correctAnswer: question.answers[0] },
      awaitingPick: null,
      thinkingId: null,
      deadline: null,
      timerMs: null,
    });
    this.schedule(this.pacing.revealMs, () => this.afterReveal(before.phase));
  }

  private afterReveal(previousPhase: PotatoPhase) {
    const game = this.view.game;
    if (game.phase === 'finished') {
      this.update({ overlay: { kind: 'finished' } });
      log.info('Koniec gry', { winner: game.ranking?.[0] ?? null });
      return;
    }
    if (game.phase !== previousPhase) {
      this.showRound(() => this.takeTurn());
      return;
    }
    this.update({ overlay: null });
    this.takeTurn();
  }

  private showRound(next: () => void) {
    const phase = this.view.game.phase;
    log.info('Runda', { phase });
    this.update({ overlay: { kind: 'round', phase } });
    this.schedule(this.pacing.roundMs, () => {
      this.update({ overlay: null });
      next();
    });
  }

  // ---------- sprint ----------

  /** Zegar sprintu liczy się na żywo; kary za błędy są już odjęte w silniku. */
  private startSprintClock() {
    this.sprintSyncAt = this.clock.now();
    this.scheduleSprintEnd();
  }

  private scheduleSprintEnd() {
    if (this.sprintTimer !== null) this.clock.clearTimeout(this.sprintTimer);
    this.sprintTimer = this.clock.setTimeout(() => this.syncSprint(), this.view.game.sprintMsLeft);
  }

  private syncSprint() {
    const game = this.view.game;
    if (game.phase !== 'sprint') return;
    const elapsed = this.clock.now() - this.sprintSyncAt;
    this.sprintSyncAt = this.clock.now();
    if (!this.apply({ type: 'tick', ms: elapsed })) return;
    if (this.view.game.phase !== 'sprint') {
      log.info('Koniec sprintu', { duel: this.view.game.holderId });
      this.clearSprintTimer();
      this.clearMain();
      this.update({ deadline: null, timerMs: null, thinkingId: null, awaitingPick: null, overlay: null });
      this.showRound(() => this.takeTurn());
      return;
    }
    this.scheduleSprintEnd();
  }

  private clearSprintTimer() {
    if (this.sprintTimer !== null) this.clock.clearTimeout(this.sprintTimer);
    this.sprintTimer = null;
  }

  // ---------- pomocnicze ----------

  /** Stosuje akcję silnika. Błąd zasad nie psuje stanu (silnik zwraca nowy obiekt albo rzuca). */
  private apply(action: Parameters<typeof reducePotato>[1]): boolean {
    const before = this.view.game;
    try {
      const next = reducePotato(before, action);
      this.setGame(next, before.phase);
      return true;
    } catch (error) {
      if (error instanceof PotatoRuleError) {
        log.warn('Odrzucony ruch', { type: action.type, reason: error.message });
        return false;
      }
      throw error;
    }
  }

  private setGame(game: PotatoState, previousPhase: PotatoPhase) {
    this.update({ game });
    if (game.phase === 'sprint' && previousPhase !== 'sprint') this.startSprintClock();
    if (game.phase !== 'sprint') this.clearSprintTimer();
  }

  private countdown(totalMs: number, fireInMs: number, fn: () => void) {
    this.update({ deadline: this.clock.now() + totalMs, timerMs: totalMs });
    this.schedule(fireInMs, fn);
  }

  private schedule(ms: number, fn: () => void) {
    this.clearMain();
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  private clearMain() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private update(patch: Partial<PotatoView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
}
