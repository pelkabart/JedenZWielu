import { useEffect, useRef, useState } from 'react';

import type { Question } from '@/game/types';
import { loadRecognizer } from '@/speech/expoRecognizer';
import { VoiceAnswerSession, type VoiceAnswerCallbacks } from '@/speech/VoiceAnswerSession';

type Callbacks = Pick<VoiceAnswerCallbacks, 'onTranscript' | 'onAnswer' | 'onListening'>;

/**
 * Odpowiadanie głosem na jedno pytanie. `available` = telefon ma rozpoznawanie mowy
 * (w Expo Go i na emulatorze bez usług Google przycisk się nie pokazuje).
 */
export function useVoiceAnswer(question: Question, paused: boolean, callbacks: Callbacks) {
  const [session, setSession] = useState<VoiceAnswerSession | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Najnowsze funkcje z panelu — sesja żyje dłużej niż jeden render.
  const latest = useRef(callbacks);
  useEffect(() => {
    latest.current = callbacks;
  });

  useEffect(() => {
    let cancelled = false;
    let created: VoiceAnswerSession | null = null;
    void loadRecognizer().then((recognizer) => {
      if (cancelled || !recognizer) return;
      created = new VoiceAnswerSession(recognizer, question, {
        onTranscript: (text) => latest.current.onTranscript(text),
        onAnswer: (text) => latest.current.onAnswer(text),
        onListening: (on) => {
          setListening(on);
          latest.current.onListening(on);
        },
        onMessage: setMessage,
      });
      setSession(created);
    });
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [question]);

  useEffect(() => {
    if (paused) session?.cancel();
  }, [paused, session]);

  const toggle = () => {
    if (!session) return;
    if (session.isListening) session.stop();
    else void session.start();
  };

  return { available: session !== null, listening, message, toggle };
}
