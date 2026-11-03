import { useEffect, useState, useSyncExternalStore } from 'react';

import { SoloController } from '@/game/controller/SoloController';
import { createRng } from '@/game/rng';
import { createSoloGame } from '@/game/solo';
import type { Difficulty, Question } from '@/game/types';
import { createLogger } from '@/lib/log';
import { assignSkins, genderLimits } from '@/skins/assignSkins';
import { skinSelectionStore } from '@/skins/selection';
import { skinCatalog } from '@/skins/skinAssets';

import { useNarration } from './useNarration';

const log = createLogger('gra-solo');
/** Ziarno skórek to ziarno gry z tą maską, więc przydział też da się odtworzyć. */
const SKIN_SEED_MASK = 0x5f3759df;

/** `questions` — pytania wybranej kategorii; te same trafiają do botów jako bank pomyłek. */
export function useSoloController(difficulty: Difficulty, questions: Question[]) {
  const [{ controller, skins }] = useState(() => {
    const seed = Date.now();
    const rng = createRng(seed);
    const game = createSoloGame({ difficulty, humanName: 'Ty', questions, rng, botLimits: genderLimits(skinCatalog) });
    // Ziarno pozwala odtworzyć dokładnie tę samą grę, jeśli na telefonie wyjdzie błąd.
    log.info('Nowa gra', { seed, difficulty, questions: questions.length, players: game.players.map((p) => p.id) });
    // Osobny generator: skórki nie mogą zmieniać przebiegu gry z danego ziarna.
    const skins = assignSkins(game.players, skinCatalog, skinSelectionStore.getSelected()?.id ?? null, createRng(seed ^ SKIN_SEED_MASK));
    return { controller: new SoloController({ game, rng, bank: questions, readQuestions: true }), skins };
  });

  useEffect(() => {
    controller.start();
    return () => controller.pause();
  }, [controller]);

  useNarration(controller);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view, skins };
}
