import manifest from '@/assets/audio/questions/manifest.json';
import type { Question } from '@/game/types';
import { createLogger } from '@/lib/log';

import { QUESTION_AUDIO_SOURCES } from './questionAudioSources';

const log = createLogger('lektor');

/**
 * Odtwarzacz na telefonie startuje z małym opóźnieniem, więc licznik rusza chwilę po końcu nagrania,
 * żeby ostatnie słowo nie nakładało się z odliczaniem.
 */
export const NARRATION_TAIL_MS = 400;

export interface QuestionAudio {
  /** Plik dołączony do aplikacji (wynik `require`). */
  source: number;
  durationMs: number;
  /** Tekst, z którego powstało nagranie. */
  text: string;
}

export interface AudioManifest {
  questions: Record<string, { text: string; durationMs: number }>;
}

/** Nagrania pytań wygenerowane Piperem (`scripts/narration/generate_question_audio.py`). */
export class AudioCatalog {
  private readonly entries: Map<string, QuestionAudio>;
  /** Ostrzegamy raz na pytanie, a nie przy każdym jego losowaniu. */
  private readonly warned = new Set<string>();

  constructor(manifest: AudioManifest, sources: Record<string, number>) {
    this.entries = new Map();
    for (const [id, { text, durationMs }] of Object.entries(manifest.questions)) {
      const source = sources[id];
      if (source === undefined || !(durationMs > 0)) {
        log.warn('Pominięto niepełny wpis nagrania', { questionId: id, hasSource: source !== undefined, durationMs });
        continue;
      }
      this.entries.set(id, { source, durationMs, text });
    }
  }

  get size() {
    return this.entries.size;
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }

  /** Nagranie pytania; `undefined`, gdy go nie ma albo powstało ze starej treści pytania. */
  audioFor(question: Question): QuestionAudio | undefined {
    const audio = this.entries.get(question.id);
    return audio && audio.text === question.question ? audio : undefined;
  }

  /** Jak długo sterownik czeka na lektora; 0 = gra bez czytania tego pytania. */
  narrationMs(question: Question): number {
    const audio = this.audioFor(question);
    if (audio) return audio.durationMs + NARRATION_TAIL_MS;
    if (!this.warned.has(question.id)) {
      this.warned.add(question.id);
      const reason = this.entries.has(question.id) ? 'nagranie ze starej treści' : 'brak nagrania';
      log.warn('Pytanie zostanie pokazane bez lektora', { questionId: question.id, reason });
    }
    return 0;
  }
}

export const QUESTION_AUDIO = new AudioCatalog(manifest, QUESTION_AUDIO_SOURCES);
