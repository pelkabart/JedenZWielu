import { getLogEntries, resetLog } from '@/lib/log';
import { ANSWER_TYPES, CATEGORIES } from '@/game/types';

import { CategoryError } from '../errors';
import {
  generateQuestionSet,
  MIN_QUESTIONS,
  OPENAI_MODEL,
  OPENAI_RESPONSES_URL,
  QUESTIONS_TO_REQUEST,
  REQUEST_TIMEOUT_MS,
  type GenerateOptions,
} from '../openaiGenerator';
import {
  fakeFetch,
  generatedItems,
  hangingFetch,
  jsonResponse,
  openAIResponse,
  questionsResponse,
  sourceFile,
} from '../testing/fakes';

const API_KEY = 'sk-test-SEKRET-123';

function options(patch: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    apiKey: API_KEY,
    setName: 'Biologia',
    setId: 'bio',
    files: [sourceFile('komorka.pdf', 'UERGREFUQQ=='), sourceFile('notatki.txt', 'dGVrc3Q=')],
    fetch: fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST)))).fetch,
    ...patch,
  };
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

describe('zapytanie do OpenAI', () => {
  it('wysyła pliki do Responses API z kluczem i schematem odpowiedzi', async () => {
    const { fetch, calls } = fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST))));
    await generateQuestionSet(options({ fetch }));

    expect(calls).toHaveLength(1);
    const [{ url, init, body }] = calls;
    expect(url).toBe(OPENAI_RESPONSES_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }),
    );
    expect(body.model).toBe(OPENAI_MODEL);
    expect(body.store).toBe(false);

    const input = body.input as { role: string; content: { type: string; filename?: string; file_data?: string; text?: string }[] }[];
    const user = input.find((m) => m.role === 'user');
    const files = user?.content.filter((c) => c.type === 'input_file');
    expect(files).toEqual([
      { type: 'input_file', filename: 'komorka.pdf', file_data: 'data:application/pdf;base64,UERGREFUQQ==' },
      { type: 'input_file', filename: 'notatki.txt', file_data: 'data:text/plain;base64,dGVrc3Q=' },
    ]);
    const prompt = user?.content.find((c) => c.type === 'input_text')?.text ?? '';
    expect(prompt).toContain('Biologia');
    expect(prompt).toContain(String(QUESTIONS_TO_REQUEST));
  });

  it('wymaga ścisłego schematu JSON z dziedzinami i typami odpowiedzi z gry', async () => {
    const { fetch, calls } = fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST))));
    await generateQuestionSet(options({ fetch }));

    const format = (calls[0].body.text as { format: Record<string, unknown> }).format;
    expect(format).toEqual(expect.objectContaining({ type: 'json_schema', strict: true }));
    const item = (format.schema as any).properties.questions.items;
    expect(item.additionalProperties).toBe(false);
    expect([...item.required].sort()).toEqual(['answerType', 'answers', 'category', 'difficulty', 'question', 'wrongAnswers']);
    expect(item.properties.category.enum).toEqual([...CATEGORIES]);
    expect(item.properties.answerType.enum).toEqual([...ANSWER_TYPES]);
    expect(item.properties.difficulty.enum).toEqual([1, 2, 3]);
  });

  it('zwraca oczyszczone pytania z id zestawu i liczbą odrzuconych', async () => {
    const items = [...generatedItems(30), { ...generatedItems(1)[0], question: '' }];
    const result = await generateQuestionSet(options({ fetch: fakeFetch(jsonResponse(questionsResponse(items))).fetch }));

    expect(result.questions).toHaveLength(30);
    expect(result.rejected).toBe(1);
    expect(result.questions[0].id).toBe('bio-001');
  });

  it('loguje start i wynik, ale nie klucz ani treść plików', async () => {
    await generateQuestionSet(options());

    const entries = getLogEntries({ tag: 'openai' });
    expect(entries.map((e) => e.message)).toEqual(['Wysyłam pliki do OpenAI', 'Wygenerowano pytania']);
    expect(entries[0].data).toEqual(expect.objectContaining({ files: 2, model: OPENAI_MODEL }));
    expect(entries[1].data).toEqual(expect.objectContaining({ accepted: QUESTIONS_TO_REQUEST, rejected: 0 }));
    const dump = JSON.stringify(getLogEntries());
    expect(dump).not.toContain(API_KEY);
    expect(dump).not.toContain('UERGREFUQQ==');
  });
});

describe('błędy', () => {
  it.each([
    ['pusty klucz', { apiKey: '   ' }, 'no-api-key'],
    ['brak plików', { files: [] }, 'files'],
    ['10 plików', { files: Array.from({ length: 10 }, (_, i) => sourceFile(`p${i}.pdf`)) }, 'files'],
  ])('%s: nic nie wysyła', async (_, patch, kind) => {
    const { fetch, calls } = fakeFetch(jsonResponse(questionsResponse(generatedItems(QUESTIONS_TO_REQUEST))));
    const error = await errorOf(generateQuestionSet(options({ ...patch, fetch })));
    expect(error.kind).toBe(kind);
    expect(calls).toHaveLength(0);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [500, 'server'],
    [503, 'server'],
    [400, 'bad-response'],
  ])('HTTP %i → %s', async (status, kind) => {
    const fetch = fakeFetch(jsonResponse({ error: { message: 'Coś nie tak', code: 'x' } }, status)).fetch;
    const error = await errorOf(generateQuestionSet(options({ fetch })));
    expect(error.kind).toBe(kind);
    expect(error.message).not.toBe('');
    expect(getLogEntries({ tag: 'openai', minLevel: 'warn' })).toHaveLength(1);
  });

  it('brak internetu → network', async () => {
    const fetch = fakeFetch(new TypeError('Network request failed')).fetch;
    expect((await errorOf(generateQuestionSet(options({ fetch })))).kind).toBe('network');
  });

  it('odmowa modelu → refused', async () => {
    const refusal = {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Nie mogę pomóc.' }] }],
    };
    const error = await errorOf(generateQuestionSet(options({ fetch: fakeFetch(jsonResponse(refusal)).fetch })));
    expect(error.kind).toBe('refused');
  });

  it('ucięta odpowiedź → incomplete', async () => {
    const cut = openAIResponse('{"questions": [', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } });
    const error = await errorOf(generateQuestionSet(options({ fetch: fakeFetch(jsonResponse(cut)).fetch })));
    expect(error.kind).toBe('incomplete');
  });

  it.each([
    ['tekst, który nie jest JSON-em', jsonResponse(openAIResponse('To nie jest JSON'))],
    ['brak wiadomości', jsonResponse({ status: 'completed', output: [] })],
    ['zły kształt całej odpowiedzi', jsonResponse('nie obiekt')],
    [
      'JSON odpowiedzi HTTP się nie parsuje',
      {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      },
    ],
  ])('%s → bad-response', async (_, response) => {
    const error = await errorOf(generateQuestionSet(options({ fetch: fakeFetch(response).fetch })));
    expect(error.kind).toBe('bad-response');
  });

  it('za mało poprawnych pytań to błąd too-few-questions', async () => {
    const fetch = fakeFetch(jsonResponse(questionsResponse(generatedItems(MIN_QUESTIONS - 1)))).fetch;
    const error = await errorOf(generateQuestionSet(options({ fetch })));
    expect(error.kind).toBe('too-few-questions');
    expect(error.message).toContain(String(MIN_QUESTIONS - 1));
  });

  it('dokładnie minimalna liczba pytań wystarcza', async () => {
    const fetch = fakeFetch(jsonResponse(questionsResponse(generatedItems(MIN_QUESTIONS)))).fetch;
    expect((await generateQuestionSet(options({ fetch }))).questions).toHaveLength(MIN_QUESTIONS);
  });

  describe('limit czasu', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('zawieszone połączenie jest przerywane po REQUEST_TIMEOUT_MS → timeout', async () => {
      const promise = errorOf(generateQuestionSet(options({ fetch: hangingFetch() })));
      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      expect((await promise).kind).toBe('timeout');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('po udanej odpowiedzi nie zostaje licznik czasu', async () => {
      await generateQuestionSet(options());
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
