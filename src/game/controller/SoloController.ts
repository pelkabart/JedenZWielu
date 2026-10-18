import { createLogger } from '@/lib/log';

import { decideAnswer, decideBuzz, decidePickDelay, decideTarget, type BotAnswer, type BotContext } from '../bots/brain';
import { getBotProfile, type BotProfile } from '../bots/profiles';
import { activePlayers, getPlayer, pickTargets, reduce } from '../engine';
import type { Rng } from '../rng';
import { simulateGame } from '../simulate';
import { HUMAN_ID } from '../solo';
import type { GameAction, GameEvent, GameState, Phase, Question } from '../types';

const log = createLogger('sterownik');

/** Zegar wstrzykiwany, żeby w testach dało się użyć udawanego czasu. */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Pacing {
  /** Jak długo widać wynik odpowiedzi. */
  revealMs: number;
  /**
   * Plansza etapu znika dopiero po dotknięciu; przez ten czas od pokazania dotyk jest ignorowany,
   * żeby nie zamknąć jej przypadkiem tym samym tapnięciem, którym pominięto poprzednią pauzę.
   */
  bannerLockMs: number;
  /** Jak długo widać, kto kogo wskazał albo kto się zgłosił. */
  announceMs: number;
  /** Jak długo przed pytaniem zadawanym z kolei widać, kto odpowiada. */
  introMs: number;
}

export const DEFAULT_PACING: Pacing = { revealMs: 2200, bannerLockMs: 700, announceMs: 2000, introMs: 4000 };

export type Overlay =
  | { kind: 'banner'; phase: Phase }
  | {
      kind: 'reveal';
      playerId: string;
      /** Pytanie, na które padła odpowiedź (silnik ma już wylosowane następne). */
      question: Question;
      text: string | null;
      correct: boolean;
      correctAnswer: string;
      eliminated: boolean;
    }
  | { kind: 'noBuzz'; question: Question; correctAnswer: string }
  | { kind: 'pick'; chooserId: string; targetId: string }
  | { kind: 'buzz'; playerId: string }
  /** Zapowiedź „Odpowiada: …” przed pytaniem zadawanym z kolei; pytanie jest jeszcze ukryte. */
  | { kind: 'intro'; playerId: string };

export interface SoloView {
  game: GameState;
  /** Co jest teraz pokazywane zamiast normalnej rozgrywki (wynik, plansza etapu...). */
  overlay: Overlay | null;
  /** Kiedy (wg zegara) kończy się odliczanie; `null` = brak licznika. */
  deadline: number | null;
  timerMs: number | null;
  /** Bot, który właśnie "myśli" nad odpowiedzią albo wyborem. */
  thinkingId: string | null;
  paused: boolean;
}

export type HumanTurn = 'answer' | 'buzz' | 'pick' | null;

/** Pytanie, które powinno być teraz widoczne na ekranie. */
export function visibleQuestion(view: SoloView): Question | null {
  const { overlay, game } = view;
  if (overlay?.kind === 'reveal' || overlay?.kind === 'noBuzz') return overlay.question;
  if (overlay?.kind === 'banner' || overlay?.kind === 'pick' || overlay?.kind === 'intro') return null;
  const { pending } = game;
  return pending.kind === 'answer' || pending.kind === 'buzz' ? pending.question : null;
}

/** Co w tej chwili może zrobić człowiek. */
export function humanTurn(view: SoloView): HumanTurn {
  if (view.overlay !== null || view.paused) return null;
  const { pending } = view.game;
  if (pending.kind === 'answer' && pending.playerId === HUMAN_ID) return 'answer';
  if (pending.kind === 'pick' && pending.chooserId === HUMAN_ID) return 'pick';
  if (pending.kind === 'buzz' && !getPlayer(view.game, HUMAN_ID).eliminated) return 'buzz';
  return null;
}

export interface SoloControllerOptions {
  game: GameState;
  rng: Rng;
  bank: Question[];
  clock?: Clock;
  pacing?: Partial<Pacing>;
  /** Pozwala podmienić profile botów (np. w testach). */
  getProfile?: (botId: string) => BotProfile;
}

interface Scheduled {
  fn: () => void;
  dueAt: number;
  handle: unknown;
}

/**
 * Prowadzi rozgrywkę w czasie rzeczywistym: odlicza czas, wykonuje ruchy botów
 * z opóźnieniem i robi pauzy, żeby gracz widział, co się dzieje.
 * Silnik (`reduce`) zostaje czystą funkcją — tu jest tylko "reżyseria".
 */
export class SoloController {
  private view: SoloView;
  private readonly listeners = new Set<() => void>();
  private readonly rng: Rng;
  private readonly bank: Question[];
  private readonly clock: Clock;
  private readonly pacing: Pacing;
  private readonly getProfile: (botId: string) => BotProfile;
  private timer: Scheduled | null = null;
  private pausedTimer: { fn: () => void; remaining: number; deadlineRemaining: number | null } | null = null;
  private started = false;
  /** Odpowiedź bota przygotowana w chwili zgłoszenia (finał). */
  private prepared: { playerId: string; questionId: string; answer: BotAnswer } | null = null;
  /** Kiedy pokazano planszę etapu (do blokady przypadkowego zamknięcia). */
  private bannerShownAt = 0;
  /** Które pytanie (wg kursora talii) zostało już zapowiedziane. */
  private introducedCursor: number | null = null;

  constructor({ game, rng, bank, clock = realClock, pacing, getProfile = getBotProfile }: SoloControllerOptions) {
    this.rng = rng;
    this.getProfile = getProfile;
    this.bank = bank;
    this.clock = clock;
    this.pacing = { ...DEFAULT_PACING, ...pacing };
    this.view = { game, overlay: null, deadline: null, timerMs: null, thinkingId: null, paused: false };
  }

  // ---------- API dla Reacta ----------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = () => this.view;

  /** Rozpoczyna grę albo wznawia ją po pauzie. */
  start() {
    if (!this.started) {
      this.started = true;
      log.info('Start rozgrywki', { phase: this.view.game.phase });
      this.showBanner(this.view.game.phase);
      return;
    }
    if (!this.view.paused) return;
    const paused = this.pausedTimer;
    this.pausedTimer = null;
    const now = this.clock.now();
    log.info('Wznowienie', { remainingMs: paused?.remaining ?? null });
    this.update({
      paused: false,
      deadline: paused?.deadlineRemaining != null ? now + paused.deadlineRemaining : this.view.deadline,
    });
    if (paused) this.schedule(paused.remaining, paused.fn);
  }

  pause() {
    if (!this.started || this.view.paused) return;
    const now = this.clock.now();
    if (this.timer) {
      this.pausedTimer = {
        fn: this.timer.fn,
        remaining: Math.max(0, this.timer.dueAt - now),
        deadlineRemaining: this.view.deadline === null ? null : Math.max(0, this.view.deadline - now),
      };
      this.clearTimer();
    }
    log.info('Pauza', { remainingMs: this.pausedTimer?.remaining ?? null });
    this.update({ paused: true });
  }

  // ---------- ruchy człowieka ----------

  submitAnswer(text: string) {
    if (!this.isHumanTurn('answer')) return;
    this.answer(HUMAN_ID, text);
  }

  buzz() {
    if (!this.isHumanTurn('buzz')) return;
    this.prepared = null;
    this.buzzBy(HUMAN_ID);
  }

  pick(targetId: string) {
    if (!this.isHumanTurn('pick')) return;
    if (!pickTargets(this.view.game, HUMAN_ID).some((p) => p.id === targetId)) {
      log.debug('Zignorowano niedozwolone wskazanie', { targetId });
      return;
    }
    this.pickBy(HUMAN_ID, targetId);
  }

  /** Zamyka planszę etapu albo pomija trwającą pauzę (wynik, zapowiedź). */
  skip() {
    if (this.view.overlay === null || this.view.paused) return;
    if (this.view.overlay.kind === 'banner') {
      if (this.clock.now() - this.bannerShownAt < this.pacing.bannerLockMs) {
        log.debug('Zignorowano dotknięcie planszy tuż po jej pokazaniu');
        return;
      }
      this.activate();
      return;
    }
    if (!this.timer) return;
    const { fn } = this.timer;
    this.clearTimer();
    fn();
  }

  /** Gdy gracz już odpadł, rozgrywa resztę gry natychmiast. */
  fastForward() {
    const { game } = this.view;
    if (game.phase === 'finished' || !getPlayer(game, HUMAN_ID).eliminated) {
      log.debug('Zignorowano przewinięcie gry', { phase: game.phase });
      return;
    }
    this.clearTimer();
    this.prepared = null;
    log.info('Przewinięcie do wyników', { phase: game.phase });
    const finished = simulateGame(game, { rng: this.rng, bank: this.bank, getProfile: this.getProfile });
    log.info('Koniec gry', { ranking: finished.ranking });
    this.update({ game: finished, overlay: null, deadline: null, timerMs: null, thinkingId: null });
  }

  // ---------- przebieg ----------

  private activate() {
    this.update({ overlay: null, thinkingId: null, deadline: null, timerMs: null });
    const { game } = this.view;
    const { pending, rules } = game;

    switch (pending.kind) {
      case 'none':
        return;

      case 'answer': {
        const { playerId, question } = pending;
        // Pytanie z kolei (bez wskazania ani zgłoszenia) najpierw zapowiadamy, żeby było wiadomo, kto odpowiada.
        if (pending.reason === 'turn' && this.introducedCursor !== game.cursor) {
          this.introducedCursor = game.cursor;
          this.update({ overlay: { kind: 'intro', playerId } });
          this.schedule(this.pacing.introMs, () => this.activate());
          return;
        }
        if (playerId === HUMAN_ID) {
          this.countdown(rules.answerTimeMs, rules.answerTimeMs, () => {
            log.info('Koniec czasu na odpowiedź', { playerId: HUMAN_ID });
            this.answer(HUMAN_ID, null);
          });
          return;
        }
        const prepared = this.prepared;
        this.prepared = null;
        const answer =
          prepared && prepared.playerId === playerId && prepared.questionId === question.id
            ? prepared.answer
            : decideAnswer(this.botContext(playerId), question, rules);
        log.debug('Bot odpowie', { playerId, delayMs: answer.delayMs, noAnswer: answer.text === null });
        this.update({ thinkingId: playerId });
        this.countdown(rules.answerTimeMs, answer.delayMs, () => this.answer(playerId, answer.text));
        return;
      }

      case 'buzz': {
        let fastest: { playerId: string; delayMs: number; answer: BotAnswer } | null = null;
        for (const player of activePlayers(game)) {
          if (player.isHuman) continue;
          const buzz = decideBuzz(this.botContext(player.id), pending.question, rules);
          if (buzz.delayMs !== null && (fastest === null || buzz.delayMs < fastest.delayMs)) {
            fastest = { playerId: player.id, delayMs: buzz.delayMs, answer: buzz.answer };
          }
        }
        this.prepared = fastest && {
          playerId: fastest.playerId,
          questionId: pending.question.id,
          answer: fastest.answer,
        };
        const winner = fastest;
        log.debug('Okno zgłoszeń', { fastestBot: winner?.playerId ?? null, delayMs: winner?.delayMs ?? null });
        this.countdown(rules.buzzWindowMs, winner?.delayMs ?? rules.buzzWindowMs, () =>
          winner ? this.buzzBy(winner.playerId) : this.noBuzz(),
        );
        return;
      }

      case 'pick': {
        const { chooserId } = pending;
        if (chooserId === HUMAN_ID) return; // czekamy na dotknięcie pulpitu
        const ctx = this.botContext(chooserId);
        this.update({ thinkingId: chooserId });
        this.schedule(decidePickDelay(ctx), () => this.pickBy(chooserId, decideTarget(ctx, this.view.game, chooserId)));
        return;
      }
    }
  }

  private answer(playerId: string, text: string | null) {
    const { pending } = this.view.game;
    if (pending.kind !== 'answer' || pending.playerId !== playerId) return;
    this.clearTimer();

    const events = this.apply({ type: 'answer', playerId, text });
    const result = events.find((e) => e.type === 'answer');
    this.update({
      overlay: {
        kind: 'reveal',
        playerId,
        question: pending.question,
        text,
        correct: result?.type === 'answer' && result.correct,
        correctAnswer: pending.question.answers[0],
        eliminated: events.some((e) => e.type === 'eliminated' && e.playerId === playerId),
      },
    });
    this.schedule(this.pacing.revealMs, () => this.continueAfter(events));
  }

  private buzzBy(playerId: string) {
    this.clearTimer();
    this.apply({ type: 'buzz', playerId });
    this.update({ overlay: { kind: 'buzz', playerId } });
    this.schedule(this.pacing.announceMs, () => this.activate());
  }

  private noBuzz() {
    const { pending } = this.view.game;
    if (pending.kind !== 'buzz') return;
    this.clearTimer();
    this.prepared = null;
    const events = this.apply({ type: 'noBuzz' });
    this.update({ overlay: { kind: 'noBuzz', question: pending.question, correctAnswer: pending.question.answers[0] } });
    this.schedule(this.pacing.revealMs, () => this.continueAfter(events));
  }

  private pickBy(chooserId: string, targetId: string) {
    this.clearTimer();
    this.apply({ type: 'pick', chooserId, targetId });
    this.update({ overlay: { kind: 'pick', chooserId, targetId } });
    this.schedule(this.pacing.announceMs, () => this.activate());
  }

  /** Po pokazaniu wyniku: plansza nowego etapu albo dalsza gra. */
  private continueAfter(events: GameEvent[]) {
    const phase = [...events].reverse().find((e) => e.type === 'phase');
    if (phase?.type === 'phase' && phase.phase !== 'finished') {
      this.showBanner(phase.phase);
    } else {
      this.activate();
    }
  }

  /** Plansza etapu czeka, aż gracz ją przeczyta i dotknie ekranu. */
  private showBanner(phase: Phase) {
    this.clearTimer();
    this.bannerShownAt = this.clock.now();
    this.update({ overlay: { kind: 'banner', phase }, thinkingId: null, deadline: null, timerMs: null });
  }

  // ---------- pomocnicze ----------

  private apply(action: GameAction): GameEvent[] {
    const before = this.view.game.events.length;
    let game: GameState;
    try {
      game = reduce(this.view.game, action);
    } catch (error) {
      // Sterownik nie powinien wysłać niedozwolonego ruchu; jeśli to się stanie, chcemy to zobaczyć.
      log.error('Silnik odrzucił ruch', { action, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    this.update({ game, deadline: null, timerMs: null, thinkingId: null });
    const events = game.events.slice(before);
    log.debug('Ruch', { ...action });
    for (const event of events) logEvent(event);
    return events;
  }

  /** Sprawdza, czy człowiek może teraz wykonać dany ruch; zignorowane ruchy (np. podwójne kliknięcie) trafiają do logów. */
  private isHumanTurn(expected: Exclude<HumanTurn, null>): boolean {
    const turn = humanTurn(this.view);
    if (turn === expected) return true;
    log.debug('Zignorowano ruch gracza', {
      move: expected,
      turn,
      overlay: this.view.overlay?.kind ?? null,
      paused: this.view.paused,
    });
    return false;
  }

  /** Pokazuje licznik `totalMs`, a akcję wykonuje po `fireInMs` (bot może zdążyć wcześniej). */
  private countdown(totalMs: number, fireInMs: number, fn: () => void) {
    this.update({ deadline: this.clock.now() + totalMs, timerMs: totalMs });
    this.schedule(Math.min(totalMs, fireInMs), fn);
  }

  private schedule(ms: number, fn: () => void) {
    this.clearTimer();
    const timer: Scheduled = {
      fn,
      dueAt: this.clock.now() + ms,
      handle: this.clock.setTimeout(() => {
        if (this.timer === timer) this.timer = null;
        fn();
      }, ms),
    };
    this.timer = timer;
  }

  private clearTimer() {
    if (this.timer) {
      this.clock.clearTimeout(this.timer.handle);
      this.timer = null;
    }
  }

  private botContext(playerId: string): BotContext {
    const player = getPlayer(this.view.game, playerId);
    if (!player.botId) throw new Error(`Gracz ${playerId} nie jest botem`);
    return { profile: this.getProfile(player.botId), difficulty: this.view.game.difficulty, rng: this.rng, bank: this.bank };
  }

  private update(patch: Partial<SoloView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** Ważne zdarzenia silnika na poziomie `info`, reszta jako `debug`. */
function logEvent(event: GameEvent) {
  switch (event.type) {
    case 'phase':
      log.info('Etap', { phase: event.phase });
      break;
    case 'eliminated':
      log.info('Gracz odpadł', { playerId: event.playerId });
      break;
    case 'gameOver':
      log.info('Koniec gry', { ranking: event.ranking });
      break;
    case 'answer':
      log.debug('Odpowiedź', { playerId: event.playerId, questionId: event.questionId, correct: event.correct });
      break;
    case 'lifeLost':
      log.debug('Utrata szansy', { playerId: event.playerId, livesLeft: event.livesLeft });
      break;
  }
}
