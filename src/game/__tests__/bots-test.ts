import { isCorrectAnswer } from '../answers';
import { correctChance, decideAnswer, decideBuzz, decideTarget, wrongAnswer, type BotContext } from '../bots/brain';
import { BOT_PROFILES, getBotProfile, pickOpponents, type BotProfile } from '../bots/profiles';
import { QUESTION_BANK } from '../questions';
import { DEFAULT_RULES } from '../rules';
import { createRng } from '../rng';
import type { Difficulty, GameState, Question } from '../types';
import { newGame, TEST_BANK } from '../testing/fixtures';

const question: Question = {
  id: 'q',
  category: 'Historia',
  question: 'W którym roku odbyła się bitwa pod Grunwaldem?',
  answers: ['1410'],
  answerType: 'data',
  difficulty: 2,
};

function ctx(profile: BotProfile, difficulty: Difficulty = 'normal', seed = 1): BotContext {
  return { profile, difficulty, rng: createRng(seed), bank: TEST_BANK };
}

function withPersonality(personality: BotProfile['personality']): BotProfile {
  return { ...getBotProfile('profesor'), personality };
}

/** Stan, w którym `chooserId` wskazuje, a gracze mają zadane szanse. */
function pickState(chooserId: string, livesById: Record<string, number>, allowSelf = false): GameState {
  const s = newGame();
  return {
    ...s,
    phase: allowSelf ? 'final' : 'stage2',
    pending: { kind: 'pick', chooserId, allowSelf },
    players: s.players.map((p) => {
      const lives = livesById[p.id] ?? 3;
      return { ...p, lives, eliminated: lives === 0 };
    }),
  };
}

describe('profile botów', () => {
  it('mają unikalne id i sensowne parametry', () => {
    expect(new Set(BOT_PROFILES.map((p) => p.id)).size).toBe(BOT_PROFILES.length);
    for (const p of BOT_PROFILES) {
      expect(p.knowledge).toBeGreaterThan(0);
      expect(p.knowledge).toBeLessThan(1);
      expect(p.answerTimeMs[0]).toBeLessThanOrEqual(p.answerTimeMs[1]);
      expect(p.buzzTimeMs[0]).toBeLessThanOrEqual(p.buzzTimeMs[1]);
    }
  });

  it('każda osobowość występuje w puli', () => {
    const personalities = new Set(BOT_PROFILES.map((p) => p.personality));
    expect([...personalities].sort()).toEqual(['avenger', 'chaotic', 'predator', 'tactician']);
  });

  it('losuje różnych przeciwników', () => {
    const opponents = pickOpponents(createRng(5), 4);
    expect(new Set(opponents.map((p) => p.id)).size).toBe(4);
  });
});

describe('correctChance', () => {
  const profesor = getBotProfile('profesor');

  it('rośnie z poziomem trudności gry', () => {
    const easy = correctChance(profesor, question, 'easy');
    const normal = correctChance(profesor, question, 'normal');
    const expert = correctChance(profesor, question, 'expert');
    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThan(expert);
  });

  it('uwzględnia mocne i słabe kategorie', () => {
    expect(correctChance(profesor, question, 'normal')).toBeGreaterThan(
      correctChance(profesor, { ...question, category: 'Sport' }, 'normal'),
    );
  });

  it('spada dla trudniejszych pytań i mieści się w granicach', () => {
    const easyQ = correctChance(profesor, { ...question, difficulty: 1 }, 'normal');
    const hardQ = correctChance(profesor, { ...question, difficulty: 3 }, 'normal');
    expect(easyQ).toBeGreaterThan(hardQ);
    const genius = { ...profesor, knowledge: 5 };
    const hopeless = { ...profesor, knowledge: -5 };
    expect(correctChance(genius, question, 'expert')).toBeLessThan(1);
    expect(correctChance(hopeless, question, 'easy')).toBeGreaterThan(0);
  });
});

describe('decideAnswer', () => {
  it('jest powtarzalna dla tego samego ziarna', () => {
    const profile = getBotProfile('ola');
    expect(decideAnswer(ctx(profile, 'normal', 9), question, DEFAULT_RULES)).toEqual(
      decideAnswer(ctx(profile, 'normal', 9), question, DEFAULT_RULES),
    );
  });

  it('ekspert odpowiada poprawnie częściej niż bot na łatwym poziomie', () => {
    const profile = getBotProfile('marek');
    const accuracy = (difficulty: Difficulty) => {
      const c = ctx(profile, difficulty, 123);
      let correct = 0;
      for (let i = 0; i < 2000; i++) {
        if (isCorrectAnswer(decideAnswer(c, question, DEFAULT_RULES).text, question.answers)) correct++;
      }
      return correct / 2000;
    };
    const expected = (d: Difficulty) => correctChance(profile, question, d);
    expect(accuracy('easy')).toBeCloseTo(expected('easy'), 1);
    expect(accuracy('expert')).toBeCloseTo(expected('expert'), 1);
    expect(accuracy('expert')).toBeGreaterThan(accuracy('easy') + 0.2);
  });

  it('pomyłki nigdy nie są przypadkiem poprawne, a odpowiedzi mieszczą się w czasie', () => {
    const c = ctx(getBotProfile('wiesiek'), 'easy', 77);
    for (let i = 0; i < 500; i++) {
      const forcedWrong = decideAnswer(c, TEST_BANK[0], DEFAULT_RULES, false);
      expect(isCorrectAnswer(forcedWrong.text, TEST_BANK[0].answers)).toBe(false);
      if (forcedWrong.text === null) {
        expect(forcedWrong.delayMs).toBe(DEFAULT_RULES.answerTimeMs);
      } else {
        expect(forcedWrong.delayMs).toBeLessThan(DEFAULT_RULES.answerTimeMs);
      }
      const forcedRight = decideAnswer(c, TEST_BANK[0], DEFAULT_RULES, true);
      expect(isCorrectAnswer(forcedRight.text, TEST_BANK[0].answers)).toBe(true);
      expect(forcedRight.delayMs).toBeLessThan(DEFAULT_RULES.answerTimeMs);
    }
  });

  it('pomyłki (bez własnych w pytaniu) pochodzą z pytań tego samego typu i kategorii', () => {
    const c = ctx(getBotProfile('ola'), 'normal', 4);
    const sameCategory = TEST_BANK.filter((q) => q.category === TEST_BANK[0].category && q.id !== TEST_BANK[0].id).map(
      (q) => q.answers[0],
    );
    for (let i = 0; i < 200; i++) {
      const { text } = decideAnswer(c, TEST_BANK[0], DEFAULT_RULES, false);
      if (text !== null) expect(sameCategory).toContain(text);
    }
  });
});

describe('wrongAnswer – pomyłki tego samego rodzaju', () => {
  const bankCtx = (seed: number): BotContext => ({ profile: getBotProfile('ola'), difficulty: 'normal', rng: createRng(seed), bank: QUESTION_BANK });
  const byId = (id: string) => QUESTION_BANK.find((q) => q.id === id)!;

  it('na pytanie o datę podaje inny rok, blisko poprawnego', () => {
    const grunwald = byId('his-001');
    for (let seed = 0; seed < 200; seed++) {
      const wrong = wrongAnswer(bankCtx(seed), grunwald)!;
      expect(wrong).toMatch(/^\d+$/);
      expect(wrong).not.toBe('1410');
      expect(Math.abs(Number(wrong) - 1410)).toBeLessThanOrEqual(40);
    }
  });

  it('na pytanie o liczbę podaje inną dodatnią liczbę', () => {
    for (const q of QUESTION_BANK.filter((q) => q.answerType === 'liczba')) {
      for (let seed = 0; seed < 50; seed++) {
        const wrong = wrongAnswer(bankCtx(seed), q)!;
        expect(wrong).toMatch(/^\d+$/);
        expect(isCorrectAnswer(wrong, q.answers)).toBe(false);
      }
    }
  });

  it('na pytanie o osobę, miejsce lub nazwę nigdy nie podaje liczby ani innego rodzaju odpowiedzi', () => {
    for (const q of QUESTION_BANK.filter((q) => q.answerType !== 'data' && q.answerType !== 'liczba')) {
      const allowed = new Set([
        ...(q.wrongAnswers ?? []),
        ...QUESTION_BANK.filter((other) => other.answerType === q.answerType).map((other) => other.answers[0]),
      ]);
      for (let seed = 0; seed < 30; seed++) {
        const wrong = wrongAnswer(bankCtx(seed), q);
        expect(wrong).not.toBeNull();
        expect(allowed).toContain(wrong);
        expect(wrong).not.toMatch(/^\d+$/);
        expect(isCorrectAnswer(wrong, q.answers)).toBe(false);
      }
    }
  });

  it('korzysta z własnych pomyłek pytania, jeśli są', () => {
    const king = byId('his-004');
    for (let seed = 0; seed < 50; seed++) {
      expect(king.wrongAnswers).toContain(wrongAnswer(bankCtx(seed), king));
    }
  });

  it('bez własnych pomyłek bierze odpowiedź tego samego typu, najpierw z tej samej kategorii', () => {
    const q: Question = { id: 'x', category: 'Historia', question: 'Kto?', answers: ['Ktoś'], answerType: 'osoba', difficulty: 2 };
    const historyPeople = QUESTION_BANK.filter((o) => o.category === 'Historia' && o.answerType === 'osoba').map((o) => o.answers[0]);
    for (let seed = 0; seed < 50; seed++) {
      expect(historyPeople).toContain(wrongAnswer(bankCtx(seed), q));
    }
  });

  it('gdy nie ma pasującej pomyłki, bot nie odpowiada zamiast podać coś bez sensu', () => {
    const q: Question = { id: 'x', category: 'Sport', question: 'Gdzie?', answers: ['Tam'], answerType: 'miejsce', difficulty: 2 };
    expect(wrongAnswer({ ...bankCtx(1), bank: [] }, q)).toBeNull();
  });
});

describe('decideBuzz', () => {
  it('zgłasza się tylko w oknie czasowym', () => {
    const c = ctx(getBotProfile('bartek'), 'easy', 3);
    for (let i = 0; i < 300; i++) {
      const buzz = decideBuzz(c, question, DEFAULT_RULES);
      if (buzz.delayMs !== null) expect(buzz.delayMs).toBeLessThan(DEFAULT_RULES.buzzWindowMs);
    }
  });

  it('częściej zgłasza się, gdy zna odpowiedź', () => {
    const c = ctx(getBotProfile('zosia'), 'normal', 8);
    let buzzedKnowing = 0;
    let knowing = 0;
    let buzzedNotKnowing = 0;
    let notKnowing = 0;
    for (let i = 0; i < 3000; i++) {
      const buzz = decideBuzz(c, question, DEFAULT_RULES);
      const knows = isCorrectAnswer(buzz.answer.text, question.answers);
      if (knows) {
        knowing++;
        if (buzz.delayMs !== null) buzzedKnowing++;
      } else {
        notKnowing++;
        if (buzz.delayMs !== null) buzzedNotKnowing++;
      }
    }
    expect(buzzedKnowing / knowing).toBeGreaterThan(0.6);
    expect(buzzedNotKnowing / notKnowing).toBeLessThan(0.1);
  });
});

describe('decideTarget', () => {
  it('drapieżnik dobija gracza z najmniejszą liczbą szans', () => {
    const state = pickState('p0', { p1: 3, p2: 1, p3: 2, p4: 3 });
    for (let seed = 0; seed < 20; seed++) {
      expect(decideTarget(ctx(withPersonality('predator'), 'expert', seed), state, 'p0')).toBe('p2');
    }
  });

  it('taktyk wskazuje najgroźniejszego rywala', () => {
    const base = pickState('p0', { p1: 2, p2: 3, p3: 1, p4: 2 });
    const state = { ...base, players: base.players.map((p) => (p.id === 'p4' ? { ...p, correct: 5 } : p)) };
    for (let seed = 0; seed < 20; seed++) {
      expect(decideTarget(ctx(withPersonality('tactician'), 'expert', seed), state, 'p0')).toBe('p4');
    }
  });

  it('mściciel wskazuje tego, kto ostatnio wskazał jego', () => {
    const base = pickState('p0', { p1: 3, p2: 3, p3: 1, p4: 3 });
    const state: GameState = {
      ...base,
      events: [...base.events, { type: 'pick', chooserId: 'p1', targetId: 'p0' }, { type: 'pick', chooserId: 'p4', targetId: 'p0' }],
    };
    for (let seed = 0; seed < 20; seed++) {
      expect(decideTarget(ctx(withPersonality('avenger'), 'expert', seed), state, 'p0')).toBe('p4');
    }
  });

  it('mściciel bez krzywd zachowuje się jak drapieżnik', () => {
    const state = pickState('p0', { p1: 3, p2: 3, p3: 1, p4: 3 });
    expect(decideTarget(ctx(withPersonality('avenger'), 'expert'), state, 'p0')).toBe('p3');
  });

  it('w etapie II nigdy nie wskazuje siebie ani odpadłych', () => {
    const state = pickState('p0', { p1: 0, p2: 2, p3: 3, p4: 1 });
    for (const profile of BOT_PROFILES) {
      for (let seed = 0; seed < 30; seed++) {
        expect(['p2', 'p3', 'p4']).toContain(decideTarget(ctx(profile, 'easy', seed), state, 'p0'));
      }
    }
  });

  it('w finale czasem bierze pytanie na siebie, a pewny siebie bot robi to częściej', () => {
    const state = pickState('p0', { p1: 0, p2: 3, p3: 0, p4: 3 }, true);
    const selfRate = (confidence: number) => {
      const c = ctx({ ...getBotProfile('ola'), confidence }, 'normal', 11);
      let self = 0;
      for (let i = 0; i < 1000; i++) if (decideTarget(c, state, 'p0') === 'p0') self++;
      return self / 1000;
    };
    expect(selfRate(0.2)).toBeGreaterThan(0.1);
    expect(selfRate(0.9)).toBeGreaterThan(selfRate(0.2) + 0.4);
  });

  it('odmawia, gdy to nie jego kolej', () => {
    const state = pickState('p1', {});
    expect(() => decideTarget(ctx(BOT_PROFILES[0]), state, 'p0')).toThrow();
  });
});
