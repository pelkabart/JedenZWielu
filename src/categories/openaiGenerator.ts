import { ANSWER_TYPES, CATEGORIES, type Question } from '@/game/types';
import { createLogger } from '@/lib/log';

import { CategoryError, type CategoryErrorKind } from './errors';
import { sanitizeGeneratedQuestions } from './generatedQuestions';
import { MAX_SOURCE_FILES, type SourceFile } from './sourceFiles';

export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
export const OPENAI_MODEL = 'gpt-6.1-sol';
export const QUESTIONS_TO_REQUEST = 60;
/** Mniej poprawnych pytań nie wystarczy na sensowną grę (gra zużywa ich kilkadziesiąt). */
export const MIN_QUESTIONS = 20;
export const REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
/** Komunikat, gdy w ustawieniach nie ma klucza; odsyła gracza do ekranu „Ustawienia”. */
export const NO_API_KEY_MESSAGE = 'Brak klucza API OpenAI. Dodaj go w Ustawieniach (zębatka na ekranie głównym).';
const MAX_OUTPUT_TOKENS = 32_000;

const log = createLogger('openai');

/** Tyle z `fetch`, ile potrzebujemy — w testach podstawiamy atrapę. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<FetchResponse>;

export interface GenerateOptions {
  apiKey: string;
  files: SourceFile[];
  setName: string;
  /** Prefiks id pytań. */
  setId: string;
  fetch?: FetchLike;
  model?: string;
  timeoutMs?: number;
}

/** Schemat Structured Outputs: pola i wartości dokładnie takie, jakie przyjmuje `parseQuestion`. */
export const QUESTION_SET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'question', 'answers', 'answerType', 'wrongAnswers', 'difficulty'],
        properties: {
          category: { type: 'string', enum: [...CATEGORIES], description: 'Dziedzina pytania.' },
          question: { type: 'string', description: 'Treść pytania po polsku, zrozumiała bez znajomości plików.' },
          answers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Akceptowane odpowiedzi; pierwsza jest główna. Krótkie: 1–4 słowa.',
          },
          answerType: { type: 'string', enum: [...ANSWER_TYPES] },
          wrongAnswers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Wiarygodne błędne odpowiedzi tego samego rodzaju (dla botów). Dla dat i liczb pusta tablica.',
          },
          difficulty: { type: 'integer', enum: [1, 2, 3] },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = `Jesteś redaktorem teleturnieju wiedzy „Jeden z Wielu” (wzorowanego na „Jednym z dziesięciu”).
Na podstawie załączonych plików przygotowujesz pytania po polsku. Gracze NIE wybierają z odpowiedzi A–D: wpisują albo mówią odpowiedź sami, więc:
- odpowiedź musi być krótka i jednoznaczna (nazwisko, nazwa, miejsce, rok, liczba), najlepiej 1–4 słowa;
- w "answers" podaj wszystkie rozsądne zapisy tej samej odpowiedzi (np. "Mikołaj Kopernik", "Kopernik"), pierwsza jest główna;
- "answerType": "data" dla roku, "liczba" dla innej liczby (wtedy pierwsza odpowiedź to sama liczba całkowita cyframi, bez jednostek), "osoba", "miejsce" albo "nazwa";
- "wrongAnswers": 2–3 wiarygodne pomyłki tego samego rodzaju, wyraźnie różne od poprawnej; dla dat i liczb pusta tablica;
- "difficulty": 1 łatwe, 2 średnie, 3 trudne – mieszaj poziomy;
- "category": dziedzina, która najlepiej pasuje do pytania.
Każde pytanie musi mieć odpowiedź wynikającą z treści plików, być zrozumiałe samo w sobie (bez zwrotów typu „w tekście”, „według dokumentu”) i nie powtarzać innych pytań.`;

function userPrompt(setName: string) {
  return `Kategoria: „${setName}”. Przygotuj ${QUESTIONS_TO_REQUEST} różnych pytań na podstawie załączonych plików. Jeśli materiału jest mniej, przygotuj tyle dobrych pytań, ile się da.`;
}

function requestBody(files: SourceFile[], setName: string, model: string) {
  return {
    model,
    store: false,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      { role: 'system', content: INSTRUCTIONS },
      {
        role: 'user',
        content: [
          ...files.map((f) => ({ type: 'input_file', filename: f.name, file_data: `data:${f.mimeType};base64,${f.base64}` })),
          { type: 'input_text', text: userPrompt(setName) },
        ],
      },
    ],
    text: { format: { type: 'json_schema', name: 'question_set', strict: true, schema: QUESTION_SET_SCHEMA } },
  };
}

const HTTP_ERRORS: { test: (status: number) => boolean; kind: CategoryErrorKind; message: string }[] = [
  { test: (s) => s === 401 || s === 403, kind: 'auth', message: 'OpenAI odrzuciło klucz API. Sprawdź w Ustawieniach, czy jest poprawny i aktywny.' },
  { test: (s) => s === 429, kind: 'rate-limit', message: 'Przekroczono limit zapytań albo środków na koncie OpenAI. Spróbuj później.' },
  { test: (s) => s >= 500, kind: 'server', message: 'Serwery OpenAI mają problem. Spróbuj ponownie za chwilę.' },
];

function httpError(status: number): CategoryError {
  const known = HTTP_ERRORS.find((e) => e.test(status));
  return known
    ? new CategoryError(known.kind, known.message)
    : new CategoryError('bad-response', `OpenAI nie przyjęło zapytania (błąd ${status}). Spróbuj z innymi plikami.`);
}

const badResponse = () => new CategoryError('bad-response', 'OpenAI zwróciło odpowiedź w nieoczekiwanym formacie. Spróbuj ponownie.');

type OutputContent = { type?: string; text?: unknown; refusal?: unknown };

/** Wyciąga tekst z odpowiedzi Responses API (`output[].content[]`). */
function outputText(body: unknown): string {
  if (typeof body !== 'object' || body === null) throw badResponse();
  const { status, output } = body as { status?: unknown; output?: unknown };
  if (status === 'incomplete') {
    throw new CategoryError('incomplete', 'Odpowiedź OpenAI została ucięta. Spróbuj z mniejszą liczbą plików.');
  }
  if (!Array.isArray(output)) throw badResponse();
  const contents: OutputContent[] = output.flatMap((item: { type?: string; content?: unknown }) =>
    item?.type === 'message' && Array.isArray(item.content) ? item.content : [],
  );
  if (contents.some((c) => c?.type === 'refusal')) {
    throw new CategoryError('refused', 'Model odmówił przygotowania pytań z tych plików.');
  }
  const text = contents.find((c) => c?.type === 'output_text' && typeof c.text === 'string')?.text;
  if (typeof text !== 'string') throw badResponse();
  return text;
}

/** Wysyła pliki do OpenAI i zwraca sprawdzone pytania. Każdy problem to `CategoryError`. */
export async function generateQuestionSet(options: GenerateOptions): Promise<{ questions: Question[]; rejected: number }> {
  const { apiKey, files, setName, setId, model = OPENAI_MODEL, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const fetchFn: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));

  if (apiKey.trim() === '') throw new CategoryError('no-api-key', NO_API_KEY_MESSAGE);
  if (files.length === 0 || files.length > MAX_SOURCE_FILES) {
    throw new CategoryError('files', `Wybierz od 1 do ${MAX_SOURCE_FILES} plików.`);
  }

  log.info('Wysyłam pliki do OpenAI', { files: files.length, model });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: FetchResponse;
    try {
      response = await fetchFn(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody(files, setName, model)),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new CategoryError('timeout', 'OpenAI nie odpowiedziało w ciągu 3 minut. Spróbuj z mniejszymi plikami.');
      }
      throw new CategoryError('network', 'Brak połączenia z OpenAI. Sprawdź internet.');
    }
    if (!response.ok) throw httpError(response.status);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw badResponse();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText(body));
    } catch (error) {
      throw error instanceof CategoryError ? error : badResponse();
    }

    const { questions, rejected } = sanitizeGeneratedQuestions(parsed, setId);
    log.info('Wygenerowano pytania', { accepted: questions.length, rejected });
    if (questions.length < MIN_QUESTIONS) {
      throw new CategoryError(
        'too-few-questions',
        `Za mało pytań: z plików powstało ${questions.length} poprawnych, potrzeba co najmniej ${MIN_QUESTIONS}. Dodaj więcej materiału.`,
      );
    }
    return { questions, rejected };
  } catch (error) {
    const kind = error instanceof CategoryError ? error.kind : 'unknown';
    log.warn('Nie udało się wygenerować pytań', { kind });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
