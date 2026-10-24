import { ANSWER_TYPES, CATEGORIES, type AnswerType } from '@/game/types';

import type { FetchLike, FetchResponse } from '../openaiGenerator';
import type { TextStorage } from '../QuestionSetStore';
import type { SourceFile } from '../sourceFiles';

/** Zapis w pamięci zamiast pliku na telefonie. `failWrites` udaje pełny dysk. */
export class MemoryStorage implements TextStorage {
  failWrites = false;
  writes = 0;

  constructor(public text: string | null = null) {}

  async read() {
    return this.text;
  }

  async write(text: string) {
    if (this.failWrites) throw new Error('Brak miejsca na dysku');
    this.writes++;
    this.text = text;
  }
}

const ANSWERS: Record<AnswerType, (i: number) => { answers: string[]; wrongAnswers: string[] }> = {
  data: (i) => ({ answers: [String(1800 + i)], wrongAnswers: [] }),
  liczba: (i) => ({ answers: [String(10 + i)], wrongAnswers: [] }),
  osoba: (i) => ({ answers: [`Osoba numer ${i}`], wrongAnswers: [`Inna postać ${i}`, `Ktoś zupełnie inny ${i}`] }),
  miejsce: (i) => ({ answers: [`Miasto ${i}`, `Gród ${i}`], wrongAnswers: [`Wioska ${i + 1000}`] }),
  nazwa: (i) => ({ answers: [`Rzecz ${i}`], wrongAnswers: [] }),
};

/** Pytania w takiej postaci, w jakiej zwraca je model (schemat `QUESTION_SET_SCHEMA`). */
export function generatedItems(count: number, offset = 0) {
  return Array.from({ length: count }, (_, k) => {
    const i = k + offset;
    const answerType = ANSWER_TYPES[i % ANSWER_TYPES.length];
    return {
      category: CATEGORIES[i % CATEGORIES.length],
      question: `Wygenerowane pytanie numer ${i}?`,
      answerType,
      ...ANSWERS[answerType](i),
      difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    };
  });
}

/** Odpowiedź Responses API z tekstem w `output_text`. */
export function openAIResponse(text: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'resp_test',
    object: 'response',
    status: 'completed',
    output: [
      { type: 'reasoning', id: 'rs_1', summary: [] },
      { type: 'message', id: 'msg_1', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] },
    ],
    ...extra,
  };
}

export const questionsResponse = (items: unknown[]) => openAIResponse(JSON.stringify({ questions: items }));

export function jsonResponse(body: unknown, status = 200): FetchResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

export interface FakeFetchCall {
  url: string;
  init: Parameters<FetchLike>[1];
  body: Record<string, unknown>;
}

/** Atrapa `fetch`: zapisuje zapytania i zwraca kolejne odpowiedzi (ostatnia się powtarza). */
export function fakeFetch(...responses: (FetchResponse | Error)[]) {
  const calls: FakeFetchCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

/** `fetch`, który nie odpowiada, dopóki nie zostanie przerwany sygnałem. */
export function hangingFetch(): FetchLike {
  return (_url, init) =>
    new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
}

export function sourceFile(name = 'notatki.pdf', base64 = 'JVBERi0xLjQK'): SourceFile {
  return { name, mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'text/plain', base64 };
}
