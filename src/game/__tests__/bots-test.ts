import { isCorrectAnswer } from '../answers';
import { correctChance, decideAnswer, wrongAnswer, type BotContext } from '../bots/brain';
import { BOT_PROFILES, getBotProfile, pickOpponents, type BotProfile } from '../bots/profiles';
import { QUESTION_BANK } from '../questions';
import { createRng } from '../rng';
import type { Difficulty, Question, Rules } from '../types';
import { TEST_BANK } from '../testing/fixtures';

const RULES: Rules = { answerTimeMs: 12000 };

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

describe('profile botów', () => {
  it('mają unikalne id i sensowne parametry', () => {
    expect(new Set(BOT_PROFILES.map((p) => p.id)).size).toBe(BOT_PROFILES.length);
    for (const p of BOT_PROFILES) {
      expect(p.knowledge).toBeGreaterThan(0);
      expect(p.knowledge).toBeLessThan(1);
    }
  });

  it('losuje różnych przeciwników', () => {
    const opponents = pickOpponents(createRng(5), 4);
    expect(new Set(opponents.map((p) => p.id)).size).toBe(4);
  });
});

describe('pickOpponents ze skórkami', () => {
  const skinsOf = (profiles: BotProfile[]) => new Set(profiles.map((p) => p.skinId));

  it('bot bez istniejącej skórki nigdy nie jest losowany', () => {
    const owned = BOT_PROFILES.slice(0, 6);
    const allowed = skinsOf(owned);
    for (let seed = 0; seed < 1000; seed++) {
      const opponents = pickOpponents(createRng(seed), 4, allowed);
      expect(opponents).toHaveLength(4);
      expect(new Set(opponents.map((p) => p.id)).size).toBe(4);
      expect(opponents.every((p) => allowed.has(p.skinId))).toBe(true);
    }
  });

  it('z czasem losuje każdego bota, który ma skórkę', () => {
    const owned = BOT_PROFILES.slice(0, 6);
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      pickOpponents(createRng(seed), 4, skinsOf(owned)).forEach((p) => seen.add(p.id));
    }
    expect(seen.size).toBe(owned.length);
  });

  it('gdy wszystkie skórki istnieją, skład jest taki sam jak bez filtra', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(pickOpponents(createRng(seed), 4, skinsOf(BOT_PROFILES))).toEqual(pickOpponents(createRng(seed), 4));
    }
  });

  it('zużywa tyle samo losowań, więc dalszy przebieg gry się nie zmienia', () => {
    const plain = createRng(5);
    const filtered = createRng(5);
    pickOpponents(plain, 4);
    pickOpponents(filtered, 4, skinsOf(BOT_PROFILES.slice(0, 4)));
    expect(filtered()).toBe(plain());
  });

  it('za mało skórek: skład i tak jest pełny, najpierw boty ze skórką', () => {
    const [owner] = BOT_PROFILES;
    const opponents = pickOpponents(createRng(1), 4, skinsOf([owner]));
    expect(opponents).toHaveLength(4);
    expect(new Set(opponents.map((p) => p.id)).size).toBe(4);
    expect(opponents[0].id).toBe(owner.id);
  });

  it('każdy bot ma własne imię i własną skórkę z puli botów', () => {
    expect(new Set(BOT_PROFILES.map((p) => p.name)).size).toBe(BOT_PROFILES.length);
    expect(new Set(BOT_PROFILES.map((p) => p.skinId)).size).toBe(BOT_PROFILES.length);
    const outsidePools = BOT_PROFILES.filter((p) => !/^(male|female)\/[^/]+$/.test(p.skinId)).map((p) => p.id);
    expect(outsidePools).toEqual([]);
  });
});

describe('correctChance', () => {
  const bot = getBotProfile('tadeusz');

  it('rośnie z poziomem trudności gry', () => {
    const easy = correctChance(bot, question, 'easy');
    const normal = correctChance(bot, question, 'normal');
    const expert = correctChance(bot, question, 'expert');
    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThan(expert);
  });

  it('średnio boty trafiają ok. 37% (łatwy), 50% (normalny) i 65% (ekspert) pytań z banku', () => {
    const average = (d: Difficulty) => {
      let sum = 0;
      for (const p of BOT_PROFILES) for (const q of QUESTION_BANK) sum += correctChance(p, q, d);
      return sum / (BOT_PROFILES.length * QUESTION_BANK.length);
    };
    expect(Math.abs(average('easy') - 0.375)).toBeLessThan(0.05);
    expect(Math.abs(average('normal') - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(average('expert') - 0.65)).toBeLessThan(0.05);
  });

  it('uwzględnia mocne i słabe kategorie', () => {
    expect(correctChance(bot, question, 'normal')).toBeGreaterThan(
      correctChance(bot, { ...question, category: 'Sport' }, 'normal'),
    );
  });

  it('spada dla trudniejszych pytań i mieści się w granicach', () => {
    const easyQ = correctChance(bot, { ...question, difficulty: 1 }, 'normal');
    const hardQ = correctChance(bot, { ...question, difficulty: 3 }, 'normal');
    expect(easyQ).toBeGreaterThan(hardQ);
    const genius = { ...bot, knowledge: 5 };
    const hopeless = { ...bot, knowledge: -5 };
    expect(correctChance(genius, question, 'expert')).toBeLessThan(1);
    expect(correctChance(hopeless, question, 'easy')).toBeGreaterThan(0);
  });
});

describe('decideAnswer', () => {
  it('jest powtarzalna dla tego samego ziarna', () => {
    const profile = getBotProfile('ola');
    expect(decideAnswer(ctx(profile, 'normal', 9), question, RULES)).toEqual(
      decideAnswer(ctx(profile, 'normal', 9), question, RULES),
    );
  });

  it('ekspert odpowiada poprawnie częściej niż bot na łatwym poziomie', () => {
    const profile = getBotProfile('marek');
    const accuracy = (difficulty: Difficulty) => {
      const c = ctx(profile, difficulty, 123);
      let correct = 0;
      for (let i = 0; i < 2000; i++) {
        if (isCorrectAnswer(decideAnswer(c, question, RULES).text, question.answers)) correct++;
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
      const forcedWrong = decideAnswer(c, TEST_BANK[0], RULES, false);
      expect(isCorrectAnswer(forcedWrong.text, TEST_BANK[0].answers)).toBe(false);
      if (forcedWrong.text === null) {
        expect(forcedWrong.delayMs).toBe(RULES.answerTimeMs);
      } else {
        expect(forcedWrong.delayMs).toBeLessThan(RULES.answerTimeMs);
      }
      const forcedRight = decideAnswer(c, TEST_BANK[0], RULES, true);
      expect(isCorrectAnswer(forcedRight.text, TEST_BANK[0].answers)).toBe(true);
      expect(forcedRight.delayMs).toBeLessThan(RULES.answerTimeMs);
    }
  });

  it('pomyłki (bez własnych w pytaniu) pochodzą z pytań tego samego typu i kategorii', () => {
    const c = ctx(getBotProfile('ola'), 'normal', 4);
    const sameCategory = TEST_BANK.filter((q) => q.category === TEST_BANK[0].category && q.id !== TEST_BANK[0].id).map(
      (q) => q.answers[0],
    );
    for (let i = 0; i < 200; i++) {
      const { text } = decideAnswer(c, TEST_BANK[0], RULES, false);
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
