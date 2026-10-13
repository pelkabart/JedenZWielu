import { computeRanking, createGame, GameRuleError, getPlayer, pickTargets, reduce } from '../engine';
import { DEFAULT_RULES } from '../rules';
import { createRng } from '../rng';
import type { GameState } from '../types';
import {
  answerRight,
  answerWrong,
  currentAnswerer,
  driveToFinal,
  lives,
  newGame,
  passStage1,
  PLAYER_IDS,
  TEST_BANK,
} from '../testing/fixtures';

describe('createGame', () => {
  it('daje każdemu 3 szanse i zaczyna od pierwszego gracza', () => {
    const s = newGame();
    expect(s.phase).toBe('stage1');
    expect(Object.values(lives(s))).toEqual([3, 3, 3, 3, 3]);
    expect(currentAnswerer(s)).toBe('p0');
  });

  it('odrzuca za małą liczbę graczy i powtórzone id', () => {
    const base = { difficulty: 'normal' as const, questions: TEST_BANK, rng: createRng(1) };
    const p = (id: string) => ({ id, name: id, isHuman: true });
    expect(() => createGame({ ...base, players: [p('a'), p('b'), p('c')] })).toThrow(GameRuleError);
    expect(() => createGame({ ...base, players: [p('a'), p('a'), p('b'), p('c')] })).toThrow(GameRuleError);
  });

  it('jest powtarzalna dla tego samego ziarna', () => {
    expect(newGame(42)).toEqual(newGame(42));
  });
});

describe('reduce', () => {
  it('nie modyfikuje poprzedniego stanu', () => {
    const s = newGame();
    const snapshot = JSON.parse(JSON.stringify(s));
    answerWrong(s);
    expect(s).toEqual(snapshot);
  });

  it('odrzuca odpowiedź gracza, który nie jest pytany', () => {
    const s = newGame();
    expect(() => reduce(s, { type: 'answer', playerId: 'p1', text: 'x' })).toThrow(GameRuleError);
  });

  it('odrzuca akcje niepasujące do etapu', () => {
    const s = newGame();
    expect(() => reduce(s, { type: 'buzz', playerId: 'p0' })).toThrow(GameRuleError);
    expect(() => reduce(s, { type: 'noBuzz' })).toThrow(GameRuleError);
    expect(() => reduce(s, { type: 'pick', chooserId: 'p0', targetId: 'p1' })).toThrow(GameRuleError);
  });
});

describe('etap I', () => {
  it('każdy gracz dostaje dokładnie jedno pytanie, po kolei', () => {
    let s = newGame();
    const asked: string[] = [];
    while (s.phase === 'stage1') {
      asked.push(currentAnswerer(s));
      s = asked.length % 2 === 0 ? answerWrong(s) : answerRight(s);
    }
    expect(asked).toEqual(PLAYER_IDS);
    expect(lives(s)).toEqual({ p0: 3, p1: 2, p2: 3, p3: 2, p4: 3 });
    expect(s.phase).toBe('stage2');
  });

  it('brak odpowiedzi w czasie kosztuje szansę', () => {
    const s = reduce(newGame(), { type: 'answer', playerId: 'p0', text: null });
    expect(lives(s).p0).toBe(2);
  });

  it('nie zadaje dwa razy tego samego pytania, dopóki talia się nie skończy', () => {
    const s = passStage1(newGame());
    const ids = s.events.flatMap((e) => (e.type === 'question' ? [e.questionId] : []));
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('etap II', () => {
  function stage2(seed = 1): GameState {
    return passStage1(newGame(seed));
  }

  it('zaczyna od losowo wybranego miejsca', () => {
    const s = stage2(7);
    expect(currentAnswerer(s)).toBe(PLAYER_IDS[s.stage2StarterSeat]);
  });

  it('po dobrej odpowiedzi odpowiadający wskazuje kolejnego gracza', () => {
    const answerer = currentAnswerer(stage2());
    const s = answerRight(stage2());
    expect(s.pending).toEqual({ kind: 'pick', chooserId: answerer, allowSelf: false });

    const target = PLAYER_IDS.find((id) => id !== answerer)!;
    const next = reduce(s, { type: 'pick', chooserId: answerer, targetId: target });
    expect(next.pending).toMatchObject({ kind: 'answer', playerId: target, reason: 'picked', pickedBy: answerer });
  });

  it('nie pozwala wskazać siebie, kogoś odpadłego ani wskazywać za kogoś innego', () => {
    const s = answerRight(stage2());
    const chooser = (s.pending as { chooserId: string }).chooserId;
    const other = PLAYER_IDS.find((id) => id !== chooser)!;
    expect(() => reduce(s, { type: 'pick', chooserId: chooser, targetId: chooser })).toThrow(GameRuleError);
    expect(() => reduce(s, { type: 'pick', chooserId: other, targetId: chooser })).toThrow(GameRuleError);

    const withEliminated: GameState = {
      ...s,
      players: s.players.map((p) => (p.id === other ? { ...p, lives: 0, eliminated: true } : p)),
    };
    expect(() => reduce(withEliminated, { type: 'pick', chooserId: chooser, targetId: other })).toThrow(GameRuleError);
  });

  it('gdy wskazany się pomyli, wskazujący wybiera ponownie', () => {
    let s = answerRight(stage2());
    const chooser = (s.pending as { chooserId: string }).chooserId;
    const target = PLAYER_IDS.find((id) => id !== chooser)!;
    s = reduce(s, { type: 'pick', chooserId: chooser, targetId: target });
    s = answerWrong(s);
    expect(lives(s)[target]).toBe(2);
    expect(s.pending).toEqual({ kind: 'pick', chooserId: chooser, allowSelf: false });
  });

  it('gdy pomyli się gracz pytany z kolei, pytanie przechodzi na następne miejsce', () => {
    let s = stage2();
    const first = currentAnswerer(s);
    s = answerWrong(s);
    const expected = PLAYER_IDS[(PLAYER_IDS.indexOf(first) + 1) % PLAYER_IDS.length];
    expect(s.pending).toMatchObject({ kind: 'answer', playerId: expected, reason: 'turn' });
  });

  it('po trzeciej złej odpowiedzi gracz odpada i jest pomijany w kolejce', () => {
    let s = stage2();
    const victim = currentAnswerer(s);
    // Ofiara pomyli się 3 razy: najpierw z kolei, potem wskazywana przez kolejnego gracza.
    s = answerWrong(s);
    const chooser = currentAnswerer(s);
    s = answerRight(s);
    for (let i = 0; i < 2; i++) {
      s = reduce(s, { type: 'pick', chooserId: chooser, targetId: victim });
      s = answerWrong(s);
    }
    const player = s.players.find((p) => p.id === victim)!;
    expect(player).toMatchObject({ lives: 0, eliminated: true, eliminatedOrder: 1 });
    expect(s.events).toContainEqual({ type: 'eliminated', playerId: victim });
    expect(s.pending).toEqual({ kind: 'pick', chooserId: chooser, allowSelf: false });
  });

  it('kończy się, gdy zostaje trzech graczy', () => {
    const s = driveToFinal(newGame(), ['p1', 'p3']);
    expect(s.phase).toBe('final');
    expect(s.players.filter((p) => p.eliminated).map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    expect(s.players.filter((p) => p.finalist).map((p) => p.id)).toEqual(['p0', 'p2', 'p4']);
  });
});

describe('etap II – limit pytań bez człowieka', () => {
  /** Człowiek h + 4 boty; wszyscy odpowiadają dobrze, a boty wolą wskazywać siebie nawzajem. */
  function botsAvoidHuman(rules?: Parameters<typeof createGame>[0]['rules']) {
    let s = createGame({
      players: [
        { id: 'h', name: 'Ty', isHuman: true },
        ...['b1', 'b2', 'b3', 'b4'].map((id) => ({ id, name: id, isHuman: false, botId: 'ola' })),
      ],
      difficulty: 'normal',
      questions: TEST_BANK,
      rng: createRng(3),
      rules,
    });
    s = passStage1(s);
    const askedInStage2: string[] = [];
    for (let i = 0; i < 60; i++) {
      const pending = s.pending;
      if (pending.kind === 'answer') {
        askedInStage2.push(pending.playerId);
        s = answerRight(s);
      } else if (pending.kind === 'pick') {
        const allowed = pickTargets(s, pending.chooserId).map((p) => p.id);
        s = reduce(s, { type: 'pick', chooserId: pending.chooserId, targetId: allowed.find((id) => id !== 'h') ?? allowed[0] });
      }
    }
    return { s, askedInStage2 };
  }

  function longestRunWithout(ids: string[], who: string) {
    let run = 0;
    let longest = 0;
    for (const id of ids) {
      run = id === who ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    return longest;
  }

  it('po 4 pytaniach do innych bot musi wskazać człowieka', () => {
    const { askedInStage2 } = botsAvoidHuman();
    expect(longestRunWithout(askedInStage2, 'h')).toBe(4);
    expect(askedInStage2.filter((id) => id === 'h').length).toBeGreaterThan(5);
  });

  it('wskazanie kogoś innego, gdy człowiek czeka za długo, jest odrzucane', () => {
    let s = passStage1(
      createGame({
        players: [
          { id: 'h', name: 'Ty', isHuman: true },
          ...['b1', 'b2', 'b3', 'b4'].map((id) => ({ id, name: id, isHuman: false, botId: 'ola' })),
        ],
        difficulty: 'normal',
        questions: TEST_BANK,
        rng: createRng(3),
      }),
    );
    for (let i = 0; i < 40; i++) {
      if (s.pending.kind === 'answer') s = answerRight(s);
      else if (s.pending.kind === 'pick') {
        const { chooserId } = s.pending;
        if (getPlayer(s, 'h').questionsWithoutTurn >= DEFAULT_RULES.maxQuestionsWithoutHuman && chooserId !== 'h') {
          expect(pickTargets(s, chooserId).map((p) => p.id)).toEqual(['h']);
          const other = s.players.find((p) => p.id !== 'h' && p.id !== chooserId)!.id;
          expect(() => reduce(s, { type: 'pick', chooserId, targetId: other })).toThrow(GameRuleError);
          s = reduce(s, { type: 'pick', chooserId, targetId: 'h' });
          expect(getPlayer(s, 'h').questionsWithoutTurn).toBe(0);
          return;
        }
        const target = pickTargets(s, chooserId).find((p) => p.id !== 'h')!.id;
        s = reduce(s, { type: 'pick', chooserId, targetId: target });
      }
    }
    throw new Error('Limit nie zadziałał w 40 krokach');
  });

  it('nie ogranicza wyboru człowieka', () => {
    const s = answerRight(stage2Human());
    // Wszyscy gracze w newGame są ludźmi — reguła dotyczy tylko botów.
    expect(pickTargets(s, (s.pending as { chooserId: string }).chooserId)).toHaveLength(4);

    function stage2Human() {
      return passStage1(newGame(1));
    }
  });

  it('można ją wyłączyć w zasadach', () => {
    const { askedInStage2 } = botsAvoidHuman({ maxQuestionsWithoutHuman: 0 });
    expect(longestRunWithout(askedInStage2, 'h')).toBeGreaterThan(4);
  });
});

describe('finał', () => {
  function final(seed = 1, rules?: Parameters<typeof newGame>[1]): GameState {
    return driveToFinal(newGame(seed, rules), ['p1', 'p3']);
  }

  it('finaliści zaczynają z pełnymi szansami i zerem punktów', () => {
    const s = final();
    for (const id of ['p0', 'p2', 'p4']) {
      expect(s.players.find((p) => p.id === id)).toMatchObject({ lives: 3, score: 0 });
    }
    expect(s.pending.kind).toBe('buzz');
    expect(s.finalQuestionsLeft).toBe(49);
  });

  it('nie pozwala zgłosić się graczowi, który odpadł', () => {
    expect(() => reduce(final(), { type: 'buzz', playerId: 'p1' })).toThrow(GameRuleError);
  });

  it('dobra odpowiedź po zgłoszeniu daje punkty i prawo wyboru (także siebie)', () => {
    let s = reduce(final(), { type: 'buzz', playerId: 'p2' });
    expect(s.pending).toMatchObject({ kind: 'answer', playerId: 'p2', reason: 'buzz' });
    s = answerRight(s);
    expect(s.players.find((p) => p.id === 'p2')!.score).toBe(10);
    expect(s.pending).toEqual({ kind: 'pick', chooserId: 'p2', allowSelf: true });

    s = reduce(s, { type: 'pick', chooserId: 'p2', targetId: 'p2' });
    expect(s.pending).toMatchObject({ kind: 'answer', playerId: 'p2', reason: 'self' });
    s = answerRight(s);
    expect(s.players.find((p) => p.id === 'p2')!.score).toBe(20);
  });

  it('zła odpowiedź zabiera szansę i wraca pytanie na zgłoszenia', () => {
    let s = reduce(final(), { type: 'buzz', playerId: 'p0' });
    s = answerWrong(s);
    expect(lives(s).p0).toBe(2);
    expect(s.players.find((p) => p.id === 'p0')!.score).toBe(0);
    expect(s.pending.kind).toBe('buzz');
  });

  it('pytanie bez zgłoszeń przepada i zużywa pulę', () => {
    const s = reduce(final(), { type: 'noBuzz' });
    expect(s.finalQuestionsLeft).toBe(48);
    expect(s.pending.kind).toBe('buzz');
  });

  it('kończy się po wyczerpaniu puli pytań', () => {
    let s = final(1, { finalQuestionPool: 2 });
    s = reduce(s, { type: 'buzz', playerId: 'p4' });
    s = answerRight(s);
    s = reduce(s, { type: 'pick', chooserId: 'p4', targetId: 'p0' });
    s = answerRight(s);
    // Pula wyczerpana — nie ma już wyboru kolejnego pytania.
    expect(s.phase).toBe('finished');
    expect(s.pending).toEqual({ kind: 'none' });
    // p0 i p4 mają po 10 pkt i 3 szanse — remis rozstrzyga kolejność miejsc.
    expect(s.ranking!.slice(0, 3)).toEqual(['p0', 'p4', 'p2']);
  });

  it('ostatni finalista gra sam, aż straci wszystkie szanse', () => {
    let s = final();
    // p0 i p2 tracą wszystkie szanse po zgłoszeniach.
    for (const id of ['p0', 'p0', 'p0', 'p2', 'p2', 'p2']) {
      s = reduce(s, { type: 'buzz', playerId: id });
      s = answerWrong(s);
    }
    expect(s.pending).toMatchObject({ kind: 'answer', playerId: 'p4', reason: 'solo' });

    s = answerRight(s);
    s = answerRight(s);
    expect(s.pending).toMatchObject({ kind: 'answer', playerId: 'p4', reason: 'solo' });
    for (let i = 0; i < 3; i++) s = answerWrong(s);

    expect(s.phase).toBe('finished');
    expect(s.players.find((p) => p.id === 'p4')).toMatchObject({ score: 20, lives: 0 });
    const nonFinalists = s.players
      .filter((p) => !p.finalist)
      .sort((a, b) => b.eliminatedOrder! - a.eliminatedOrder!)
      .map((p) => p.id);
    expect(s.ranking).toEqual(['p4', 'p2', 'p0', ...nonFinalists]);
    expect(s.events.at(-1)).toEqual({ type: 'gameOver', ranking: s.ranking });
  });

  it('nigdy nie zadaje więcej pytań niż wynosi pula', () => {
    let s = final(3, { finalQuestionPool: 5 });
    while (s.phase !== 'finished') {
      s = s.pending.kind === 'buzz' ? reduce(s, { type: 'buzz', playerId: 'p0' }) : s;
      if (s.pending.kind === 'answer') s = answerRight(s);
      if (s.pending.kind === 'pick') s = reduce(s, { type: 'pick', chooserId: s.pending.chooserId, targetId: 'p0' });
    }
    const finalStart = s.events.findIndex((e) => e.type === 'phase' && e.phase === 'final');
    const finalQuestions = s.events.slice(finalStart).filter((e) => e.type === 'question');
    expect(finalQuestions).toHaveLength(5);
    expect(s.players.find((p) => p.id === 'p0')!.score).toBe(50);
  });
});

describe('computeRanking', () => {
  it('układa finalistów wg punktów, potem szans; resztę wg kolejności odpadania', () => {
    const base = { name: '', isHuman: true, correct: 0, wrong: 0, questionsWithoutTurn: 0 };
    const ranking = computeRanking([
      { ...base, id: 'a', seat: 0, lives: 0, score: 0, eliminated: true, eliminatedOrder: 1, finalist: false },
      { ...base, id: 'b', seat: 1, lives: 2, score: 30, eliminated: false, eliminatedOrder: null, finalist: true },
      { ...base, id: 'c', seat: 2, lives: 0, score: 30, eliminated: true, eliminatedOrder: 3, finalist: true },
      { ...base, id: 'd', seat: 3, lives: 0, score: 0, eliminated: true, eliminatedOrder: 2, finalist: false },
      { ...base, id: 'e', seat: 4, lives: 0, score: 40, eliminated: true, eliminatedOrder: 4, finalist: true },
    ]);
    expect(ranking).toEqual(['e', 'b', 'c', 'd', 'a']);
  });
});
