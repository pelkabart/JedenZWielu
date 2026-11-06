import type { Clock } from '@/game/clock';
import { getLogEntries, resetLog } from '@/lib/log';

import { frameKey, LOADING_TIMEOUT_MS, LoadingGate } from '../loadingGate';

/** Udawany zegar: `advance` odpala zaplanowane funkcje po kolei. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  const clock: Clock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout: (id) => {
      timers = timers.filter((t) => t.id !== id);
    },
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const next = timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      timers = timers.filter((t) => t !== next);
      now = next.at;
      next.fn();
    }
    now = until;
  };
  return { clock, advance, pending: () => timers.length };
}

const IMAGES = ['h', 'b1'].flatMap((id) => ['normal', 'smile'].map((f) => frameKey(id, f)));

beforeEach(() => resetLog());

describe('LoadingGate', () => {
  it('gotowa dopiero po wszystkich obrazkach i lektorze; postęp rośnie po kolei', () => {
    const { clock } = fakeClock();
    const gate = new LoadingGate(IMAGES, clock);
    gate.start();
    const ready = jest.fn();
    gate.subscribe(() => {
      if (gate.getState().ready) ready();
    });
    expect(gate.getState()).toEqual({ progress: 0, ready: false });
    gate.imageLoaded(IMAGES[0]);
    expect(gate.getState().progress).toBeCloseTo(1 / 5);
    gate.voiceReady();
    expect(gate.getState().progress).toBeCloseTo(2 / 5);
    IMAGES.slice(1).forEach(gate.imageLoaded);
    expect(gate.getState()).toEqual({ progress: 1, ready: true });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(getLogEntries({ tag: 'ladowanie' }).map((e) => e.message)).toEqual(['Ładowanie gry', 'Gra wczytana']);
  });

  it('ten sam obrazek liczy się raz, obcy wcale', () => {
    const gate = new LoadingGate(IMAGES, fakeClock().clock);
    gate.imageLoaded(IMAGES[0]);
    gate.imageLoaded(IMAGES[0]);
    gate.imageLoaded('obcy:normal');
    expect(gate.getState().progress).toBeCloseTo(1 / 5);
  });

  it('gotowość tylko raz, a getState zwraca ten sam obiekt bez zmian', () => {
    const gate = new LoadingGate([], fakeClock().clock);
    const listener = jest.fn();
    gate.subscribe(listener);
    const before = gate.getState();
    gate.imageLoaded('x:normal');
    expect(gate.getState()).toBe(before);
    gate.voiceReady();
    gate.voiceReady();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(gate.getState().ready).toBe(true);
  });

  it('po czasie granicznym gra rusza mimo braków i zostawia ostrzeżenie', () => {
    const { clock, advance } = fakeClock();
    const gate = new LoadingGate(IMAGES, clock);
    gate.start();
    gate.imageLoaded(IMAGES[0]);
    advance(LOADING_TIMEOUT_MS - 1);
    expect(gate.getState().ready).toBe(false);
    advance(1);
    expect(gate.getState().ready).toBe(true);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([
      expect.objectContaining({ tag: 'ladowanie', data: { missingImages: 3, voice: false } }),
    ]);
    // Spóźnione obrazki nic już nie zmieniają.
    const state = gate.getState();
    IMAGES.forEach(gate.imageLoaded);
    expect(gate.getState()).toBe(state);
  });

  it('stop wstrzymuje czas graniczny, start liczy od nowa', () => {
    const { clock, advance, pending } = fakeClock();
    const gate = new LoadingGate(IMAGES, clock);
    gate.start();
    advance(LOADING_TIMEOUT_MS - 100);
    gate.stop();
    expect(pending()).toBe(0);
    advance(60_000);
    expect(gate.getState().ready).toBe(false);
    gate.start();
    gate.start();
    expect(pending()).toBe(1);
    advance(LOADING_TIMEOUT_MS);
    expect(gate.getState().ready).toBe(true);
  });

  it('gotowa przed czasem granicznym kasuje zegar', () => {
    const { clock, pending } = fakeClock();
    const gate = new LoadingGate([], clock);
    gate.start();
    expect(pending()).toBe(1);
    gate.voiceReady();
    expect(pending()).toBe(0);
    gate.start();
    expect(pending()).toBe(0);
  });

  it('błąd lektora nie blokuje gry: zgłoszenie gotowości wystarcza', () => {
    const gate = new LoadingGate([frameKey('host', 'normal')], fakeClock().clock);
    gate.imageLoaded(frameKey('host', 'normal'));
    // Hook woła voiceReady także po nieudanym przygotowaniu (`prepareVoice` → false albo błąd).
    gate.voiceReady();
    expect(gate.getState().ready).toBe(true);
  });
});
