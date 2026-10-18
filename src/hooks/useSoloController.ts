import { useEffect, useState, useSyncExternalStore } from 'react';

import { SoloController } from '@/game/controller/SoloController';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame } from '@/game/solo';
import type { Difficulty } from '@/game/types';
import { createLogger } from '@/lib/log';
import { QUESTION_AUDIO } from '@/narration/questionAudio';

import { useQuestionNarration } from './useQuestionNarration';

const log = createLogger('gra-solo');

export function useSoloController(difficulty: Difficulty) {
  const [controller] = useState(() => {
    const seed = Date.now();
    const rng = createRng(seed);
    const game = createSoloGame({ difficulty, humanName: 'Ty', questions: QUESTION_BANK, rng });
    // Ziarno pozwala odtworzyć dokładnie tę samą grę, jeśli na telefonie wyjdzie błąd.
    log.info('Nowa gra', { seed, difficulty, players: game.players.map((p) => p.id) });
    return new SoloController({ game, rng, bank: QUESTION_BANK, narrationMs: (q) => QUESTION_AUDIO.narrationMs(q) });
  });

  useEffect(() => {
    controller.start();
    return () => controller.pause();
  }, [controller]);

  useQuestionNarration(controller);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view };
}
