import { useEffect, useState, useSyncExternalStore } from 'react';

import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { createPotatoSoloGame } from '@/game/potato/solo';
import type { Difficulty } from '@/game/types';
import { createLogger } from '@/lib/log';

const log = createLogger('gra-solo');

/** Gra solo w nowych zasadach (rundy 1–4). Zegary zatrzymują się przy odmontowaniu ekranu. */
export function usePotatoController(difficulty: Difficulty) {
  const [controller] = useState(() => {
    const seed = Date.now();
    const rng = createRng(seed);
    const game = createPotatoSoloGame({ humanName: 'Ty', questions: QUESTION_BANK, rng });
    // Ziarno pozwala odtworzyć dokładnie tę samą grę, jeśli na telefonie wyjdzie błąd.
    log.info('Nowa gra w rundach', { seed, difficulty, players: game.players.map((p) => p.id) });
    return new PotatoController({ game, difficulty, rng });
  });

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view };
}
