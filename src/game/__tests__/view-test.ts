import { narratedQuestion, visibleQuestion, type SoloView } from '../controller/SoloController';
import { hostLine, hostSpeech } from '../controller/hostLine';
import { QUESTION_BANK } from '../questions';
import { createRng } from '../rng';
import { createSoloGame, HUMAN_ID } from '../solo';
import type { GameState } from '../types';

function solo(seed: number): GameState {
  return createSoloGame({ difficulty: 'normal', humanName: 'Ty', questions: QUESTION_BANK, rng: createRng(seed) });
}

function view(game: GameState, patch: Partial<SoloView> = {}): SoloView {
  return { game, overlay: null, deadline: null, timerMs: null, thinkingId: null, paused: false, ...patch };
}

describe('createSoloGame', () => {
  it('ma 5 graczy, w tym jednego człowieka o imieniu Ty', () => {
    const game = solo(1);
    expect(game.players).toHaveLength(5);
    expect(game.players.filter((p) => p.isHuman)).toEqual([expect.objectContaining({ id: HUMAN_ID, name: 'Ty' })]);
  });

  it('sadza człowieka na różnych miejscach', () => {
    const seats = new Set(Array.from({ length: 50 }, (_, seed) => solo(seed).players.findIndex((p) => p.isHuman)));
    expect(seats.size).toBe(5);
  });
});

describe('visibleQuestion', () => {
  it('po odpowiedzi pokazuje pytanie, na które odpowiadano, a nie następne', () => {
    const game = solo(1);
    if (game.pending.kind !== 'answer') throw new Error('Oczekiwano pytania');
    const answered = game.pending.question;
    const next = { ...answered, id: 'inne' };
    const v = view(
      { ...game, pending: { ...game.pending, question: next } },
      {
        overlay: {
          kind: 'reveal',
          playerId: game.pending.playerId,
          question: answered,
          text: 'x',
          correct: false,
          correctAnswer: answered.answers[0],
          eliminated: false,
        },
      },
    );
    expect(visibleQuestion(v)).toBe(answered);
  });

  it('ukrywa pytanie na planszy etapu i podczas wskazywania', () => {
    const game = solo(1);
    expect(visibleQuestion(view(game, { overlay: { kind: 'banner', phase: 'stage1' } }))).toBeNull();
    expect(visibleQuestion(view(game, { overlay: { kind: 'pick', chooserId: 'a', targetId: 'b' } }))).toBeNull();
  });

  it('ukrywa pytanie podczas zapowiedzi, kto odpowiada', () => {
    const game = solo(1);
    expect(visibleQuestion(view(game, { overlay: { kind: 'intro', playerId: HUMAN_ID } }))).toBeNull();
  });

  it('pokazuje pytanie, które czyta lektor', () => {
    const game = solo(1);
    const q = QUESTION_BANK[5];
    const reading = view(game, { overlay: { kind: 'reading', question: q } });
    expect(visibleQuestion(reading)).toBe(q);
    expect(narratedQuestion(reading)).toBe(q);
  });

  it('lektor milczy poza nakładką czytania', () => {
    const game = solo(1);
    expect(narratedQuestion(view(game))).toBeNull();
    expect(narratedQuestion(view(game, { overlay: { kind: 'intro', playerId: HUMAN_ID } }))).toBeNull();
  });
});

describe('hostLine', () => {
  const game = solo(3);
  const bot = game.players.find((p) => !p.isHuman)!;
  const q = QUESTION_BANK[0];

  it('zwraca się do człowieka w drugiej osobie', () => {
    const humanTurn: GameState = { ...game, pending: { kind: 'answer', playerId: HUMAN_ID, question: q, reason: 'turn', pickedBy: null } };
    expect(hostLine(view(humanTurn))).toBe('Twoja kolej! Wpisz odpowiedź.');
    expect(hostLine(view(game, { overlay: { kind: 'pick', chooserId: bot.id, targetId: HUMAN_ID } }))).toBe(`${bot.name} wskazuje Ciebie!`);
  });

  it('zapowiada, kto odpowiada', () => {
    expect(hostLine(view(game, { overlay: { kind: 'intro', playerId: HUMAN_ID } }))).toBe('Odpowiadasz Ty!');
    expect(hostLine(view(game, { overlay: { kind: 'intro', playerId: bot.id } }))).toBe(`Odpowiada: ${bot.name}`);
  });

  it('po złej odpowiedzi podaje poprawną', () => {
    const line = hostLine(
      view(game, {
        overlay: { kind: 'reveal', playerId: bot.id, question: q, text: 'zle', correct: false, correctAnswer: q.answers[0], eliminated: false },
      }),
    );
    expect(line).toContain(q.answers[0]);
  });

  it('informuje o odpadnięciu i o braku odpowiedzi w czasie', () => {
    const out = hostLine(
      view(game, {
        overlay: { kind: 'reveal', playerId: bot.id, question: q, text: 'zle', correct: false, correctAnswer: 'X', eliminated: true },
      }),
    );
    expect(out).toContain(`${bot.name} odpada`);
    const timeout = hostLine(
      view(game, { overlay: { kind: 'reveal', playerId: bot.id, question: q, text: null, correct: false, correctAnswer: 'X', eliminated: false } }),
    );
    expect(timeout).toContain('Czas minął');
  });

  it('w czasie czytania mówi, do kogo jest pytanie, a nie „wpisz odpowiedź”', () => {
    const reading = { overlay: { kind: 'reading', question: q } } as const;
    const toHuman: GameState = { ...game, pending: { kind: 'answer', playerId: HUMAN_ID, question: q, reason: 'turn', pickedBy: null } };
    const toBot: GameState = { ...game, pending: { kind: 'answer', playerId: bot.id, question: q, reason: 'picked', pickedBy: HUMAN_ID } };
    const toAll: GameState = { ...game, pending: { kind: 'buzz', question: q } };
    expect(hostLine(view(toHuman, reading))).toBe('Pytanie dla Ciebie.');
    expect(hostLine(view(toBot, reading))).toBe(`${bot.name}, Twoje pytanie.`);
    expect(hostLine(view(toAll, reading))).toBe('Pytanie do wszystkich.');
  });

  it('po przeczytaniu pytania kwestia przy odpowiedzi bota się nie zmienia (prowadzący się nie powtarza)', () => {
    const toBot: GameState = { ...game, pending: { kind: 'answer', playerId: bot.id, question: q, reason: 'turn', pickedBy: null } };
    expect(hostLine(view(toBot))).toBe(hostLine(view(toBot, { overlay: { kind: 'reading', question: q } })));
  });
});

describe('hostSpeech', () => {
  const game = solo(3);
  const bot = game.players.find((p) => !p.isHuman)!;
  const q = QUESTION_BANK[0];

  it('hostLine to zdania z hostSpeech połączone spacją', () => {
    const overlays: SoloView['overlay'][] = [
      null,
      { kind: 'banner', phase: 'stage2' },
      { kind: 'reveal', playerId: bot.id, question: q, text: 'zle', correct: false, correctAnswer: 'X', eliminated: true },
      { kind: 'noBuzz', question: q, correctAnswer: 'X' },
      { kind: 'pick', chooserId: bot.id, targetId: HUMAN_ID },
    ];
    for (const overlay of overlays) {
      const v = view(game, { overlay });
      expect(hostLine(v)).toBe(hostSpeech(v).join(' '));
    }
  });

  it('kwestie z poprawną odpowiedzią dzielą się na zdanie o graczu i zdanie z odpowiedzią', () => {
    const out = hostSpeech(
      view(game, { overlay: { kind: 'reveal', playerId: bot.id, question: q, text: 'zle', correct: false, correctAnswer: 'Ottawa', eliminated: true } }),
    );
    expect(out).toEqual([`Niestety, ${bot.name} odpada.`, 'Poprawna odpowiedź: Ottawa.']);
    expect(hostSpeech(view(game, { overlay: { kind: 'noBuzz', question: q, correctAnswer: 'Ottawa' } }))).toEqual([
      'Nikt się nie zgłosił.',
      'Poprawna odpowiedź: Ottawa.',
    ]);
  });

  it('zapowiedzi etapów nie mają cyfr rzymskich', () => {
    for (const phase of ['stage1', 'stage2', 'final'] as const) {
      const [line] = hostSpeech(view(game, { overlay: { kind: 'banner', phase } }));
      expect(line).not.toMatch(/(^|\s)[IVX]+([\s.!]|$)/);
    }
  });
});
