import { QUESTION_BANK } from '../questions';
import { DEFAULT_RULES, DIFFICULTIES } from '../rules';
import { createRng } from '../rng';
import { simulateGame } from '../simulate';
import { createSoloGame, HUMAN_ID } from '../solo';
import type { Difficulty, GameState } from '../types';

const GAMES = 300;

function play(difficulty: Difficulty, seed: number): GameState {
  const rng = createRng(seed);
  const game = createSoloGame({ difficulty, humanName: 'Ty', questions: QUESTION_BANK, rng });
  return simulateGame(game, { rng, bank: QUESTION_BANK });
}

const results = Object.fromEntries(
  DIFFICULTIES.map((d) => [d, Array.from({ length: GAMES }, (_, i) => play(d, 1000 + i))]),
) as Record<Difficulty, GameState[]>;

describe.each(DIFFICULTIES)('symulacja pełnych gier (%s)', (difficulty) => {
  const games = results[difficulty];

  it('każda gra kończy się z kompletnym rankingiem', () => {
    for (const s of games) {
      expect(s.phase).toBe('finished');
      expect(s.pending).toEqual({ kind: 'none' });
      expect(new Set(s.ranking)).toEqual(new Set(s.players.map((p) => p.id)));
    }
  });

  it('do finału wchodzi dokładnie trzech graczy, a zwycięzca jest finalistą', () => {
    for (const s of games) {
      expect(s.players.filter((p) => p.finalist)).toHaveLength(3);
      expect(s.players.find((p) => p.id === s.ranking![0])!.finalist).toBe(true);
    }
  });

  it('nikt nie przekracza limitów szans i pytań', () => {
    for (const s of games) {
      for (const p of s.players) {
        expect(p.lives).toBeGreaterThanOrEqual(0);
        expect(p.lives).toBeLessThanOrEqual(DEFAULT_RULES.lives);
        expect(p.score % DEFAULT_RULES.pointsPerCorrect).toBe(0);
        if (!p.finalist) expect(p.score).toBe(0);
      }
      const finalStart = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'final');
      const finalQuestions = s.events.slice(finalStart).filter((e) => e.type === 'question').length;
      expect(finalQuestions).toBeLessThanOrEqual(DEFAULT_RULES.finalQuestionPool);
    }
  });

  it('w etapie I każdy dostaje dokładnie jedno pytanie', () => {
    for (const s of games) {
      const stage2Start = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'stage2');
      const asked = s.events
        .slice(0, stage2Start)
        .flatMap((e) => (e.type === 'question' && e.playerId !== null ? [e.playerId] : []));
      expect(asked).toEqual(s.players.map((p) => p.id));
    }
  });

  it('w etapie II bot wskazuje człowieka, gdy ten czekał już 4 pytania', () => {
    for (const s of games) {
      const stage2Start = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'stage2');
      const finalStart = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'final');
      let waiting = 0;
      let humanOut = false;
      for (const e of s.events.slice(stage2Start, finalStart)) {
        if (e.type === 'eliminated' && e.playerId === HUMAN_ID) humanOut = true;
        if (e.type === 'question' && e.playerId !== null) waiting = e.playerId === HUMAN_ID ? 0 : waiting + 1;
        if (e.type === 'pick' && !humanOut && e.chooserId !== HUMAN_ID && waiting >= DEFAULT_RULES.maxQuestionsWithoutHuman) {
          expect(e.targetId).toBe(HUMAN_ID);
        }
      }
    }
  });

  it('w etapie II nikt nie wskazuje siebie', () => {
    for (const s of games) {
      const stage2Start = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'stage2');
      const finalStart = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'final');
      for (const e of s.events.slice(stage2Start, finalStart)) {
        if (e.type === 'pick') expect(e.targetId).not.toBe(e.chooserId);
      }
    }
  });
});

describe('balans poziomów trudności', () => {
  const winRate = (d: Difficulty) => results[d].filter((s) => s.ranking![0] === HUMAN_ID).length / GAMES;

  it('przeciętny gracz wygrywa tym rzadziej, im wyższy poziom', () => {
    expect(winRate('easy')).toBeGreaterThan(winRate('normal'));
    expect(winRate('normal')).toBeGreaterThan(winRate('expert'));
  });

  it('łatwy poziom daje wyraźnie więcej niż 1/5 szans, ekspert wyraźnie mniej', () => {
    expect(winRate('easy')).toBeGreaterThan(0.3);
    expect(winRate('expert')).toBeLessThan(0.15);
  });
});
