import { useEffect, useState, useSyncExternalStore } from 'react';

import { createRng } from '@/game/rng';
import { PotatoNarrator } from '@/narration/PotatoNarrator';
import { createSherpaVoice } from '@/narration/sherpaVoice';
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { createPotatoSoloGame } from '@/game/potato/solo';
import type { Difficulty, Question } from '@/game/types';
import { createLogger } from '@/lib/log';
import { assignSkins, genderLimits } from '@/skins/assignSkins';
import { skinSelectionStore } from '@/skins/selection';
import { skinCatalog } from '@/skins/skinAssets';

const log = createLogger('gra-solo');
/** Ziarno skórek to ziarno gry z tą maską, więc przydział też da się odtworzyć. */
const SKIN_SEED_MASK = 0x5f3759df;

/**
 * Gra solo w nowych zasadach (rundy 1–4) na pytaniach wybranej kategorii.
 * Zegary zatrzymują się przy odmontowaniu ekranu.
 */
export function usePotatoController(difficulty: Difficulty, questions: Question[]) {
  const [{ controller, skins }] = useState(() => {
    const seed = Date.now();
    const rng = createRng(seed);
    const game = createPotatoSoloGame({ humanName: 'Ty', questions, rng, botLimits: genderLimits(skinCatalog) });
    // Ziarno pozwala odtworzyć dokładnie tę samą grę, jeśli na telefonie wyjdzie błąd.
    log.info('Nowa gra w rundach', { seed, difficulty, questions: questions.length, players: game.players.map((p) => p.id) });
    // Osobny generator: skórki nie mogą zmieniać przebiegu gry z danego ziarna.
    const skins = assignSkins(game.players, skinCatalog, skinSelectionStore.getSelected()?.id ?? null, createRng(seed ^ SKIN_SEED_MASK));
    return { controller: new PotatoController({ game, difficulty, rng }), skins };
  });

  useEffect(() => {
    let narrator: PotatoNarrator | null = null;
    try {
      narrator = new PotatoNarrator(controller, createSherpaVoice());
    } catch (error) {
      // Bez głosu da się grać, tylko cicho.
      log.error('Nie udało się uruchomić lektora', { error: error instanceof Error ? error.message : String(error) });
    }
    controller.start();
    return () => {
      controller.stop();
      narrator?.dispose();
    };
  }, [controller]);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  return { controller, view, skins };
}
