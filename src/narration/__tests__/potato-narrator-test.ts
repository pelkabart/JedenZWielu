import { PotatoController, type PotatoView } from '@/game/potato/controller/PotatoController';
import { createPotatoGame, reducePotato, type PotatoState } from '@/game/potato/engine';
import type { Question } from '@/game/types';
import { PotatoNarrator, narrationFor } from '@/narration/PotatoNarrator';
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
  { id: 'b2', name: 'Bot 2', isHuman: false, botId: 'bartek' },
  { id: 'b3', name: 'Bot 3', isHuman: false, botId: 'profesor' },
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
    ...patch,
  };
}

describe('co mówi prowadzący', () => {
  it('na turze gracza czyta, kto odpowiada, i pytanie', () => {
    expect(narrationFor(view({}))).toEqual(['Odpowiadasz Ty!', 'pytanie a']);
    expect(narrationFor(view({ game: started('b2') }))).toEqual(['Odpowiada: Bot 2.', 'pytanie a']);
  });

  it('po wyniku mówi o poprawności i poprawnej odpowiedzi', () => {
    expect(narrationFor(view({ overlay: { kind: 'reveal', playerId: 'h', text: OK, correct: true, correctAnswer: 'odp a' } }))).toEqual([
      'Brawo, dobrze!',
    ]);
    expect(narrationFor(view({ overlay: { kind: 'reveal', playerId: 'h', text: 'x', correct: false, correctAnswer: 'odp a' } }))).toEqual([
      'Niestety.',
      'Poprawna odpowiedź: odp a.',
    ]);
  });

  it('przy zmianie rundy czyta tytuł i zasady', () => {
    expect(narrationFor(view({ overlay: { kind: 'round', phase: 'sprint' } }))[0]).toBe('Runda 3 · Sprint');
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
