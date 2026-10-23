/**
 * Testy integracyjne kategorii: te same moduły co ekrany „Kategorie” i „Tryb jednoosobowy” —
 * prawdziwy magazyn zestawów (z zapisem w pamięci zamiast pliku), prawdziwy generator
 * z atrapą `fetch` udającą OpenAI, walidacja plików, wybór ekranu startowego oraz
 * cała gra (silnik, boty, sterownik) na pytaniach z wygenerowanej kategorii, na udawanym zegarze.
 */
import { humanTurn, SoloController, type SoloView } from '@/game/controller/SoloController';
import { pickTargets } from '@/game/engine';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame, HUMAN_ID } from '@/game/solo';
import { getLogEntries, resetLog } from '@/lib/log';

import { createQuestionSet, type CreateQuestionSetDeps } from '../createQuestionSet';
import { CategoryError } from '../errors';
import { QUESTIONS_TO_REQUEST } from '../openaiGenerator';
import { QuestionSetStore } from '../QuestionSetStore';
import { soloEntryRoute } from '../soloEntry';
import type { PickedFile } from '../sourceFiles';
import { fakeFetch, generatedItems, jsonResponse, MemoryStorage, questionsResponse } from '../testing/fakes';
import { DEFAULT_SET_ID, DEFAULT_SET_NAME, MAX_CUSTOM_SETS } from '../types';

const STEP_MS = 100;
const MAX_GAME_MS = 2 * 60 * 60 * 1000;

const picked = (name: string, size = 2048): PickedFile => ({ name, size, uri: `file:///cache/${name}` });

function setup(storage = new MemoryStorage()) {
  const store = new QuestionSetStore({ storage, defaultQuestions: QUESTION_BANK });
  const openai = fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST))));
  const readFile = jest.fn(async (file: PickedFile) => Buffer.from(`treść ${file.name}`).toString('base64'));
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

/** Gra jak w `useSoloController`, a gracz zawsze odpowiada dobrze. */
function playWholeGame(questions: typeof QUESTION_BANK, seed: number) {
  const rng = createRng(seed);
  const game = createSoloGame({ difficulty: 'normal', humanName: 'Ty', questions, rng });
  const c = new SoloController({ game, rng, bank: questions });
  c.start();
  const finished = (view: SoloView) => view.game.phase === 'finished' && view.overlay === null;
  for (let elapsed = 0; !finished(c.getView()); elapsed += STEP_MS) {
    if (elapsed > MAX_GAME_MS) throw new Error('Gra utknęła');
    const view = c.getView();
    const turn = humanTurn(view);
    if (view.overlay?.kind === 'banner') {
      jest.advanceTimersByTime(1000);
      c.skip();
    } else if (turn === 'answer' && view.game.pending.kind === 'answer') {
      c.submitAnswer(view.game.pending.question.answers[0]);
    } else if (turn === 'buzz') {
      c.buzz();
    } else if (turn === 'pick') {
      c.pick(pickTargets(view.game, HUMAN_ID)[0].id);
    } else {
      jest.advanceTimersByTime(STEP_MS);
    }
  }
  return c.getView().game;
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

    const asked = game.events.flatMap((e) => (e.type === 'question' ? [e.questionId] : []));
    const setIds = new Set(questions.map((q) => q.id));
    expect(asked.length).toBeGreaterThan(20);
    expect(asked.every((id) => setIds.has(id))).toBe(true);
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
