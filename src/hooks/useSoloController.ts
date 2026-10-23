import { useEffect, useState, useSyncExternalStore } from 'react';

import { SoloController } from '@/game/controller/SoloController';
import { createRng } from '@/game/rng';
import { createSoloGame } from '@/game/solo';
import type { Difficulty, Question } from '@/game/types';
import { createLogger } from '@/lib/log';

import { useNarration } from './useNarration';

const log = createLogger('gra-solo');

/** `questions` — pytania wybranej kategorii; te same trafiają do botów jako bank pomyłek. */
export function useSoloController(difficulty: Difficulty, questions: Question[]) {
  const [controller] = useState(() => {
    const seed = Date.now();
    const rng = createRng(seed);
    const game = createSoloGame({ difficulty, humanName: 'Ty', questions, rng });
    // Ziarno pozwala odtworzyć dokładnie tę samą grę, jeśli na telefonie wyjdzie błąd.
    log.info('Nowa gra', { seed, difficulty, questions: questions.length, players: game.players.map((p) => p.id) });
    return new SoloController({ game, rng, bank: questions, readQuestions: true });
  });

  useEffect(() => {
    controller.start();
    return () => controller.pause();
  }, [controller]);

  useNarration(controller);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view };
}
