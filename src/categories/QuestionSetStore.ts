import { normalizeAnswer } from '@/game/answers';
import { parseQuestion } from '@/game/questions';
import type { Question } from '@/game/types';
import { createLogger } from '@/lib/log';

import { CategoryError } from './errors';
import { DEFAULT_SET_ID, DEFAULT_SET_NAME, MAX_CUSTOM_SETS, type QuestionSet } from './types';

export const STORAGE_VERSION = 1;
export const MAX_SET_NAME_LENGTH = 30;

const log = createLogger('kategorie');

/** Jeden tekst zapisany na telefonie (w aplikacji plik JSON, w testach pamięć). */
export interface TextStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

export interface QuestionSetStoreOptions {
  storage: TextStorage;
  defaultQuestions: Question[];
  now?: () => number;
}

export interface NewQuestionSet {
  name: string;
  questions: Question[];
  sourceFiles: string[];
}

export type SetNameCheck = { ok: true; name: string } | { ok: false; reason: string };

export function validateSetName(name: string, existing: QuestionSet[]): SetNameCheck {
  const trimmed = name.trim();
  if (trimmed === '') return { ok: false, reason: 'Podaj nazwę kategorii.' };
  if (trimmed.length > MAX_SET_NAME_LENGTH) {
    return { ok: false, reason: `Nazwa może mieć najwyżej ${MAX_SET_NAME_LENGTH} znaków.` };
  }
  const key = normalizeAnswer(trimmed);
  if (existing.some((s) => normalizeAnswer(s.name) === key)) {
    return { ok: false, reason: `Kategoria „${trimmed}” już istnieje.` };
  }
  return { ok: true, name: trimmed };
}

/** Odczytuje jeden zapisany zestaw; zły zestaw to wyjątek. */
function parseStoredSet(raw: unknown): QuestionSet {
  if (typeof raw !== 'object' || raw === null) throw new Error('zestaw nie jest obiektem');
  const { id, name, createdAt, sourceFiles, questions } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || id === '' || id === DEFAULT_SET_ID) throw new Error('złe id');
  if (typeof name !== 'string' || name.trim() === '') throw new Error('zła nazwa');
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('brak pytań');
  return {
    id,
    name,
    builtIn: false,
    createdAt: typeof createdAt === 'number' ? createdAt : null,
    sourceFiles: Array.isArray(sourceFiles) ? sourceFiles.filter((f): f is string => typeof f === 'string') : [],
    questions: questions.map((q, i) => parseQuestion(q, i)),
  };
}

/**
 * Kategorie (zestawy pytań): domyślna + najwyżej `MAX_CUSTOM_SETS` własnych zapisanych na telefonie.
 * Limit i ochrona domyślnej są tutaj, a nie tylko w ekranie. Zmiany są wykonywane po kolei,
 * więc dwa szybkie „Utwórz” nie ominą limitu.
 */
export class QuestionSetStore {
  private readonly storage: TextStorage;
  private readonly now: () => number;
  private readonly defaultSet: QuestionSet;
  private custom: QuestionSet[] = [];
  private sets: QuestionSet[];
  private loading: Promise<void> | null = null;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor({ storage, defaultQuestions, now = Date.now }: QuestionSetStoreOptions) {
    this.storage = storage;
    this.now = now;
    this.defaultSet = {
      id: DEFAULT_SET_ID,
      name: DEFAULT_SET_NAME,
      builtIn: true,
      createdAt: null,
      sourceFiles: [],
      questions: defaultQuestions,
    };
    this.sets = [this.defaultSet];
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Domyślna zawsze pierwsza. Ta sama tablica, dopóki nic się nie zmieni (dla `useSyncExternalStore`). */
  getSets = (): QuestionSet[] => this.sets;

  isLoaded() {
    return this.loaded;
  }

  customCount() {
    return this.custom.length;
  }

  canAddMore() {
    return this.custom.length < MAX_CUSTOM_SETS;
  }

  getSet(id: string): QuestionSet | undefined {
    return this.sets.find((s) => s.id === id);
  }

  /** Pytania do gry; nieznany zestaw (np. usunięty w międzyczasie) daje pytania domyślne. */
  questionsForSet(id: string): Question[] {
    const set = this.getSet(id);
    if (set) return set.questions;
    log.warn('Nieznana kategoria, używam domyślnej', { setId: id });
    return this.defaultSet.questions;
  }

  /** Wczytuje zapis raz; kolejne wywołania czekają na to samo wczytanie. */
  load(): Promise<void> {
    this.loading ??= this.readStorage();
    return this.loading;
  }

  add(input: NewQuestionSet): Promise<QuestionSet> {
    return this.serial(async () => {
      if (!this.canAddMore()) {
        throw new CategoryError('limit', `Można mieć najwyżej ${MAX_CUSTOM_SETS} własne kategorie. Usuń którąś, żeby dodać nową.`);
      }
      const name = validateSetName(input.name, this.sets);
      if (!name.ok) throw new CategoryError('name', name.reason);
      if (input.questions.length === 0) throw new CategoryError('no-questions', 'Kategoria nie ma żadnych pytań.');

      const id = this.newId();
      const set: QuestionSet = {
        id,
        name: name.name,
        builtIn: false,
        createdAt: this.now(),
        sourceFiles: [...input.sourceFiles],
        questions: input.questions.map((q, i) => ({ ...q, id: `${id}-${String(i + 1).padStart(3, '0')}` })),
      };
      await this.persist([...this.custom, set]);
      log.info('Dodano kategorię', { setId: id, questions: set.questions.length, custom: this.custom.length });
      return set;
    });
  }

  remove(id: string): Promise<void> {
    return this.serial(async () => {
      if (id === DEFAULT_SET_ID) throw new CategoryError('default-set', 'Kategorii domyślnej nie można usunąć.');
      if (!this.custom.some((s) => s.id === id)) throw new CategoryError('not-found', 'Tej kategorii już nie ma.');
      await this.persist(this.custom.filter((s) => s.id !== id));
      log.info('Usunięto kategorię', { setId: id, custom: this.custom.length });
    });
  }

  /** Wykonuje zmiany po kolei, zawsze po wczytaniu zapisu. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.load()).then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Najpierw zapis, potem zmiana w pamięci — błąd zapisu niczego nie zmienia. */
  private async persist(custom: QuestionSet[]) {
    try {
      await this.storage.write(JSON.stringify({ version: STORAGE_VERSION, sets: custom }));
    } catch (error) {
      log.error('Nie udało się zapisać kategorii', { error: error instanceof Error ? error.message : String(error) });
      throw new CategoryError('storage', 'Nie udało się zapisać kategorii w pamięci telefonu.');
    }
    this.setCustom(custom);
  }

  private setCustom(custom: QuestionSet[]) {
    this.custom = custom;
    this.sets = [this.defaultSet, ...custom];
    this.listeners.forEach((listener) => listener());
  }

  private newId() {
    const base = `set-${this.now().toString(36)}`;
    let id = base;
    for (let n = 2; this.sets.some((s) => s.id === id); n++) id = `${base}-${n}`;
    return id;
  }

  private async readStorage() {
    let custom: QuestionSet[] = [];
    try {
      custom = this.parseStorage(await this.storage.read());
    } catch (error) {
      log.warn('Nie udało się wczytać kategorii, zostają domyślne', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    this.loaded = true;
    log.info('Wczytano kategorie', { custom: custom.length });
    this.setCustom(custom);
  }

  private parseStorage(text: string | null): QuestionSet[] {
    if (text === null) return [];
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) throw new Error('zapis nie jest obiektem');
    const { version, sets } = raw as { version?: unknown; sets?: unknown };
    if (version !== STORAGE_VERSION) throw new Error(`nieznana wersja zapisu ${String(version)}`);
    if (!Array.isArray(sets)) throw new Error('brak listy zestawów');

    const custom: QuestionSet[] = [];
    sets.forEach((item, index) => {
      try {
        const set = parseStoredSet(item);
        if (custom.length < MAX_CUSTOM_SETS && !custom.some((s) => s.id === set.id)) custom.push(set);
      } catch (error) {
        log.warn('Pominięto uszkodzoną kategorię', { index, error: error instanceof Error ? error.message : String(error) });
      }
    });
    return custom;
  }
}
