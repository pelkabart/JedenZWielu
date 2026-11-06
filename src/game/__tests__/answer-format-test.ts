import { isCorrectAnswer, normalizeAnswer } from '../answers';
import { buildChoices, CHOICE_COUNT } from '../choices';
import { BOT_PROFILES } from '../bots/profiles';
import { decideAnswer, DECISION_TIME, type BotContext } from '../bots/brain';
import { createRng, gaussian } from '../rng';
import { QUESTION_BANK } from '../questions';
import { DIFFICULTY_PRESETS } from '../rules';
import type { Difficulty, Rules } from '../types';

const RULES: Rules = { answerTimeMs: 12000 };

describe('opcje ABCD', () => {
  it('każde pytanie w bazie dostaje 4 różne opcje, w tym poprawną odpowiedź', () => {
    for (const question of QUESTION_BANK) {
      const options = buildChoices(question, QUESTION_BANK);
      const keys = options.map(normalizeAnswer);
      expect({ id: question.id, count: options.length }).toEqual({ id: question.id, count: CHOICE_COUNT });
      expect(new Set(keys).size).toBe(CHOICE_COUNT);
      expect(options.some((o) => isCorrectAnswer(o, question.answers))).toBe(true);
    }
  });

  it('pomyłki nie są zgodne z poprawną odpowiedzią (także po normalizacji)', () => {
    for (const question of QUESTION_BANK) {
      const wrong = buildChoices(question, QUESTION_BANK).filter((o) => !isCorrectAnswer(o, question.answers));
      expect(wrong.length).toBe(CHOICE_COUNT - 1);
    }
  });

  it('te same pytanie dają te same opcje, niezależnie od kolejności wywołań', () => {
    const question = QUESTION_BANK[0];
    const first = buildChoices(question, QUESTION_BANK);
    buildChoices(QUESTION_BANK[1], QUESTION_BANK);
    expect(buildChoices(question, QUESTION_BANK)).toEqual(first);
  });

  it('bez puli pytań liczby dopełniają opcje liczbami obok poprawnej', () => {
    const question = { ...QUESTION_BANK.find((q) => q.answerType === 'data')! };
    delete question.wrongAnswers;
    const options = buildChoices(question, [question]);
    expect(options.length).toBe(CHOICE_COUNT);
    expect(options).toContain(question.answers[0]);
  });
});

describe('format odpowiedzi na poziomach', () => {
  it('Łatwy i Normalny używają ABCD, Ekspert pisemnie', () => {
    expect(DIFFICULTY_PRESETS.easy.answerFormat).toBe('choice');
    expect(DIFFICULTY_PRESETS.normal.answerFormat).toBe('choice');
    expect(DIFFICULTY_PRESETS.expert.answerFormat).toBe('text');
  });

  it('skuteczność i tempo botów na poziomach', () => {
    expect(DIFFICULTY_PRESETS.easy).toMatchObject({ knowledgeOffset: -0.25, speedFactor: 1.5, answerTimeMs: 7000 });
    expect(DIFFICULTY_PRESETS.normal).toMatchObject({ knowledgeOffset: -0.12, speedFactor: 1.3, answerTimeMs: 5000 });
    expect(DIFFICULTY_PRESETS.expert).toMatchObject({ knowledgeOffset: 0.03, speedFactor: 1, answerTimeMs: 10000 });
  });
});

describe('czas decyzji botów', () => {
  const difficulties: Difficulty[] = ['easy', 'normal', 'expert'];

  for (const difficulty of difficulties) {
    it(`na poziomie ${difficulty} mieści się w przedziale dla swojego formatu`, () => {
      const preset = DIFFICULTY_PRESETS[difficulty];
      const { min, max } = DECISION_TIME[preset.answerFormat];
      const rng = createRng(7);
      for (let i = 0; i < 300; i++) {
        const ctx: BotContext = { profile: BOT_PROFILES[i % BOT_PROFILES.length], difficulty, rng, bank: QUESTION_BANK };
        const { text, delayMs } = decideAnswer(ctx, QUESTION_BANK[i % QUESTION_BANK.length], RULES);
        // Brak odpowiedzi (bot nie zdążył) kończy się pełnym czasem; reszta mieści się w rozkładzie.
        if (text === null) {
          expect(delayMs).toBe(RULES.answerTimeMs);
          continue;
        }
        expect(delayMs).toBeGreaterThanOrEqual(Math.round(min * preset.speedFactor) - 1);
        expect(delayMs).toBeLessThanOrEqual(Math.min(RULES.answerTimeMs - 300, Math.round(max * preset.speedFactor)));
      }
    });
  }

  it('rozkład Gaussa ma średnią bliską wartości z PDF (ABCD ok. 1,5 s)', () => {
    const rng = createRng(11);
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += gaussian(rng, DECISION_TIME.choice.mean, DECISION_TIME.choice.sd);
    expect(Math.abs(sum / n - DECISION_TIME.choice.mean)).toBeLessThan(40);
    expect(DECISION_TIME.choice.mean).toBe(1500);
    expect(DECISION_TIME.text.mean).toBe(3500);
  });
});
