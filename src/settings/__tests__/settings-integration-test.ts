/**
 * Testy integracyjne ustawień: te same moduły co ekrany „Ustawienia” i „Nowa kategoria” —
 * prawdziwy magazyn klucza (szyfrowany magazyn telefonu udawany w pamięci), prawdziwy magazyn
 * kategorii i generator z atrapą `fetch` udającą OpenAI.
 */
import { createQuestionSet } from '@/categories/createQuestionSet';
import { CategoryError } from '@/categories/errors';
import { QUESTIONS_TO_REQUEST } from '@/categories/openaiGenerator';
import { QuestionSetStore } from '@/categories/QuestionSetStore';
import type { PickedFile } from '@/categories/sourceFiles';
import { fakeFetch, generatedItems, jsonResponse, MemoryStorage, questionsResponse } from '@/categories/testing/fakes';
import { QUESTION_BANK } from '@/game/questions';
import { formatEntry, getLogEntries, resetLog } from '@/lib/log';

import { ApiKeyStore } from '../ApiKeyStore';
import { MemorySecretStorage, VALID_KEY } from '../testing/fakes';

const picked = (name: string): PickedFile => ({ name, size: 2048, uri: `file:///cache/${name}` });

/** Jedno „uruchomienie gry”: magazyny wczytują to, co jest zapisane na telefonie. */
async function launch(secrets = new MemorySecretStorage(), sets = new MemoryStorage()) {
  const apiKey = new ApiKeyStore(secrets);
  const store = new QuestionSetStore({ storage: sets, defaultQuestions: QUESTION_BANK });
  await Promise.all([apiKey.load(), store.load()]);
  const openai = fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST))));
  const readFile = jest.fn(async (file: PickedFile) => btoa(`plik ${file.name}`));
  /** Tak jak ekran „Nowa kategoria”: klucz z ustawień w chwili kliknięcia „Utwórz”. */
  const create = (name: string) =>
    createQuestionSet({ name, files: [picked(`${name}.pdf`)] }, { store, readFile, fetch: openai.fetch, apiKey: apiKey.getKey() });
  return { apiKey, store, openai, readFile, create, secrets, sets };
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

beforeEach(() => resetLog());

describe('klucz API z ustawień', () => {
  it('bez klucza w ustawieniach nie da się utworzyć kategorii; po zapisaniu klucza się da', async () => {
    const game = await launch();
    expect(game.apiKey.getKey()).toBe('');

    const error = await errorOf(game.create('Biologia'));
    expect(error.kind).toBe('no-api-key');
    expect(game.readFile).not.toHaveBeenCalled();
    expect(game.openai.calls).toHaveLength(0);

    await game.apiKey.save(VALID_KEY);
    const set = await game.create('Biologia');

    expect(set.questions).toHaveLength(QUESTIONS_TO_REQUEST);
    expect(game.openai.calls).toHaveLength(1);
    expect(game.openai.calls[0].init.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${VALID_KEY}` }));
  });

  it('klucz zapisany na telefonie działa po ponownym uruchomieniu gry', async () => {
    const first = await launch();
    await first.apiKey.save(VALID_KEY);

    const second = await launch(first.secrets, first.sets);
    expect(second.apiKey.getKey()).toBe(VALID_KEY);
    await second.create('Chemia');
    expect(second.openai.calls[0].init.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${VALID_KEY}` }));
  });

  it('po usunięciu klucza z ustawień kategorie zostają, ale nowej nie da się utworzyć', async () => {
    const game = await launch(new MemorySecretStorage(VALID_KEY));
    await game.create('Fizyka');
    await game.apiKey.clear();

    const restarted = await launch(game.secrets, game.sets);
    expect(restarted.apiKey.getKey()).toBe('');
    expect(restarted.store.customCount()).toBe(1);
    expect((await errorOf(restarted.create('Chemia'))).kind).toBe('no-api-key');
  });

  it('subskrybent (ekran „Nowa kategoria”) widzi klucz zapisany na ekranie ustawień', async () => {
    const game = await launch();
    const seen: string[] = [];
    game.apiKey.subscribe(() => seen.push(game.apiKey.getKey()));
    await game.apiKey.save(VALID_KEY);
    expect(seen).toEqual([VALID_KEY]);
  });

  it('w całym przebiegu klucz nie pojawia się w żadnym logu', async () => {
    const game = await launch();
    await game.apiKey.save(VALID_KEY);
    await game.create('Historia');
    await game.apiKey.clear();

    const dump = getLogEntries().map(formatEntry).join('\n');
    expect(dump).toContain('[ustawienia]');
    expect(dump).not.toContain(VALID_KEY);
  });
});
