import { DEFAULT_POTATO_PACING, PotatoController, type PotatoView } from '@/game/potato/controller/PotatoController';
import { createPotatoGame, reducePotato, type PotatoState } from '@/game/potato/engine';
import type { Question } from '@/game/types';
import { getLogEntries, resetLog } from '@/lib/log';
import { PotatoNarrator, SPRINT_SPEECH_SPEED, narrationFor, speechSpeedFor } from '@/narration/PotatoNarrator';
import { FakeVoice } from '@/narration/testing/FakeVoice';
import { createRng } from '@/game/rng';

const OK = 'ok';

function question(id: string): Question {
  return { id, category: 'Historia', question: `pytanie ${id}`, answers: [`odp ${id}`], answerType: 'nazwa', difficulty: 1 };
}

const DECK = ['a', 'b', 'c', 'd', 'e'].map(question);
const PLAYERS = [
  { id: 'h', name: 'Ty', isHuman: true },
  { id: 'b1', name: 'Bot 1', isHuman: false, botId: 'krysia' },
  { id: 'b2', name: 'Bot 2', isHuman: false, botId: 'marek' },
  { id: 'b3', name: 'Bot 3', isHuman: false, botId: 'tadeusz' },
  { id: 'b4', name: 'Bot 4', isHuman: false, botId: 'wiesiek' },
];

function started(holderId = 'h'): PotatoState {
  return reducePotato(createPotatoGame({ players: PLAYERS, deck: DECK }), { type: 'start', holderId });
}

function fakeClock() {
  let now = 0;
  let nextId = 1;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  return {
    clock: {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.push({ id, at: now + ms, fn });
        return id;
      },
      clearTimeout: (id: unknown) => {
        timers = timers.filter((t) => t.id !== id);
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        now = due.at;
        due.fn();
      }
      now = end;
    },
  };
}

/** Obietnica lektora kończy się asynchronicznie; czekamy, aż zdarzenia się wykonają. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function view(patch: Partial<PotatoView>): PotatoView {
  return {
    game: started(),
    overlay: null,
    deadline: null,
    timerMs: null,
    thinkingId: null,
    awaitingPick: null,
    choices: null,
    sprintEndsAt: null,
    paused: false,
    speaking: false,
    ...patch,
  };
}

beforeEach(() => resetLog());

describe('co mówi prowadzący', () => {
  it('na turze gracza czyta, kto odpowiada, i pytanie', () => {
    expect(narrationFor(view({}))).toEqual(['Odpowiadasz Ty!', 'pytanie a']);
    expect(narrationFor(view({ game: started('b2') }))).toEqual(['Odpowiada: Bot 2.', 'pytanie a']);
  });

  it('po wyniku mówi o poprawności i poprawnej odpowiedzi', () => {
    expect(narrationFor(view({ overlay: { kind: 'reveal', playerId: 'b1', question: DECK[0], text: OK, correct: true, correctAnswer: 'odp a' } }))).toEqual([
      'Brawo, dobrze!',
    ]);
    expect(narrationFor(view({ overlay: { kind: 'reveal', playerId: 'h', question: DECK[0], text: OK, correct: true, correctAnswer: 'odp a' } }))).toEqual(['Brawo, dobrze!']);
    expect(narrationFor(view({ overlay: { kind: 'reveal', playerId: 'h', question: DECK[0], text: 'x', correct: false, correctAnswer: 'odp a' } }))).toEqual([
      'Niestety.',
      'Poprawna odpowiedź: odp a.',
    ]);
  });

  it('przy wskazywaniu tylko pyta o gracza: pochwała padła już przy wyniku', () => {
    expect(narrationFor(view({ awaitingPick: { chooserId: 'h', allowSelf: false } }))).toEqual(['Komu przekazujesz pytanie?']);
    // Zamiana szans na punkty po sprincie to sama animacja: lektor milczy.
    expect(narrationFor(view({ overlay: { kind: 'lifeBonus' } }))).toEqual([]);
  });

  it('gdy gracz odpada przed rozstrzygnięciem, nikt nie jest ogłaszany zwycięzcą', () => {
    const base = started();
    const game = reducePotato({ ...base, players: base.players.map((p) => (p.id === 'h' ? { ...p, eliminated: true, eliminatedAt: 1 } : p)) }, { type: 'endEarly' });
    expect(narrationFor(view({ game, overlay: { kind: 'finished' } }))).toEqual(['Odpadasz!', 'Koniec gry.']);
  });

  it('po rozstrzygniętej grze ogłasza zwycięzcę, także gdy gracz przegrał finał', () => {
    const base = started();
    const others = base.players.map((p) => (p.id === 'b1' ? p : { ...p, eliminated: true, eliminatedAt: 1 }));
    const game = { ...base, phase: 'finished' as const, holderId: null, question: null, players: others, ranking: ['b1', 'h', 'b2', 'b3', 'b4'] };
    expect(narrationFor(view({ game, overlay: { kind: 'finished' } }))).toEqual(['Koniec gry!', 'Wygrywa Bot 1.']);
  });

  it('plansza rundy: tylko tytuł, bez zasad (zasady są napisane na planszy)', () => {
    expect(narrationFor(view({ overlay: { kind: 'round', phase: 'sprint' } }))).toEqual(['Runda 3 · Sprint']);
    expect(narrationFor(view({ overlay: { kind: 'round', phase: 'round2' } }))).toEqual(['Runda 2 · Bomba']);
  });

  it('przed startem gry (ekran ładowania) lektor milczy', () => {
    expect(narrationFor(view({ game: createPotatoGame({ players: PLAYERS, deck: DECK }) }))).toEqual([]);
  });
});

describe('tempo lektora', () => {
  const inPhase = (phase: PotatoState['phase']) => ({ ...started(), phase });

  it('w sprincie czyta szybciej', () => {
    expect(speechSpeedFor(view({ game: inPhase('sprint') }))).toBe(SPRINT_SPEECH_SPEED);
    expect(SPRINT_SPEECH_SPEED).toBeGreaterThan(1);
  });

  it('zasady sprintu na planszy czyta normalnie', () => {
    expect(speechSpeedFor(view({ game: inPhase('sprint'), overlay: { kind: 'round', phase: 'sprint' } }))).toBe(1);
  });

  it.each(['round1', 'round2', 'duel'] as const)('w %s czyta normalnie', (phase) => {
    expect(speechSpeedFor(view({ game: inPhase(phase) }))).toBe(1);
  });

  it('tempo trafia do syntezy', () => {
    const timers = fakeClock();
    const game = { ...started(), phase: 'sprint' as const };
    const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    expect(voice.lastSpeed()).toBe(SPRINT_SPEECH_SPEED);
    narrator.dispose();
  });
});

describe('lektor z kontrolerem', () => {
  it('licznik czeka, aż lektor skończy czytać pytanie', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    expect(controller.getView().deadline).toBeNull();
    timers.advance(60_000);
    expect(controller.getView().overlay).toBeNull();
    voice.finish();
    await flush();
    expect(controller.getView().deadline).not.toBeNull();
    narrator.dispose();
  });

  it('odbicie w ciemno: gdy lektor czyta pytanie rywala, nie widać paska gracza', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    voice.finish();
    await flush();
    expect(controller.getView().deadline).not.toBeNull();
    timers.advance(1000);

    controller.blindPass('b1');
    expect(voice.texts).toEqual(['Odpowiada: Bot 1.', 'pytanie b']);
    expect(controller.getView().deadline).toBeNull();

    timers.advance(2000);
    voice.finish();
    await flush();
    expect(controller.getView().deadline).toBe(3000 + 5000);
    expect(controller.getView().timerMs).toBe(5000);
    narrator.dispose();
  });

  it('po poprawnej odpowiedzi najpierw pochwała, potem wskazanie, bez powtórki', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    voice.finish();
    await flush();

    const before = voice.utterances().length;
    controller.submitAnswer('odp a');
    expect(controller.getView().overlay).toMatchObject({ kind: 'reveal', correct: true });
    expect(voice.utterances().at(-1)).toEqual(['Brawo, dobrze!']);
    voice.finish();
    await flush();

    timers.advance(DEFAULT_POTATO_PACING.revealMs);
    expect(voice.utterances().at(-1)).toEqual(['Komu przekazujesz pytanie?']);
    voice.finish();
    await flush();

    controller.pick('b1');
    // Po wskazaniu od razu nowe pytanie: bez drugiej pochwały i bez powtórki.
    expect(voice.utterances().slice(before)).toEqual([['Brawo, dobrze!'], ['Komu przekazujesz pytanie?'], ['Odpowiada: Bot 1.', 'pytanie b']]);
    narrator.dispose();
  });

  it('wskazanie w trakcie pytania o gracza przerywa lektora i gra nie czeka', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    voice.finish();
    await flush();

    controller.submitAnswer('odp a');
    voice.finish();
    await flush();
    timers.advance(DEFAULT_POTATO_PACING.revealMs);
    expect(voice.state).toBe('speaking');
    controller.pick('b1');
    expect(voice.actions().slice(-2)).toEqual(['stop', 'say']);
    expect(voice.utterances().at(-1)).toEqual(['Odpowiada: Bot 1.', 'pytanie b']);
    narrator.dispose();
  });

  it('nowa gra zaczyna od planszy, bez czytania pytania', () => {
    const timers = fakeClock();
    const game = createPotatoGame({ players: PLAYERS, deck: DECK });
    const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    expect(voice.actions()).toEqual(['say']);
    expect(voice.utterances()[0][0]).toBe('Runda 1 · Odsiew');
    narrator.dispose();
  });

  it('pominięcie planszy przerywa lektora i czyta pytanie; koniec starej kwestii nie zwalnia licznika', async () => {
    const timers = fakeClock();
    const game = createPotatoGame({ players: PLAYERS, deck: DECK });
    const controller = new PotatoController({ game, difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();

    controller.acceptRound();
    expect(voice.actions()).toEqual(['say', 'stop', 'say']);
    expect(voice.utterances().at(-1)).toEqual(['Odpowiadasz Ty!', 'pytanie a']);
    await flush();
    expect(controller.getView().speaking).toBe(true);
    expect(controller.getView().deadline).toBeNull();

    voice.finish();
    await flush();
    expect(controller.getView().deadline).not.toBeNull();
    narrator.dispose();
  });

  it('silence ucisza lektora i zwalnia licznik; bez mowy nic nie robi', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    expect(controller.getView().deadline).toBeNull();

    narrator.silence();
    expect(voice.actions()).toEqual(['say', 'stop']);
    await flush();
    expect(controller.getView().speaking).toBe(false);
    expect(controller.getView().deadline).not.toBeNull();

    narrator.silence();
    expect(voice.actions()).toEqual(['say', 'stop']);
    narrator.dispose();
  });

  it('pauza wstrzymuje głos, a wznowienie gry go wznawia', () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    controller.pause();
    expect(voice.state).toBe('paused');
    controller.unpause();
    expect(voice.state).toBe('speaking');
    narrator.dispose();
  });

  it('nowa kwestia przerywa poprzednią, a spóźniony koniec starej nie zgłasza końca nowej', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    controller.blindPass('b1');
    expect(voice.actions()).toEqual(['say', 'stop', 'say']);
    await flush();
    // Stara wypowiedź skończyła się przez `stop`, ale nowa dalej trwa.
    expect(controller.getView().speaking).toBe(true);
    expect(controller.getView().deadline).toBeNull();
    narrator.dispose();
  });

  it('błąd przy pauzie nie przerywa gry i trafia do logów', () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    voice.failOn = 'pause';
    expect(() => controller.pause()).not.toThrow();
    expect(getLogEntries({ tag: 'lektor', minLevel: 'error' })).toHaveLength(1);
    voice.failOn = null;
    narrator.dispose();
  });

  it('dispose zatrzymuje głos, zgłasza ciszę i przestaje słuchać', () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    narrator.dispose();
    expect(voice.actions().slice(-2)).toEqual(['stop', 'dispose']);
    expect(controller.getView().speaking).toBe(false);
    // Zwolniony lektor rzuciłby wyjątkiem przy kolejnej wypowiedzi.
    expect(() => controller.blindPass('b1')).not.toThrow();
  });

  it('błąd syntezy nie blokuje gry', async () => {
    const timers = fakeClock();
    const controller = new PotatoController({ game: started(), difficulty: 'normal', rng: createRng(4), clock: timers.clock });
    const voice = new FakeVoice(null);
    voice.failOn = 'say';
    const narrator = new PotatoNarrator(controller, voice);
    controller.start();
    await flush();
    expect(controller.getView().deadline).not.toBeNull();
    narrator.dispose();
  });
});
