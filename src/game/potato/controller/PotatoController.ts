import { createLogger } from '@/lib/log';

import { isCorrectAnswer } from '../../answers';
import { decideAnswer, type BotAnswer, type BotContext } from '../../bots/brain';
import { getBotProfile, type BotProfile } from '../../bots/profiles';
import { realClock, type Clock } from '../../controller/SoloController';
import { DEFAULT_RULES, DIFFICULTY_PRESETS } from '../../rules';
import { pickRandom, type Rng } from '../../rng';
import type { Difficulty, Rules } from '../../types';
import { buildChoices, CHOICE_COUNT } from '../../choices';
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

/** Ile czasu ma gracz na wskazanie, komu przekazać ziemniaka. Po upływie wybór jest losowy. */
export const PICK_TIMEOUT_MS = 10_000;

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
  /** Opcje A–D na bieżące pytanie gracza (poziomy Łatwy i Normalny). */
  choices: { questionId: string; options: string[] } | null;
  /** Kiedy (wg zegara) kończy się sprint; `null` poza sprintem. */
  sprintEndsAt: number | null;
  /** Gra wstrzymana (okno „Przerwać grę?”). */
  paused: boolean;
  /** Lektor właśnie mówi (muzyka w tle cichnie). */
  speaking: boolean;
}

/** Krok z licznikiem: `fire` to czas do wykonania, `bar` to pasek widoczny dla gracza (tylko przy licznikach). */
interface MainStep {
  fn: () => void;
  fire: number;
  bar?: { total: number; left: number };
  /** Kiedy krok został uruchomiony (`null` = czeka na ciszę albo na koniec pauzy). */
  armedAt: number | null;
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
  /** Krok gry czekający na upływ czasu (albo na ciszę lektora / koniec pauzy). */
  private mainStep: MainStep | null = null;
  /** Akcja odłożona, aż lektor skończy mówić i gra nie jest wstrzymana. */
  private waiting: (() => void) | null = null;
  private speaking = false;
  private sprintTimer: unknown = null;
  private sprintSyncAt = 0;
  /** Poprawna odpowiedź człowieka czeka, aż wskaże, komu przekazać ziemniaka. */
  private pendingAnswer: { playerId: string; text: string | null } | null = null;
  /** Czy gra jest uruchomiona (między `start` a `stop`). */
  private running = false;

  constructor({ game, difficulty, rng, clock = realClock, pacing, getProfile = getBotProfile }: PotatoControllerOptions) {
    this.difficulty = difficulty;
    this.rng = rng;
    this.clock = clock;
    this.pacing = { ...DEFAULT_POTATO_PACING, ...pacing };
    this.getProfile = getProfile;
    this.rules = { ...DEFAULT_RULES, answerTimeMs: DIFFICULTY_PRESETS[difficulty].answerTimeMs };
    this.view = {
      game,
      overlay: null,
      deadline: null,
      timerMs: null,
      thinkingId: null,
      awaitingPick: null,
      choices: null,
      sprintEndsAt: null,
      paused: false,
      speaking: false,
    };
  }

  // ---------- API dla Reacta ----------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = (): PotatoView => this.view;

  /** Start gry: losuje, kto ma ziemniaka w rundzie 1. Po `stop` wznawia od bieżącego kroku. */
  start() {
    if (this.running) return;
    this.running = true;
    const game = this.view.game;
    if (game.holderId === null) {
      const first = pickRandom(this.rng, activePlayers(game));
      log.info('Start rundy 1', { holder: first.id });
      if (!this.apply({ type: 'start', holderId: first.id })) return;
      this.showRound(() => this.takeTurn());
      return;
    }
    if (game.phase === 'sprint' && this.sprintTimer === null) this.startSprintClock();
    this.resumeStep();
  }

  /** Wstrzymuje grę: zamraża czas kroku i sprintu. Ponownie wywołana nic nie robi. */
  pause() {
    if (this.view.paused || !this.running) return;
    if (this.view.game.phase === 'sprint') this.syncSprint();
    this.freezeMain();
    this.clearSprintTimer();
    this.update({ paused: true });
    log.info('Pauza');
  }

  /** Wznawia grę po pauzie z tym, ile czasu zostało. */
  unpause() {
    if (!this.view.paused) return;
    this.update({ paused: false });
    log.info('Wznowienie');
    const game = this.view.game;
    if (game.phase === 'sprint') {
      this.sprintSyncAt = this.clock.now();
      this.update({ sprintEndsAt: this.clock.now() + game.sprintMsLeft });
      this.scheduleSprintEnd();
    }
    if (this.mainStep && this.mainStep.armedAt === null) this.whenReady(() => this.arm());
    this.flushWaiting();
  }

  /** Lektor zgłasza, że mówi (`true`) albo skończył (`false`). Liczniki startują dopiero po ciszy. */
  setSpeaking(speaking: boolean) {
    this.speaking = speaking;
    this.update({ speaking });
    if (!speaking) this.flushWaiting();
  }

  /** Zatrzymuje wszystkie zegary (wyjście z ekranu albo odmontowanie). */
  stop() {
    this.running = false;
    this.clearMain();
    this.clearSprintTimer();
  }

  private resumeStep() {
    const { game, overlay, awaitingPick } = this.view;
    if (game.phase === 'finished') {
      this.update({ overlay: { kind: 'finished' } });
      return;
    }
    if (overlay?.kind === 'reveal') {
      this.schedule(this.pacing.revealMs, () => this.afterReveal(game.phase));
      return;
    }
    if (overlay?.kind === 'round') {
      this.schedule(this.pacing.roundMs, () => {
        this.update({ overlay: null });
        this.takeTurn();
      });
      return;
    }
    if (awaitingPick) {
      this.countdown(PICK_TIMEOUT_MS, PICK_TIMEOUT_MS, () => this.pickAtRandom());
      return;
    }
    this.takeTurn();
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
      this.update({ awaitingPick: null, thinkingId: null, choices: this.choicesFor(game) });
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
      this.update({ thinkingId: null, choices: null, awaitingPick: { chooserId: playerId, allowSelf: game.phase === 'duel' } });
      this.countdown(PICK_TIMEOUT_MS, PICK_TIMEOUT_MS, () => this.pickAtRandom());
      return;
    }
    const next = this.chooseNext(playerId, correct);
    this.commit(playerId, text, next);
  }

  /** Opcje ABCD na pytanie człowieka, jeśli poziom ich wymaga i jest ich dość. */
  private choicesFor(game: PotatoState): { questionId: string; options: string[] } | null {
    if (DIFFICULTY_PRESETS[this.difficulty].answerFormat !== 'choice' || game.question === null) return null;
    const options = buildChoices(game.question, game.deck);
    if (options.length < CHOICE_COUNT) {
      log.warn('Za mało opcji ABCD, pytanie będzie pisemne', { questionId: game.question.id });
      return null;
    }
    return { questionId: game.question.id, options };
  }

  /** Po upływie czasu na wybór: losowy aktywny gracz (w finale też możliwy ten sam, który odpowiadał). */
  private pickAtRandom() {
    const pick = this.view.awaitingPick;
    if (!pick) return;
    const candidates = activePlayers(this.view.game).filter((p) => pick.allowSelf || p.id !== pick.chooserId);
    const target = pickRandom(this.rng, candidates);
    log.info('Brak wyboru w czasie, wskazanie losowe', { chooserId: pick.chooserId, targetId: target.id });
    this.pick(target.id);
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
    this.update({ sprintEndsAt: this.clock.now() + this.view.game.sprintMsLeft });
    this.scheduleSprintEnd();
  }

  private scheduleSprintEnd() {
    if (this.sprintTimer !== null) this.clock.clearTimeout(this.sprintTimer);
    if (this.view.paused) return;
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
    this.update({ sprintEndsAt: game.phase === 'sprint' ? this.clock.now() + game.sprintMsLeft : null });
  }

  /** Licznik gracza albo bota: pasek startuje od pokazania, a krok wykonuje się po `fireInMs`. */
  private countdown(totalMs: number, fireInMs: number, fn: () => void) {
    this.clearMain();
    this.mainStep = { fn, fire: fireInMs, bar: { total: totalMs, left: totalMs }, armedAt: null };
    this.whenReady(() => this.arm());
  }

  private schedule(ms: number, fn: () => void) {
    this.clearMain();
    this.mainStep = { fn, fire: ms, armedAt: null };
    this.whenReady(() => this.arm());
  }

  /** Uruchamia zaplanowany krok: pasek i zegar startują razem. */
  private arm() {
    const step = this.mainStep;
    if (!step || step.armedAt !== null) return;
    const now = this.clock.now();
    step.armedAt = now;
    if (step.bar) this.update({ deadline: now + step.bar.left, timerMs: step.bar.total });
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.mainStep = null;
      step.fn();
    }, step.fire);
  }

  /** Pauza: zapamiętuje, ile czasu zostało, i zatrzymuje zegar. */
  private freezeMain() {
    const step = this.mainStep;
    if (!step || step.armedAt === null) return;
    const elapsed = this.clock.now() - step.armedAt;
    step.fire = Math.max(0, step.fire - elapsed);
    if (step.bar) step.bar.left = Math.max(0, step.bar.left - elapsed);
    step.armedAt = null;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Wykonuje akcję od razu, jeśli gra gra i lektor milczy; inaczej odkłada ją do ciszy albo wznowienia. */
  private whenReady(fn: () => void) {
    if (this.view.paused || this.speaking) {
      this.waiting = fn;
      return;
    }
    fn();
  }

  private flushWaiting() {
    if (this.view.paused || this.speaking || this.waiting === null) return;
    const fn = this.waiting;
    this.waiting = null;
    fn();
  }

  private clearMain() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.mainStep = null;
    this.waiting = null;
  }

  private update(patch: Partial<PotatoView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
}
