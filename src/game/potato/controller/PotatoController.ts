import { createLogger } from '@/lib/log';

import { isCorrectAnswer } from '../../answers';
import { decideAnswer, type BotAnswer, type BotContext } from '../../bots/brain';
import { getBotProfile, type BotProfile } from '../../bots/profiles';
import { realClock, type Clock } from '../../clock';
import { DIFFICULTY_PRESETS } from '../../rules';
import { pickRandom, type Rng } from '../../rng';
import type { Difficulty, Question, Rules } from '../../types';
import { buildChoices, CHOICE_COUNT } from '../../choices';
import { pickTarget } from '../bots';
import { activePlayers, errorEliminates, PotatoRuleError, reducePotato, type PotatoAction, type PotatoPhase, type PotatoState } from '../engine';

const log = createLogger('ziemniak');

export interface PotatoPacing {
  /** Jak długo widać wynik odpowiedzi. */
  revealMs: number;
}

export const DEFAULT_POTATO_PACING: PotatoPacing = { revealMs: 1500 };

/** Ile czasu ma gracz na wskazanie, komu przekazać ziemniaka. Po upływie wybór jest losowy. */
export const PICK_TIMEOUT_MS = 10_000;
/** Czas na decyzję w finale. Po upływie odpowiada losowy rywal. */
export const DUEL_PICK_TIMEOUT_MS = 5_000;

export type PotatoOverlay =
  /** `question`: pytanie, na które odpowiadano; w stanie gry jest już następne. */
  | { kind: 'reveal'; playerId: string; question: Question; text: string | null; correct: boolean; correctAnswer: string }
  /** Plansza rundy: czeka na gracza (`acceptRound`), żaden czas nie biegnie. */
  | { kind: 'round'; phase: PotatoPhase }
  | { kind: 'finished' };

export interface PotatoView {
  game: PotatoState;
  overlay: PotatoOverlay | null;
  deadline: number | null;
  timerMs: number | null;
  /** Bot, który właśnie „myśli”. */
  thinkingId: string | null;
  /** Po wyniku poprawnej odpowiedzi gracz wskazuje, komu przekazać ziemniaka (`allowSelf` w finale). */
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
  /** Gracz zamknął planszę sprintu, więc czas sprintu biegnie. */
  private sprintStarted = false;
  /** Runda sprzed bieżącego wyniku: po wyniku wiadomo, czy pokazać planszę nowej rundy. */
  private revealFrom: PotatoPhase | null = null;
  /** Czy gra jest uruchomiona (między `start` a `stop`). */
  private running = false;

  constructor({ game, difficulty, rng, clock = realClock, pacing, getProfile = getBotProfile }: PotatoControllerOptions) {
    this.difficulty = difficulty;
    this.rng = rng;
    this.clock = clock;
    this.pacing = { ...DEFAULT_POTATO_PACING, ...pacing };
    this.getProfile = getProfile;
    this.rules = { answerTimeMs: DIFFICULTY_PRESETS[difficulty].answerTimeMs };
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

  /** Start gry: rundę 1 zaczyna człowiek, a gra czeka na zamknięcie planszy. Po `stop` wznawia od bieżącego kroku. */
  start() {
    if (this.running) return;
    this.running = true;
    const game = this.view.game;
    if (game.holderId === null && game.phase !== 'finished') {
      const first = game.players.find((p) => p.isHuman) ?? pickRandom(this.rng, activePlayers(game));
      log.info('Start rundy 1', { holder: first.id });
      // Razem z planszą: lektor nie może zacząć czytać pytania, które zaraz zasłoni plansza.
      if (this.apply({ type: 'start', holderId: first.id }, { overlay: { kind: 'round', phase: game.phase } })) log.info('Runda', { phase: game.phase });
      return;
    }
    if (game.phase === 'sprint' && (this.sprintStarted || this.view.overlay === null)) this.startSprintClock();
    this.resumeStep();
  }

  /** Wstrzymuje grę: zamraża czas kroku i sprintu. Ponownie wywołana nic nie robi. */
  pause() {
    if (this.view.paused || !this.running || this.view.overlay?.kind === 'finished') return;
    this.syncSprint();
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
    if (this.sprintRuns()) this.startSprintClock();
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
      const from = this.revealFrom ?? game.phase;
      this.schedule(this.pacing.revealMs, () => this.afterReveal(from));
      return;
    }
    if (overlay?.kind === 'round') return;
    if (awaitingPick) {
      this.startPickCountdown();
      return;
    }
    this.takeTurn();
  }

  /** Gracz zamyka planszę rundy (także w trakcie mówienia lektora): dopiero wtedy gra rusza. */
  acceptRound() {
    const { overlay, paused } = this.view;
    if (overlay?.kind !== 'round' || paused) return;
    log.info('Plansza zamknięta', { phase: overlay.phase, speaking: this.speaking });
    this.update({ overlay: null });
    if (overlay.phase === 'sprint') this.startSprintClock();
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
    if (!pick || this.view.paused) return;
    const target = this.view.game.players.find((p) => p.id === targetId);
    if (!target || target.eliminated) return;
    if (targetId === pick.chooserId && !pick.allowSelf) return;
    // Czas sprintu mógł właśnie minąć: wtedy nie ma już komu przekazywać pytania.
    this.syncSprint();
    if (this.view.awaitingPick) this.passTo(pick.chooserId, targetId);
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
    const { game, overlay, awaitingPick, paused } = this.view;
    return !paused && overlay === null && awaitingPick === null && this.isHuman(game.holderId) && game.question !== null;
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
    const phaseBefore = this.view.game.phase;
    this.syncSprint();
    const game = this.view.game;
    const question = game.question;
    // Synchronizacja mogła zakończyć sprint: pytanie finału nie jest tym, na które padła odpowiedź.
    if (game.phase !== phaseBefore || !question || game.holderId !== playerId) return;

    const correct = text !== null && isCorrectAnswer(text, question.answers);
    if (correct && this.isHuman(playerId)) {
      // Najpierw wynik: punkt, mnożnik, zielony dymek i pochwała naraz. Wskazywanie dopiero po nim (`afterReveal`).
      if (!this.apply({ type: 'award', playerId, text: text! }, this.revealPatch(playerId, question, text, true))) {
        this.takeTurn();
        return;
      }
      log.debug('Odpowiedź', { playerId, correct, next: null, withoutHuman: game.questionsWithoutHuman });
      this.revealFrom = game.phase;
      this.schedule(this.pacing.revealMs, () => this.afterReveal(game.phase));
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

  private startPickCountdown() {
    const ms = this.view.game.phase === 'duel' ? DUEL_PICK_TIMEOUT_MS : PICK_TIMEOUT_MS;
    this.countdown(ms, ms, () => this.pickAtRandom());
  }

  /** Po upływie czasu na wybór: losowy rywal. Na siebie gracz bierze pytanie tylko przyciskiem. */
  private pickAtRandom() {
    const pick = this.view.awaitingPick;
    if (!pick) return;
    const target = pickRandom(this.rng, this.opponentsOf(pick.chooserId));
    log.info('Brak wyboru w czasie, wskazanie losowe', { chooserId: pick.chooserId, targetId: target.id });
    this.pick(target.id);
  }

  private opponentsOf(playerId: string) {
    return activePlayers(this.view.game).filter((p) => p.id !== playerId);
  }

  /** Wybór celu; w sprincie i po poprawnej odpowiedzi zawsze inny gracz. */
  private chooseNext(holderId: string, correct: boolean): string {
    const game = this.view.game;
    if (game.phase === 'sprint' || correct) return pickTarget(game, holderId, this.rng);
    // Po błędzie ziemniak może wrócić do tego samego gracza, chyba że właśnie odpada.
    const holder = game.players.find((p) => p.id === holderId)!;
    return pickTarget(game, errorEliminates(game, holder) ? holderId : null, this.rng);
  }

  private commit(playerId: string, text: string | null, next: string) {
    const before = this.view.game;
    const question = before.question!;
    const correct = text !== null && isCorrectAnswer(text, question.answers);
    // Stan gry i wynik zmieniają się razem: lektor nie może zobaczyć nowego stanu bez wyniku.
    if (!this.apply({ type: 'answer', playerId, text, next }, this.revealPatch(playerId, question, text, correct))) {
      this.takeTurn();
      return;
    }
    log.debug('Odpowiedź', { playerId, correct, next, withoutHuman: this.view.game.questionsWithoutHuman });
    this.revealFrom = before.phase;
    this.schedule(this.pacing.revealMs, () => this.afterReveal(before.phase));
  }

  private revealPatch(playerId: string, question: Question, text: string | null, correct: boolean): Partial<PotatoView> {
    return {
      overlay: { kind: 'reveal', playerId, question, text, correct, correctAnswer: question.answers[0] },
      awaitingPick: null,
      thinkingId: null,
      choices: null,
      deadline: null,
      timerMs: null,
    };
  }

  /** Wskazanie gracza: nagroda jest już przyznana, więc od razu następna tura. */
  private passTo(playerId: string, next: string) {
    this.clearMain();
    if (!this.apply({ type: 'pass', playerId, next }, { awaitingPick: null })) {
      this.startPickCountdown();
      return;
    }
    log.debug('Przekazanie', { playerId, next, withoutHuman: this.view.game.questionsWithoutHuman });
    this.takeTurn();
  }

  private afterReveal(previousPhase: PotatoPhase) {
    // Wynik poprawnej odpowiedzi człowieka minął: pytanie znika i gracz wskazuje następnego.
    const { awarded, holderId, phase } = this.view.game;
    if (awarded && holderId !== null) {
      this.update({ overlay: null, awaitingPick: { chooserId: holderId, allowSelf: phase === 'duel' } });
      this.startPickCountdown();
      return;
    }
    // Bez człowieka nie ma po co grać dalej: od razu wyniki.
    if (this.view.game.phase !== 'finished' && this.view.game.players.some((p) => p.isHuman && p.eliminated)) {
      log.info('Gracz odpadł, koniec gry', { phase: this.view.game.phase });
      this.apply({ type: 'endEarly' });
    }
    const game = this.view.game;
    if (game.phase === 'finished') {
      this.update({ overlay: { kind: 'finished' } });
      log.info('Koniec gry', { winner: game.ranking?.[0] ?? null });
      return;
    }
    if (game.phase !== previousPhase) {
      log.info('Runda', { phase: game.phase });
      this.update({ overlay: { kind: 'round', phase: game.phase } });
      return;
    }
    this.update({ overlay: null });
    this.takeTurn();
  }

  // ---------- sprint ----------

  private sprintRuns(): boolean {
    return this.sprintStarted && this.view.game.phase === 'sprint';
  }

  /** Zegar sprintu liczy się na żywo; kary za błędy są już odjęte w silniku. */
  private startSprintClock() {
    this.sprintStarted = true;
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
    if (!this.sprintRuns()) return;
    const game = this.view.game;
    const elapsed = this.clock.now() - this.sprintSyncAt;
    this.sprintSyncAt = this.clock.now();
    if (elapsed < game.sprintMsLeft) {
      this.apply({ type: 'tick', ms: elapsed });
      return;
    }
    // Koniec czasu. Dobra odpowiedź czekająca na wskazanie ma już punkt, więc wskazanie przepada.
    this.clearMain();
    this.apply({ type: 'tick', ms: elapsed }, { overlay: { kind: 'round', phase: 'duel' }, thinkingId: null, awaitingPick: null, choices: null });
    log.info('Koniec sprintu', { duel: this.view.game.holderId });
    log.info('Runda', { phase: 'duel' });
  }

  private clearSprintTimer() {
    if (this.sprintTimer !== null) this.clock.clearTimeout(this.sprintTimer);
    this.sprintTimer = null;
  }

  // ---------- pomocnicze ----------

  /** Stosuje akcję silnika. Błąd zasad nie psuje stanu (silnik zwraca nowy obiekt albo rzuca). */
  private apply(action: PotatoAction, patch: Partial<PotatoView> = {}): boolean {
    try {
      this.setGame(reducePotato(this.view.game, action), patch);
      return true;
    } catch (error) {
      if (error instanceof PotatoRuleError) {
        log.warn('Odrzucony ruch', { type: action.type, reason: error.message });
        return false;
      }
      throw error;
    }
  }

  private setGame(game: PotatoState, patch: Partial<PotatoView>) {
    const sprintRuns = this.sprintStarted && game.phase === 'sprint';
    if (game.phase !== 'sprint') {
      this.sprintStarted = false;
      this.clearSprintTimer();
    }
    this.update({ game, ...patch, sprintEndsAt: sprintRuns ? this.clock.now() + game.sprintMsLeft : null });
    // Kara mogła skrócić czas: koniec sprintu trzeba zaplanować od nowa.
    if (sprintRuns) this.scheduleSprintEnd();
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
    // Nowy krok może czekać na ciszę lektora: w tym czasie nie wolno pokazywać starego paska.
    if (this.view.deadline !== null || this.view.timerMs !== null) this.update({ deadline: null, timerMs: null });
  }

  private update(patch: Partial<PotatoView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
}
