import { useEffect } from 'react';

import { createLogger } from '@/lib/log';
import { createExpoNarrationPlayer } from '@/narration/expoNarrationPlayer';
import { NarrationDirector, type ViewSource } from '@/narration/NarrationDirector';

const log = createLogger('lektor');

/** Lektor czyta pytania tej gry; po opuszczeniu ekranu cichnie i zwalnia odtwarzacz. */
export function useQuestionNarration(views: ViewSource) {
  useEffect(() => {
    let director: NarrationDirector;
    try {
      director = new NarrationDirector(views, createExpoNarrationPlayer());
    } catch (error) {
      // Bez dźwięku da się grać — sterownik i tak odmierza czas czytania.
      log.error('Nie udało się uruchomić lektora', { error: error instanceof Error ? error.message : String(error) });
      return;
    }
    return () => director.dispose();
  }, [views]);
}
