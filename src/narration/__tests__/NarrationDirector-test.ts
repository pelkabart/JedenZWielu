import type { SoloView } from '@/game/controller/SoloController';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame, HUMAN_ID } from '@/game/solo';
import type { GameState, Question } from '@/game/types';
import { getLogEntries, resetLog } from '@/lib/log';

import { NarrationDirector, type ViewSource } from '../NarrationDirector';
import { FakeVoice } from '../testing/FakeVoice';

const [q1, q2] = QUESTION_BANK;

/** Udaje sterownik: trzyma widok, powiadamia o zmianach i zapisuje zgłoszenia „mówi / nie mówi”. */
class FakeViews implements ViewSource {
  view: SoloView;
  readonly speaking: boolean[] = [];
  private readonly listeners = new Set<() => void>();

  constructor() {
    const game = createSoloGame({ difficulty: 'normal', humanName: 'Ty', questions: QUESTION_BANK, rng: createRng(1) });
    // Spokojny stan startowy: gra czeka na wskazanie przez człowieka.
    this.view = {
      game: { ...game, pending: { kind: 'pick', chooserId: HUMAN_ID, allowSelf: false } },
      overlay: null,
      deadline: null,
      timerMs: null,
      thinkingId: null,
      paused: false,
    };
  }

  get bot() {
    return this.view.game.players.find((p) => !p.isHuman)!;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = () => this.view;

  setSpeaking = (speaking: boolean) => {
    this.speaking.push(speaking);
  };

  set(patch: Partial<SoloView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }

  setPending(pending: GameState['pending']) {
    this.set({ game: { ...this.view.game, pending } });
  }

  /** Czytanie pytania dla bota (jak po wskazaniu). */
  readToBot(question: Question) {
    this.view = {
      ...this.view,
      game: { ...this.view.game, pending: { kind: 'answer', playerId: this.bot.id, question, reason: 'picked', pickedBy: HUMAN_ID } },
    };
    this.set({ overlay: { kind: 'reading', question } });
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

function setup() {
  const views = new FakeViews();
  const voice = new FakeVoice();
  const director = new NarrationDirector(views, voice);
  return { views, voice, director };
}

/** Obietnice z `say` kończą się asynchronicznie. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => resetLog());

describe('NarrationDirector', () => {
  it('na starcie mówi bieżącą kwestię prowadzącego i zgłasza, że mówi', () => {
    const { voice, views } = setup();
    expect(voice.utterances()).toEqual([['Kogo wskazujesz?']]);
    expect(views.speaking).toEqual([true]);
  });

  it('koniec wypowiedzi zgłasza sterownikowi', async () => {
    const { voice, views } = setup();
    voice.finish();
    await flush();
    expect(views.speaking).toEqual([true, false]);
  });

  it('mówi tylko wtedy, gdy zmienia się kwestia', () => {
    const { voice, views } = setup();
    views.set({ deadline: 1000, timerMs: 15000 });
    views.set({ thinkingId: views.bot.id });
    expect(voice.utterances()).toHaveLength(1);
    views.set({ overlay: { kind: 'banner', phase: 'stage2' } });
    expect(voice.utterances().at(-1)).toEqual(['Przechodzimy do drugiego etapu!']);
  });

  it('czytanie: kwestia prowadzącego i pytanie w jednej wypowiedzi', () => {
    const { voice, views } = setup();
    views.readToBot(q1);
    expect(voice.utterances().at(-1)).toEqual([`${views.bot.name}, Twoje pytanie.`, q1.question]);
    expect(getLogEntries({ tag: 'lektor' })).toContainEqual(
      expect.objectContaining({ level: 'info', message: 'Prowadzący mówi', data: { sentences: 2, questionId: q1.id, overlay: 'reading' } }),
    );
  });

  it('po przeczytaniu pytania prowadzący nie powtarza kwestii przy odpowiedzi bota', async () => {
    const { voice, views } = setup();
    views.readToBot(q1);
    voice.finish();
    await flush();
    views.set({ overlay: null, deadline: 1000, timerMs: 15000, thinkingId: views.bot.id });
    expect(voice.utterances()).toHaveLength(2);
    expect(voice.actions().filter((a) => a === 'stop')).toHaveLength(1); // tylko przerwanie pierwszej kwestii
  });

  it('nowa kwestia przerywa poprzednią, bez przerwy w zgłoszeniu „mówi”', () => {
    const { voice, views } = setup();
    views.set({ overlay: { kind: 'pick', chooserId: HUMAN_ID, targetId: views.bot.id } });
    expect(voice.actions()).toEqual(['say', 'stop', 'say']);
    // Sterownik nie może dostać „nie mówi” między starą a nową kwestią.
    expect(views.speaking).toEqual([true, true]);
  });

  it('przerwana wypowiedź, która kończy się później, nie zgłasza końca nowej', async () => {
    const views = new FakeViews();
    const voice = new FakeVoice();
    // Pierwsza wypowiedź kończy się dopiero po przerwaniu (jak asynchroniczna synteza).
    let finishFirst!: () => void;
    const say = voice.say.bind(voice);
    voice.say = (texts) => {
      if (voice.utterances().length === 0) {
        say(texts);
        return new Promise<void>((resolve) => (finishFirst = resolve));
      }
      return say(texts);
    };
    new NarrationDirector(views, voice);
    views.set({ overlay: { kind: 'banner', phase: 'final' } });
    finishFirst();
    await flush();
    expect(views.speaking).toEqual([true, true]);
  });

  it('pominięcie czytania zatrzymuje pytanie', () => {
    const { voice, views } = setup();
    views.readToBot(q1);
    // Gracz dotknął ekranu: nakładka znika, kwestia w dymku zostaje ta sama.
    views.set({ overlay: null, deadline: 1000, timerMs: 15000 });
    expect(voice.actions().at(-1)).toBe('stop');
    expect(views.speaking.at(-1)).toBe(false);
  });

  it('pauza wstrzymuje, wznowienie gra dalej', () => {
    const { voice, views } = setup();
    views.readToBot(q1);
    views.set({ paused: true });
    expect(voice.state).toBe('paused');
    views.set({ paused: false });
    expect(voice.actions().slice(-3)).toEqual(['say', 'pause', 'resume']);
    expect(voice.state).toBe('speaking');
  });

  it('wypowiedź zaczęta w czasie pauzy rusza dopiero po wznowieniu', () => {
    const { voice, views } = setup();
    voice.finish();
    views.set({ paused: true, overlay: { kind: 'banner', phase: 'final' } });
    expect(voice.utterances()).toHaveLength(1);
    views.set({ paused: false });
    expect(voice.utterances().at(-1)).toEqual(['Przechodzimy do finału!']);
  });

  it('kolejne pytania czyta każde swoją wypowiedzią', () => {
    const { voice, views } = setup();
    views.readToBot(q1);
    views.set({ overlay: null });
    views.readToBot(q2);
    const read = voice.utterances().filter((texts) => texts.some((t) => t === q1.question || t === q2.question));
    expect(read.map((texts) => texts.at(-1))).toEqual([q1.question, q2.question]);
  });

  it('błąd lektora kończy wypowiedź i trafia do logów', async () => {
    const views = new FakeViews();
    const voice = new FakeVoice();
    voice.failOn = 'say';
    expect(() => new NarrationDirector(views, voice)).not.toThrow();
    await flush();
    expect(views.speaking).toEqual([true, false]);
    expect(getLogEntries({ tag: 'lektor', minLevel: 'error' })).toEqual([
      expect.objectContaining({ message: 'Błąd lektora', data: { error: 'Awaria syntezy' } }),
    ]);
  });

  it('błąd przy pauzie nie przerywa gry', () => {
    const { voice, views } = setup();
    voice.failOn = 'pause';
    expect(() => views.set({ paused: true })).not.toThrow();
    expect(getLogEntries({ tag: 'lektor', minLevel: 'error' })).toHaveLength(1);
  });

  it('mikrofon ucisza lektora i nie pozwala mu zacząć', async () => {
    const { voice, views } = setup();
    views.set({ listening: true });
    expect(voice.actions()).toEqual(['say', 'stop']);
    expect(views.speaking.at(-1)).toBe(false);
    // Kwestia zmieniona w czasie słuchania nie pada — rozpoznawanie by ją usłyszało.
    views.set({ overlay: { kind: 'banner', phase: 'final' } });
    expect(voice.utterances()).toHaveLength(1);
    // Po odpowiedzi mikrofon jest wyłączony, a następna kwestia (wynik) już pada.
    views.set({ listening: false });
    views.set({ overlay: { kind: 'pick', chooserId: HUMAN_ID, targetId: views.bot.id } });
    expect(voice.utterances().at(-1)).toEqual([`Wskazujesz: ${views.bot.name}.`]);
  });

  it('dispose zatrzymuje głos i przestaje słuchać', () => {
    const { voice, views, director } = setup();
    director.dispose();
    expect(voice.actions()).toEqual(['say', 'stop', 'dispose']);
    expect(views.listenerCount).toBe(0);
    expect(views.speaking.at(-1)).toBe(false);
    // FakeVoice rzuca przy użyciu po zwolnieniu — tu nic nie może go wywołać.
    expect(() => views.readToBot(q2)).not.toThrow();
    expect(voice.actions()).toEqual(['say', 'stop', 'dispose']);
  });
});
