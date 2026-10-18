import { createLogger } from '@/lib/log';

import type { Recognizer, RecognizerEvent } from './VoiceAnswerSession';

const log = createLogger('mikrofon');

let recognizerPromise: Promise<Recognizer | null> | null = null;

/**
 * Rozpoznawanie mowy Androida przez `expo-speech-recognition`. Moduł natywny ładujemy dopiero tu:
 * w Expo Go go nie ma, a gra ma wtedy działać z samym wpisywaniem. `null` = rozpoznawanie niedostępne.
 */
export function loadRecognizer(): Promise<Recognizer | null> {
  recognizerPromise ??= (async () => {
    try {
      const { ExpoSpeechRecognitionModule: speech } = await import('expo-speech-recognition');
      if (!speech.isRecognitionAvailable()) {
        log.info('Rozpoznawanie mowy niedostępne na tym urządzeniu');
        return null;
      }
      const recognizer: Recognizer = {
        requestPermission: async () => (await speech.requestPermissionsAsync()).granted,
        start: () => speech.start({ lang: 'pl-PL', interimResults: true, maxAlternatives: 5, continuous: false }),
        stop: () => speech.stop(),
        abort: () => speech.abort(),
        onEvent(listener: (event: RecognizerEvent) => void) {
          const subscriptions = [
            speech.addListener('result', (e) =>
              listener({ type: 'result', transcripts: e.results.map((r) => r.transcript), isFinal: e.isFinal }),
            ),
            speech.addListener('nomatch', () => listener({ type: 'error', code: 'nomatch', message: '' })),
            speech.addListener('error', (e) => listener({ type: 'error', code: e.error, message: e.message })),
            speech.addListener('end', () => listener({ type: 'end' })),
          ];
          return () => subscriptions.forEach((s) => s.remove());
        },
      };
      return recognizer;
    } catch (error) {
      log.info('Brak modułu rozpoznawania mowy (np. Expo Go)', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  })();
  return recognizerPromise;
}
