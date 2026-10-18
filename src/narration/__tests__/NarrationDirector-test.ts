import type { SoloView } from '@/game/controller/SoloController';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame } from '@/game/solo';
import type { Question } from '@/game/types';
import { getLogEntries, resetLog } from '@/lib/log';

import { NarrationDirector, type ViewSource } from '../NarrationDirector';
import { AudioCatalog } from '../questionAudio';
import { FakeNarrationPlayer } from '../testing/FakeNarrationPlayer';

const [q1, q2, q3] = QUESTION_BANK;
/** q3 celowo bez nagrania. */
const catalog = new AudioCatalog(
  {
    questions: {
      [q1.id]: { text: q1.question, durationMs: 2000 },
      [q2.id]: { text: q2.question, durationMs: 3000 },
    },
  },
  { [q1.id]: 11, [q2.id]: 22 },
);

/** Udaje sterownik: trzyma widok i powiadamia o zmianach. */
class FakeViews implements ViewSource {
  view: SoloView;
  private readonly listeners = new Set<() => void>();

  constructor() {
    const game = createSoloGame({ difficulty: 'normal', humanName: 'Ty', questions: QUESTION_BANK, rng: createRng(1) });
    this.view = { game, overlay: null, deadline: null, timerMs: null, thinkingId: null, paused: false };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = () => this.view;

  set(patch: Partial<SoloView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }

  read(question: Question) {
    this.set({ overlay: { kind: 'reading', question } });
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

function setup() {
  const views = new FakeViews();
  const player = new FakeNarrationPlayer();
  const director = new NarrationDirector(views, player, catalog);
  return { views, player, director };
}

beforeEach(() => resetLog());

describe('NarrationDirector', () => {
  it('nic nie gra poza czytaniem pytania', () => {
    const { views, player } = setup();
    views.set({ overlay: { kind: 'intro', playerId: 'human' } });
    views.set({ overlay: null, deadline: 123, timerMs: 15000 });
    expect(player.calls).toEqual([]);
  });

  it('gra nagranie pytania z nakładki czytania i zapisuje to w logach', () => {
    const { views, player } = setup();
    views.read(q1);
    expect(player.calls).toEqual([expect.objectContaining({ action: 'play', source: 11 })]);
    expect(getLogEntries({ tag: 'lektor' })).toContainEqual(
      expect.objectContaining({ level: 'info', message: 'Lektor czyta pytanie', data: { questionId: q1.id, durationMs: 2000 } }),
    );
  });

  it('inne zmiany widoku w czasie czytania nie wołają odtwarzacza ponownie', () => {
    const { views, player } = setup();
    views.read(q1);
    views.set({ thinkingId: 'b1' });
    views.set({ deadline: null });
    expect(player.actions()).toEqual(['play']);
  });

  it('koniec czytania zatrzymuje dźwięk (także gdy gracz pominął czytanie)', () => {
    const { views, player } = setup();
    views.read(q1);
    views.set({ overlay: null, deadline: 1000, timerMs: 15000 });
    expect(player.actions()).toEqual(['play', 'stop']);
    expect(player.state).toBe('idle');
  });

  it('pauza wstrzymuje, wznowienie gra dalej (bez wczytywania od nowa)', () => {
    const { views, player } = setup();
    views.read(q1);
    views.set({ paused: true });
    expect(player.state).toBe('paused');
    views.set({ paused: false });
    expect(player.actions()).toEqual(['play', 'pause', 'resume']);
    expect(player.state).toBe('playing');
  });

  it('czytanie zaczęte w czasie pauzy rusza dopiero po wznowieniu', () => {
    const { views, player } = setup();
    views.set({ paused: true, overlay: { kind: 'reading', question: q1 } });
    expect(player.calls).toEqual([]);
    views.set({ paused: false });
    expect(player.actions()).toEqual(['play']);
  });

  it('kolejne pytanie: stary dźwięk cichnie, nowy rusza od początku', () => {
    const { views, player } = setup();
    views.read(q1);
    views.read(q2);
    expect(player.calls.map((c) => (c.action === 'play' ? `play:${c.source}` : c.action))).toEqual(['play:11', 'stop', 'play:22']);
  });

  it('pytanie bez nagrania jest pomijane po cichu', () => {
    const { views, player } = setup();
    views.read(q3);
    views.set({ overlay: null });
    expect(player.calls).toEqual([]);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it('błąd odtwarzacza nie przerywa gry i trafia do logów', () => {
    const { views, player } = setup();
    player.failOn = 'play';
    expect(() => views.read(q1)).not.toThrow();
    expect(getLogEntries({ tag: 'lektor', minLevel: 'error' })).toEqual([
      expect.objectContaining({ message: 'Błąd odtwarzacza', data: expect.objectContaining({ action: 'play', questionId: q1.id }) }),
    ]);
    // Dalsza gra działa: koniec czytania i następne pytanie.
    player.failOn = null;
    views.read(q2);
    expect(player.actions()).toEqual(['play', 'stop', 'play']);
  });

  it('dispose zatrzymuje dźwięk, zwalnia odtwarzacz i przestaje słuchać', () => {
    const { views, player, director } = setup();
    views.read(q1);
    director.dispose();
    expect(player.actions()).toEqual(['play', 'stop', 'dispose']);
    expect(views.listenerCount).toBe(0);
    // FakeNarrationPlayer rzuca przy użyciu po zwolnieniu — tu nic nie może go wywołać.
    expect(() => views.read(q2)).not.toThrow();
    expect(player.actions()).toEqual(['play', 'stop', 'dispose']);
  });

  it('czyta od razu, jeśli w chwili utworzenia trwa już czytanie', () => {
    const views = new FakeViews();
    views.view = { ...views.view, overlay: { kind: 'reading', question: q2 } };
    const player = new FakeNarrationPlayer();
    new NarrationDirector(views, player, catalog);
    expect(player.calls).toEqual([expect.objectContaining({ action: 'play', source: 22 })]);
  });
});
