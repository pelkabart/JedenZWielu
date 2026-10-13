import { useEffect, useState, useSyncExternalStore } from 'react';

import { SoloController } from '@/game/controller/SoloController';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { createSoloGame } from '@/game/solo';
import type { Difficulty } from '@/game/types';

export function useSoloController(difficulty: Difficulty) {
  const [controller] = useState(() => {
    const rng = createRng(Date.now());
    const game = createSoloGame({ difficulty, humanName: 'Ty', questions: QUESTION_BANK, rng });
    return new SoloController({ game, rng, bank: QUESTION_BANK });
  });

  useEffect(() => {
    controller.start();
    return () => controller.pause();
  }, [controller]);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view };
}
