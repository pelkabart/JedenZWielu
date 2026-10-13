import { getBotProfile, type BotProfile } from '../bots/profiles';
import { humanTurn, SoloController, visibleQuestion, type Pacing, type SoloView } from '../controller/SoloController';
import { createGame, getPlayer } from '../engine';
import { DEFAULT_RULES } from '../rules';
import { createRng } from '../rng';
import { HUMAN_ID } from '../solo';
import { driveToFinal, TEST_BANK } from '../testing/fixtures';
import type { GameState } from '../types';

const PACING: Pacing = { revealMs: 2000, bannerLockMs: 700, announceMs: 1000, introMs: 2500 };
const BOT_IDS = ['b1', 'b2', 'b3', 'b4'];

/** Bot o przewidywalnym czasie: odpowiada po 4 s, zgłasza się po 1 s. */
const steadyBot: BotProfile = {
  ...getBotProfile('profesor'),
  id: 'steady',
  answerTimeMs: [4000, 4000],
  buzzTimeMs: [1000, 1000],
};

function game(seed = 1, humanSeat = 0): GameState {
  const ids = [...BOT_IDS];
  ids.splice(humanSeat, 0, HUMAN_ID);
  return createGame({
    players: ids.map((id) =>
      id === HUMAN_ID ? { id, name: 'Ty', isHuman: true } : { id, name: id.toUpperCase(), isHuman: false, botId: 'steady' },
    ),
    difficulty: 'normal',
    questions: TEST_BANK,
    rng: createRng(seed),
  });
}

function controller(state: GameState, profile: Partial<BotProfile> = {}, seed = 1) {
  return new SoloController({
    game: state,
    rng: createRng(seed),
    bank: TEST_BANK,
    pacing: PACING,
    getProfile: () => ({ ...steadyBot, ...profile }),
  });
}

const advance = (ms: number) => jest.advanceTimersByTime(ms);

/** Przesuwa zegar małymi krokami, aż warunek będzie spełniony; zwraca, ile minęło. */
function advanceUntil(c: SoloController, condition: (view: SoloView) => boolean, maxMs = 120000) {
  let elapsed = 0;
  while (!condition(c.getView())) {
    if (elapsed >= maxMs) throw new Error('Warunek nie został spełniony w czasie');
    advance(50);
    elapsed += 50;
  }
  return elapsed;
}

/** Gracz czyta planszę etapu i dotyka ekranu (plansza nie znika sama). */
function dismissBanner(c: SoloController) {
  expect(c.getView().overlay?.kind).toBe('banner');
  advance(PACING.bannerLockMs);
  c.skip();
}

/** Od startu gry do pokazania pierwszego pytania: plansza etapu + zapowiedź „Odpowiada: …”. */
function toFirstQuestion(c: SoloController) {
  dismissBanner(c);
  advance(PACING.introMs);
}

/** Krok pętli w testach całych gier: planszę etapu zamyka „dotknięciem”, w innych sytuacjach czeka. */
function tick(c: SoloController, ms: number) {
  if (c.getView().overlay?.kind === 'banner') dismissBanner(c);
  else advance(ms);
}

function correctAnswer(view: SoloView) {
  if (view.game.pending.kind !== 'answer') throw new Error('Brak pytania');
  return view.game.pending.question.answers[0];
}

/** Rozgrywa grę do końca; strategia gracza decyduje, co robi człowiek. */
function playOut(c: SoloController, onHumanTurn: (c: SoloController, view: SoloView) => void) {
  for (let step = 0; step < 50000; step++) {
    const view = c.getView();
    if (view.game.phase === 'finished' && view.overlay === null) return view;
    if (humanTurn(view) !== null) onHumanTurn(c, view);
    else tick(c, 250);
  }
  throw new Error('Gra się nie skończyła');
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('start i plansze etapów', () => {
  it('zaczyna od planszy etapu I, potem zadaje pierwsze pytanie', () => {
    const c = controller(game());
    c.start();
    expect(c.getView().overlay).toEqual({ kind: 'banner', phase: 'stage1' });
    expect(humanTurn(c.getView())).toBeNull();

    dismissBanner(c);
    expect(c.getView().overlay).toEqual({ kind: 'intro', playerId: HUMAN_ID });
    expect(humanTurn(c.getView())).toBeNull();

    advance(PACING.introMs);
    expect(c.getView().overlay).toBeNull();
    expect(humanTurn(c.getView())).toBe('answer');
  });

  it('plansza etapu nie znika sama, tylko po dotknięciu', () => {
    const c = controller(game());
    c.start();
    advance(60000);
    expect(c.getView().overlay).toEqual({ kind: 'banner', phase: 'stage1' });
    expect(c.getView().game.events.filter((e) => e.type === 'answer')).toHaveLength(0);

    dismissBanner(c);
    expect(c.getView().overlay).toEqual({ kind: 'intro', playerId: HUMAN_ID });
  });

  it('dotknięcie tuż po pokazaniu planszy jest ignorowane (żeby nie zamknąć jej przypadkiem)', () => {
    const c = controller(game());
    c.start();
    advance(PACING.bannerLockMs - 1);
    c.skip();
    expect(c.getView().overlay?.kind).toBe('banner');
    advance(1);
    c.skip();
    expect(c.getView().overlay?.kind).toBe('intro');
  });

  it('w trakcie pauzy planszy nie da się zamknąć', () => {
    const c = controller(game());
    c.start();
    advance(PACING.bannerLockMs);
    c.pause();
    c.skip();
    expect(c.getView().overlay?.kind).toBe('banner');
    c.start();
    c.skip();
    expect(c.getView().overlay?.kind).toBe('intro');
  });

  it('powiadamia subskrybentów o zmianach', () => {
    const c = controller(game());
    const listener = jest.fn();
    const unsubscribe = c.subscribe(listener);
    c.start();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    dismissBanner(c);
    expect(listener).not.toHaveBeenCalled();
  });

  it('pokazuje planszę etapu II po zakończeniu etapu I', () => {
    const c = controller(game());
    c.start();
    toFirstQuestion(c);
    c.submitAnswer(correctAnswer(c.getView()));
    // Silnik przechodzi do etapu II już przy ostatniej odpowiedzi, ale najpierw widać jej wynik.
    advanceUntil(c, (v) => v.game.phase === 'stage2');
    expect(c.getView().overlay).toMatchObject({ kind: 'reveal', playerId: 'b4' });
    advance(PACING.revealMs);
    expect(c.getView().overlay).toEqual({ kind: 'banner', phase: 'stage2' });
    // Każdy z 5 graczy dostał w etapie I dokładnie jedno pytanie.
    expect(c.getView().game.events.filter((e) => e.type === 'answer')).toHaveLength(5);
  });
});

describe('odpowiedź człowieka', () => {
  function humanAnswering() {
    const c = controller(game());
    c.start();
    toFirstQuestion(c);
    return c;
  }

  it('uruchamia licznik na czas odpowiedzi', () => {
    const c = humanAnswering();
    expect(c.getView().timerMs).toBe(DEFAULT_RULES.answerTimeMs);
    expect(c.getView().deadline).toBe(Date.now() + DEFAULT_RULES.answerTimeMs);
  });

  it('dobra odpowiedź pokazuje wynik, a po pauzie gra idzie dalej', () => {
    const c = humanAnswering();
    c.submitAnswer(correctAnswer(c.getView()));
    expect(c.getView().overlay).toMatchObject({ kind: 'reveal', playerId: HUMAN_ID, correct: true });
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(3);

    advance(PACING.revealMs);
    expect(c.getView().overlay).toEqual({ kind: 'intro', playerId: 'b1' });
    advance(PACING.introMs);
    expect(c.getView().overlay).toBeNull();
    expect(c.getView().thinkingId).toBe('b1');
  });

  it('po upływie czasu odpowiedź jest pusta i kosztuje szansę', () => {
    const c = humanAnswering();
    advance(DEFAULT_RULES.answerTimeMs - 1);
    expect(humanTurn(c.getView())).toBe('answer');
    advance(1);
    expect(c.getView().overlay).toMatchObject({ kind: 'reveal', playerId: HUMAN_ID, text: null, correct: false });
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(2);
  });

  it('odpowiedź po czasie jest ignorowana (wyścig z licznikiem)', () => {
    const c = humanAnswering();
    const answer = correctAnswer(c.getView());
    advance(DEFAULT_RULES.answerTimeMs);
    expect(() => c.submitAnswer(answer)).not.toThrow();
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(2);
    expect(c.getView().game.events.filter((e) => e.type === 'answer')).toHaveLength(1);
  });

  it('podwójne zatwierdzenie liczy się tylko raz', () => {
    const c = humanAnswering();
    c.submitAnswer('zle');
    c.submitAnswer('zle');
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(2);
  });

  it('licznik nie odpala się po odpowiedzi', () => {
    const c = humanAnswering();
    c.submitAnswer(correctAnswer(c.getView()));
    advance(PACING.revealMs);
    // Teraz odpowiada bot; gdyby stary licznik człowieka żył, gracz straciłby szansę.
    advance(DEFAULT_RULES.answerTimeMs);
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(3);
  });
});

describe('zapowiedź przed pytaniem', () => {
  it('przed pytaniem bota pokazuje, kto odpowiada, i ukrywa pytanie', () => {
    const c = controller(game(1, 2));
    c.start();
    dismissBanner(c);
    const view = c.getView();
    expect(view.overlay).toEqual({ kind: 'intro', playerId: 'b1' });
    expect(visibleQuestion(view)).toBeNull();
    expect(view.thinkingId).toBeNull();
    expect(view.deadline).toBeNull();

    advance(PACING.introMs);
    expect(c.getView().thinkingId).toBe('b1');
    expect(visibleQuestion(c.getView())).not.toBeNull();
  });

  it('licznik człowieka rusza dopiero po zapowiedzi', () => {
    const c = controller(game());
    c.start();
    dismissBanner(c);
    c.submitAnswer('za wczesnie');
    expect(c.getView().game.events.some((e) => e.type === 'answer')).toBe(false);

    advance(PACING.introMs);
    expect(c.getView().deadline).toBe(Date.now() + DEFAULT_RULES.answerTimeMs);
    // Pełne 15 s od pokazania pytania, a nie od zapowiedzi.
    advance(DEFAULT_RULES.answerTimeMs - 1);
    expect(humanTurn(c.getView())).toBe('answer');
  });

  it('pauza w trakcie zapowiedzi zatrzymuje ją', () => {
    const c = controller(game());
    c.start();
    dismissBanner(c);
    advance(1000);
    c.pause();
    advance(60000);
    c.start();
    expect(c.getView().overlay?.kind).toBe('intro');
    advance(PACING.introMs - 1000 - 1);
    expect(c.getView().overlay?.kind).toBe('intro');
    advance(1);
    expect(humanTurn(c.getView())).toBe('answer');
  });

  it('każde pytanie zadane z kolei jest zapowiadane dokładnie raz', () => {
    const c = controller(game(1, 2));
    c.start();
    const intros: string[] = [];
    let last: SoloView['overlay'] = null;
    for (let i = 0; i < 5000 && c.getView().game.phase === 'stage1'; i++) {
      const view = c.getView();
      if (view.overlay !== last && view.overlay?.kind === 'intro') intros.push(view.overlay.playerId);
      last = view.overlay;
      if (humanTurn(view) === 'answer') c.submitAnswer(correctAnswer(view));
      else tick(c, 50);
    }
    expect(intros).toEqual(['b1', 'b2', HUMAN_ID, 'b3', 'b4']);
  });
});

describe('ruchy botów', () => {
  it('bot "myśli", a człowiek nie może w tym czasie odpowiadać', () => {
    const c = controller(game(1, 2));
    c.start();
    toFirstQuestion(c);
    expect(c.getView().thinkingId).toBe('b1');
    expect(humanTurn(c.getView())).toBeNull();
    c.submitAnswer('cokolwiek');
    expect(c.getView().game.events.some((e) => e.type === 'answer')).toBe(false);

    const elapsed = advanceUntil(c, (v) => v.overlay !== null);
    expect(c.getView().overlay).toMatchObject({ kind: 'reveal', playerId: 'b1' });
    expect(elapsed).toBeGreaterThanOrEqual(4000);
    expect(elapsed).toBeLessThanOrEqual(DEFAULT_RULES.answerTimeMs);
  });

  it('skip pomija pauzę po wyniku', () => {
    const c = controller(game(1, 2));
    c.start();
    toFirstQuestion(c);
    advanceUntil(c, (v) => v.overlay?.kind === 'reveal');
    c.skip();
    // Następny gracz z kolei jest najpierw zapowiadany; tę pauzę też można pominąć.
    expect(c.getView().overlay).toEqual({ kind: 'intro', playerId: 'b2' });
    c.skip();
    expect(c.getView().overlay).toBeNull();
    expect(c.getView().thinkingId).toBe('b2');
  });

  it('skip nie przyspiesza odpowiedzi bota', () => {
    const c = controller(game(1, 2));
    c.start();
    toFirstQuestion(c);
    c.skip();
    expect(c.getView().thinkingId).toBe('b1');
    expect(c.getView().game.events.some((e) => e.type === 'answer')).toBe(false);
  });
});

describe('pauza', () => {
  it('zatrzymuje licznik i wznawia go z pozostałym czasem', () => {
    const c = controller(game());
    c.start();
    toFirstQuestion(c);
    advance(5000);
    c.pause();
    expect(c.getView().paused).toBe(true);
    expect(humanTurn(c.getView())).toBeNull();

    advance(60000);
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(3);

    c.start();
    expect(c.getView().deadline).toBe(Date.now() + DEFAULT_RULES.answerTimeMs - 5000);
    advance(DEFAULT_RULES.answerTimeMs - 5000 - 1);
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(3);
    advance(1);
    expect(getPlayer(c.getView().game, HUMAN_ID).lives).toBe(2);
  });

  it('wielokrotne start/pause (React StrictMode) nie psuje gry', () => {
    const c = controller(game());
    c.start();
    c.pause();
    c.start();
    c.start();
    toFirstQuestion(c);
    expect(humanTurn(c.getView())).toBe('answer');
  });
});

describe('wskazywanie', () => {
  function humanPicking() {
    const c = controller(game());
    c.start();
    toFirstQuestion(c);
    c.submitAnswer(correctAnswer(c.getView()));
    // Etap II: gramy, aż przyjdzie kolej człowieka na wskazanie.
    for (let i = 0; i < 2000 && humanTurn(c.getView()) !== 'pick'; i++) {
      if (humanTurn(c.getView()) === 'answer') c.submitAnswer(correctAnswer(c.getView()));
      else tick(c, 250);
    }
    expect(humanTurn(c.getView())).toBe('pick');
    return c;
  }

  it('ignoruje wskazanie siebie i gracza, który odpadł', () => {
    const c = humanPicking();
    const before = c.getView().game;
    c.pick(HUMAN_ID);
    c.pick('nieznany');
    expect(c.getView().game).toBe(before);
  });

  it('po wskazaniu pokazuje wybór i pytanie trafia do wskazanego', () => {
    const c = humanPicking();
    const target = c.getView().game.players.find((p) => !p.isHuman && !p.eliminated)!.id;
    c.pick(target);
    expect(c.getView().overlay).toEqual({ kind: 'pick', chooserId: HUMAN_ID, targetId: target });
    advance(PACING.announceMs);
    // Po wskazaniu nie ma już zapowiedzi — wskazanie samo mówi, kto odpowiada.
    expect(c.getView().overlay).toBeNull();
    expect(c.getView().thinkingId).toBe(target);
  });
});

describe('finał', () => {
  function finalGame(): GameState {
    // Etap II rozgrywamy samym silnikiem: odpadają b1 i b3.
    return driveToFinal(game(), ['b1', 'b3']);
  }

  it('bot zgłasza się, gdy człowiek nie zdąży', () => {
    const c = controller(finalGame(), { eagerness: 1, knowledge: 5 });
    c.start();
    dismissBanner(c);
    expect(humanTurn(c.getView())).toBe('buzz');
    expect(c.getView().timerMs).toBe(DEFAULT_RULES.buzzWindowMs);

    advance(1000);
    const overlay = c.getView().overlay;
    expect(overlay?.kind).toBe('buzz');
    expect(['b2', 'b4']).toContain((overlay as { playerId: string }).playerId);
  });

  it('szybszy człowiek przejmuje pytanie', () => {
    const c = controller(finalGame(), { eagerness: 1 });
    c.start();
    dismissBanner(c);
    advance(500);
    c.buzz();
    expect(c.getView().overlay).toEqual({ kind: 'buzz', playerId: HUMAN_ID });
    advance(PACING.announceMs);
    expect(humanTurn(c.getView())).toBe('answer');
    // Spóźnione zgłoszenie bota nie może już nic zmienić.
    advance(1000);
    expect(humanTurn(c.getView())).toBe('answer');
  });

  it('gdy nikt się nie zgłosi, pytanie przepada po upływie okna', () => {
    const c = controller(finalGame(), { eagerness: 0, recklessness: 0 });
    c.start();
    dismissBanner(c);
    advance(DEFAULT_RULES.buzzWindowMs);
    expect(c.getView().overlay?.kind).toBe('noBuzz');
    expect(c.getView().game.events.filter((e) => e.type === 'noBuzz')).toHaveLength(1);
    // Zużyte: pytanie, które przepadło, i od razu wylosowane następne.
    expect(c.getView().game.finalQuestionsLeft).toBe(DEFAULT_RULES.finalQuestionPool - 2);
  });

  it('gracz, który zawsze wie i bierze pytania na siebie, zdobywa całą pulę', () => {
    const c = controller(finalGame());
    c.start();
    const end = playOut(c, (ctrl, view) => {
      const turn = humanTurn(view);
      if (turn === 'buzz') ctrl.buzz();
      if (turn === 'answer') ctrl.submitAnswer(correctAnswer(view));
      if (turn === 'pick') ctrl.pick(HUMAN_ID);
    });
    expect(getPlayer(end.game, HUMAN_ID).score).toBe(DEFAULT_RULES.finalQuestionPool * DEFAULT_RULES.pointsPerCorrect);
    expect(end.game.ranking![0]).toBe(HUMAN_ID);
  });
});

describe('cała gra', () => {
  it('kończy się dla gracza odpowiadającego zawsze dobrze', () => {
    const c = controller(game(5, 3));
    c.start();
    const end = playOut(c, (ctrl, view) => {
      const turn = humanTurn(view);
      if (turn === 'answer') ctrl.submitAnswer(correctAnswer(view));
      if (turn === 'buzz') ctrl.buzz();
      if (turn === 'pick') {
        const target = view.game.players.find((p) => !p.eliminated && !p.isHuman)!;
        ctrl.pick(target.id);
      }
    });
    expect(getPlayer(end.game, HUMAN_ID).finalist).toBe(true);
    expect(getPlayer(end.game, HUMAN_ID).lives).toBe(3);
  });

  it('po odpadnięciu człowieka można przewinąć grę do końca', () => {
    const c = controller(game(7, 1));
    c.start();
    for (let i = 0; i < 20000 && !getPlayer(c.getView().game, HUMAN_ID).eliminated; i++) {
      const view = c.getView();
      const turn = humanTurn(view);
      if (turn === 'answer') c.submitAnswer('zupelnie zle');
      else if (turn === 'buzz') c.buzz();
      else if (turn === 'pick') c.pick(view.game.players.find((p) => !p.eliminated && !p.isHuman)!.id);
      else tick(c, 250);
    }
    expect(getPlayer(c.getView().game, HUMAN_ID).eliminated).toBe(true);

    c.fastForward();
    const view = c.getView();
    expect(view.game.phase).toBe('finished');
    expect(view.overlay).toBeNull();
    expect(view.game.ranking).toHaveLength(5);
    // Po przewinięciu nie zostają żadne liczniki.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('nie da się przewinąć gry, w której człowiek wciąż gra', () => {
    const c = controller(game());
    c.start();
    dismissBanner(c);
    const before = c.getView().game;
    c.fastForward();
    expect(c.getView().game).toBe(before);
  });
});
