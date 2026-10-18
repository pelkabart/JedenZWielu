import { useEffect } from 'react';

import { createLogger } from '@/lib/log';
import { NarrationDirector, type ViewSource } from '@/narration/NarrationDirector';
import { createSherpaVoice } from '@/narration/sherpaVoice';

const log = createLogger('lektor');

/** Głos prowadzącego w tej grze; po opuszczeniu ekranu cichnie i zwalnia odtwarzacz. */
export function useNarration(views: ViewSource) {
  useEffect(() => {
    let director: NarrationDirector;
    try {
      director = new NarrationDirector(views, createSherpaVoice());
    } catch (error) {
      // Bez głosu da się grać — pauzy mają wtedy domyślną długość.
      log.error('Nie udało się uruchomić lektora', { error: error instanceof Error ? error.message : String(error) });
      return;
    }
    return () => director.dispose();
  }, [views]);
}
