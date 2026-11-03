/**
 * Testy integracyjne kategorii: te same moduły co ekrany „Kategorie” i „Tryb jednoosobowy” —
 * prawdziwy magazyn zestawów (z zapisem w pamięci zamiast pliku), prawdziwy generator
 * z atrapą `fetch` udającą OpenAI, walidacja plików, wybór ekranu startowego oraz
 * cała gra (silnik, boty, sterownik) na pytaniach z wygenerowanej kategorii, na udawanym zegarze.
 */
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { activePlayers } from '@/game/potato/engine';
import { createPotatoSoloGame, HUMAN_ID } from '@/game/potato/solo';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { formatEntry, getLogEntries, resetLog } from '@/lib/log';
import { resolveApiKey } from '@/settings/configApiKey';

import { isCategoryFileName } from '../categoryFile';
import { createQuestionSet, type CreateQuestionSetDeps } from '../createQuestionSet';
import { CategoryError } from '../errors';
import { QUESTIONS_TO_REQUEST } from '../openaiGenerator';
import { QuestionSetStore } from '../QuestionSetStore';
import { soloEntryRoute } from '../soloEntry';
import type { PickedFile } from '../sourceFiles';
import { exportQuestionSet, importQuestionSet } from '../transferQuestionSet';
import { fakeFetch, generatedItems, jsonResponse, MemoryStorage, questionsResponse } from '../testing/fakes';
import { DEFAULT_SET_ID, DEFAULT_SET_NAME, MAX_CUSTOM_SETS } from '../types';

const STEP_MS = 100;
const MAX_GAME_MS = 2 * 60 * 60 * 1000;

const picked = (name: string, size = 2048): PickedFile => ({ name, size, uri: `file:///cache/${name}` });

function setup(storage = new MemoryStorage()) {
  const store = new QuestionSetStore({ storage, defaultQuestions: QUESTION_BANK });
  const openai = fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST))));
  const readFile = jest.fn(async (file: PickedFile) => btoa(`plik ${file.name}`));
  const deps: CreateQuestionSetDeps = { store, readFile, fetch: openai.fetch, apiKey: 'sk-test' };
  return { store, storage, openai, readFile, deps };
}

async function errorOf(promise: Promise<unknown>): Promise<CategoryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CategoryError) return error;
    throw new Error(`Oczekiwano CategoryError, jest ${String(error)}`);
  }
  throw new Error('Oczekiwano błędu');
}

/** Gra jak w `usePotatoController`, a gracz zawsze odpowiada dobrze. Zwraca też id wszystkich zadanych pytań. */
function playWholeGame(questions: typeof QUESTION_BANK, seed: number) {
  const rng = createRng(seed);
  const game = createPotatoSoloGame({ humanName: 'Ty', questions, rng });
  const c = new PotatoController({ game, difficulty: 'normal', rng });
  const asked: string[] = [];
  c.start();
  for (let elapsed = 0; c.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
    if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
    const { game: state, overlay, awaitingPick } = c.getView();
    if (state.question && state.question.id !== asked.at(-1)) asked.push(state.question.id);
    if (awaitingPick) {
      c.pick(activePlayers(state).find((p) => p.id !== awaitingPick.chooserId)!.id);
    } else if (overlay === null && state.question && state.holderId === HUMAN_ID) {
      c.submitAnswer(state.question.answers[0]);
    } else {
      jest.advanceTimersByTime(STEP_MS);
    }
  }
  return { ...c.getView().game, asked };
}

beforeEach(() => {
  jest.useFakeTimers();
  resetLog();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('od plików do gry', () => {
  it('bez własnych kategorii tryb jednoosobowy od razu pyta o poziom (pytania domyślne)', async () => {
    const { store } = setup();
    await store.load();
    expect(soloEntryRoute(store.getSets())).toEqual({ pathname: '/solo', params: { set: DEFAULT_SET_ID } });
    expect(store.questionsForSet(DEFAULT_SET_ID)).toBe(QUESTION_BANK);
  });

  it('cała gra na wygenerowanej kategorii zadaje tylko jej pytania', async () => {
    const { store, openai, readFile, deps } = setup();
    await store.load();

    const set = await createQuestionSet({ name: 'Biologia', files: [picked('komorka.pdf'), picked('dna.txt')] }, deps);

    expect(readFile).toHaveBeenCalledTimes(2);
    expect(openai.calls).toHaveLength(1);
    expect(set.questions).toHaveLength(QUESTIONS_TO_REQUEST);
    expect(set.sourceFiles).toEqual(['komorka.pdf', 'dna.txt']);
    expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Biologia']);
    expect(soloEntryRoute(store.getSets())).toEqual({ pathname: '/solo/categories' });

    const questions = store.questionsForSet(set.id);
    const game = playWholeGame(questions, 7);

    const setIds = new Set(questions.map((q) => q.id));
    expect(game.asked.length).toBeGreaterThan(20);
    expect(game.asked.every((id) => setIds.has(id))).toBe(true);
    expect(game.ranking).toHaveLength(5);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('kategoria zapisana na telefonie jest dostępna po ponownym uruchomieniu', async () => {
    const first = setup();
    await first.store.load();
    const set = await createQuestionSet({ name: 'Chemia', files: [picked('chemia.pdf')] }, first.deps);

    const { store } = setup(first.storage);
    await store.load();
    expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Chemia']);
    expect(store.questionsForSet(set.id)).toEqual(set.questions);
  });

  it('po usunięciu jedynej własnej kategorii wracamy do samego wyboru poziomu', async () => {
    const { store, deps } = setup();
    await store.load();
    const set = await createQuestionSet({ name: 'Fizyka', files: [picked('fizyka.pdf')] }, deps);
    await store.remove(set.id);
    expect(soloEntryRoute(store.getSets())).toEqual({ pathname: '/solo', params: { set: DEFAULT_SET_ID } });
    expect(store.questionsForSet(set.id)).toBe(QUESTION_BANK);
  });

  it('logi pokazują cały przebieg bez ostrzeżeń', async () => {
    const { store, deps } = setup();
    await store.load();
    await createQuestionSet({ name: 'Biologia', files: [picked('a.pdf')] }, deps);

    expect(getLogEntries({ tag: 'openai' }).map((e) => e.message)).toEqual(['Wysyłam pliki do OpenAI', 'Wygenerowano pytania']);
    expect(getLogEntries({ tag: 'kategorie' }).map((e) => e.message)).toEqual([
      'Wczytano kategorie',
      'Tworzę kategorię',
      'Dodano kategorię',
    ]);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });
});

describe('klucz API z konfiguracji', () => {
  const KEY = 'sk-proj-TESTOWY0123456789abcdWXYZ';

  it('poprawny klucz trafia do zapytania, ale do żadnego logu', async () => {
    const { store, openai, deps } = setup();
    await store.load();
    await createQuestionSet({ name: 'Historia', files: [picked('a.pdf')] }, { ...deps, apiKey: resolveApiKey(` ${KEY} `) });
    expect(openai.calls[0].init.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${KEY}` }));
    expect(getLogEntries().map(formatEntry).join('\n')).not.toContain(KEY);
  });

  it('klucz w złym formacie: nic nie jest czytane ani wysyłane, kategorie zostają', async () => {
    const { store, openai, readFile, deps } = setup();
    await store.load();
    const first = await createQuestionSet({ name: 'Historia', files: [picked('a.pdf')] }, deps);
    openai.calls.length = 0;
    readFile.mockClear();

    const error = await errorOf(createQuestionSet({ name: 'Sport', files: [picked('b.pdf')] }, { ...deps, apiKey: resolveApiKey('zly-klucz') }));

    expect(error.kind).toBe('no-api-key');
    expect(readFile).not.toHaveBeenCalled();
    expect(openai.calls).toHaveLength(0);
    expect(store.getSet(first.id)).toBeDefined();
  });
});

describe('zabezpieczenia przed wysłaniem plików', () => {
  it(`przy ${MAX_CUSTOM_SETS} własnych kategoriach nie czyta plików i nie płaci za zapytanie`, async () => {
    const { store, openai, readFile, deps } = setup();
    await store.load();
    for (let i = 0; i < MAX_CUSTOM_SETS; i++) {
      await createQuestionSet({ name: `Zestaw ${i}`, files: [picked(`p${i}.pdf`)] }, deps);
    }
    readFile.mockClear();
    const callsBefore = openai.calls.length;

    const error = await errorOf(createQuestionSet({ name: 'Czwarty', files: [picked('x.pdf')] }, deps));
    expect(error.kind).toBe('limit');
    expect(readFile).not.toHaveBeenCalled();
    expect(openai.calls).toHaveLength(callsBefore);
  });

  it.each([
    ['zła nazwa', { name: '  ', files: [picked('a.pdf')] }, 'name'],
    ['nazwa domyślnej', { name: 'Domyślna', files: [picked('a.pdf')] }, 'name'],
    ['brak plików', { name: 'A', files: [] }, 'files'],
    ['10 plików', { name: 'A', files: Array.from({ length: 10 }, (_, i) => picked(`p${i}.pdf`)) }, 'files'],
    ['film', { name: 'A', files: [picked('film.mp4')] }, 'files'],
  ])('%s: błąd %s, nic nie jest wysyłane ani zapisywane', async (_, input, kind) => {
    const { store, storage, openai, readFile, deps } = setup();
    await store.load();
    const error = await errorOf(createQuestionSet(input, deps));
    expect(error.kind).toBe(kind);
    expect(readFile).not.toHaveBeenCalled();
    expect(openai.calls).toHaveLength(0);
    expect(storage.writes).toBe(0);
  });

  it.each([
    ['pusty', ''],
    ['same spacje', '   '],
  ])('bez klucza API (%s): błąd przed czytaniem plików, z informacją o .env.local', async (_, apiKey) => {
    const { store, storage, openai, readFile, deps } = setup();
    await store.load();
    const error = await errorOf(createQuestionSet({ name: 'A', files: [picked('a.pdf')] }, { ...deps, apiKey }));
    expect(error.kind).toBe('no-api-key');
    expect(error.message).toContain('.env.local');
    expect(readFile).not.toHaveBeenCalled();
    expect(openai.calls).toHaveLength(0);
    expect(storage.writes).toBe(0);
  });

  it('nie da się odczytać pliku: błąd file-read z nazwą pliku', async () => {
    const { store, openai, deps } = setup();
    await store.load();
    const readFile = jest.fn(async () => {
      throw new Error('EACCES');
    });
    const error = await errorOf(createQuestionSet({ name: 'A', files: [picked('tajne.pdf')] }, { ...deps, readFile }));
    expect(error.kind).toBe('file-read');
    expect(error.message).toContain('tajne.pdf');
    expect(openai.calls).toHaveLength(0);
  });

  it('błąd OpenAI nie zapisuje kategorii', async () => {
    const { store, storage, deps } = setup();
    await store.load();
    const fetch = fakeFetch(jsonResponse({ error: { message: 'Incorrect API key' } }, 401)).fetch;
    const error = await errorOf(createQuestionSet({ name: 'A', files: [picked('a.pdf')] }, { ...deps, fetch }));
    expect(error.kind).toBe('auth');
    expect(store.customCount()).toBe(0);
    expect(storage.writes).toBe(0);
  });

  it('postęp: czytanie → generowanie → zapis', async () => {
    const { store, deps } = setup();
    await store.load();
    const onProgress = jest.fn();
    await createQuestionSet({ name: 'A', files: [picked('a.pdf')] }, { ...deps, onProgress });
    expect(onProgress.mock.calls.map(([step]) => step)).toEqual(['reading', 'generating', 'saving']);
  });
});

describe('import i eksport (.kat)', () => {
  /** Udawany dysk: eksport zapisuje tu plik, import go stąd czyta. */
  function fakeDisk() {
    const files = new Map<string, string>();
    const saveFile = jest.fn(async (fileName: string, text: string) => {
      files.set(fileName, text);
      return true;
    });
    const readText = jest.fn(async (file: PickedFile) => {
      const text = files.get(file.name);
      if (text === undefined) throw new Error('ENOENT');
      return text;
    });
    const pick = (name: string): PickedFile => ({ name, size: files.get(name)?.length ?? 0, uri: `file:///pobrane/${name}` });
    return { files, saveFile, readText, pick };
  }

  it('kategoria wyeksportowana i zaimportowana na innym telefonie działa w grze', async () => {
    const disk = fakeDisk();
    const phoneA = setup();
    await phoneA.store.load();
    const original = await createQuestionSet({ name: 'Biologia', files: [picked('komorka.pdf')] }, phoneA.deps);

    const fileName = await exportQuestionSet(original, { saveFile: disk.saveFile });
    expect(fileName).toBe('Biologia.kat');
    expect(isCategoryFileName(fileName!)).toBe(true);
    // W środku zwykły JSON.
    expect(JSON.parse(disk.files.get('Biologia.kat')!).name).toBe('Biologia');

    const phoneB = setup();
    await phoneB.store.load();
    const imported = await importQuestionSet(disk.pick('Biologia.kat'), { store: phoneB.store, readText: disk.readText });

    // Zachowuje się jak kategoria z OpenAI: lista, wybór przed grą, zapis po restarcie, gra tylko na jej pytaniach.
    expect(phoneB.openai.calls).toHaveLength(0);
    expect(imported.sourceFiles).toEqual(['komorka.pdf']);
    expect(imported.questions.map((q) => q.question)).toEqual(original.questions.map((q) => q.question));
    expect(phoneB.store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Biologia']);
    expect(soloEntryRoute(phoneB.store.getSets())).toEqual({ pathname: '/solo/categories' });

    const restarted = new QuestionSetStore({ storage: phoneB.storage, defaultQuestions: QUESTION_BANK });
    await restarted.load();
    expect(restarted.questionsForSet(imported.id)).toEqual(imported.questions);

    const questions = restarted.questionsForSet(imported.id);
    const game = playWholeGame(questions, 11);
    const setIds = new Set(questions.map((q) => q.id));
    expect(game.asked.length).toBeGreaterThan(20);
    expect(game.asked.every((id) => setIds.has(id))).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('zaimportowaną kategorię można wyeksportować i usunąć, a import liczy się do limitu', async () => {
    const disk = fakeDisk();
    const { store, deps } = setup();
    await store.load();
    const original = await createQuestionSet({ name: 'Chemia', files: [picked('chemia.pdf')] }, deps);
    await exportQuestionSet(original, { saveFile: disk.saveFile });

    const copies = [];
    for (let i = 1; i < MAX_CUSTOM_SETS; i++) {
      copies.push(await importQuestionSet(disk.pick('Chemia.kat'), { store, readText: disk.readText }));
    }
    expect(store.getSets().map((s) => s.name)).toEqual([DEFAULT_SET_NAME, 'Chemia', 'Chemia (2)', 'Chemia (3)']);

    disk.readText.mockClear();
    const error = await errorOf(importQuestionSet(disk.pick('Chemia.kat'), { store, readText: disk.readText }));
    expect(error.kind).toBe('limit');
    expect(disk.readText).not.toHaveBeenCalled();

    expect(await exportQuestionSet(copies[0], { saveFile: disk.saveFile })).toBe('Chemia (2).kat');
    await store.remove(copies[0].id);
    expect(store.customCount()).toBe(MAX_CUSTOM_SETS - 1);
  });

  it('plik z innym rozszerzeniem nie jest czytany', async () => {
    const disk = fakeDisk();
    const { store } = setup();
    disk.files.set('Biologia.kat.json', '{}');
    const error = await errorOf(importQuestionSet(disk.pick('Biologia.kat.json'), { store, readText: disk.readText }));
    expect(error.kind).toBe('import-extension');
    expect(disk.readText).not.toHaveBeenCalled();
  });
});
