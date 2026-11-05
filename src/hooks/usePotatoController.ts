import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { BOT_PROFILES } from '@/game/bots/profiles';
import { createRng } from '@/game/rng';
import { PotatoNarrator } from '@/narration/PotatoNarrator';
import { createSherpaVoice } from '@/narration/sherpaVoice';
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { createPotatoSoloGame } from '@/game/potato/solo';
import type { Difficulty, Question } from '@/game/types';
import { createLogger } from '@/lib/log';
import { assignSkins, availableBotSkins } from '@/skins/assignSkins';
import { skinSelectionStore } from '@/skins/selection';
import { skinCatalog } from '@/skins/skinAssets';

const log = createLogger('gra-solo');
/** Ziarno skórek to ziarno gry z tą maską, więc przydział też da się odtworzyć. */

/**
 * Gra solo w nowych zasadach (rundy 1–4) na pytaniach wybranej kategorii.
 * Zegary zatrzymują się przy odmontowaniu ekranu.
 */
export function usePotatoController(difficulty: Difficulty, questions: Question[]) {
  const [{ controller, skins }] = useState(() => {
    const seed = Date.now();
    const rng = createRng(seed);
    const availableSkinIds = availableBotSkins(skinCatalog);
    const game = createPotatoSoloGame({ humanName: 'Ty', questions, rng, availableSkinIds });
    // Ziarno pozwala odtworzyć dokładnie tę samą grę, jeśli na telefonie wyjdzie błąd.
    log.info('Nowa gra w rundach', {
      seed,
      difficulty,
      questions: questions.length,
      players: game.players.map((p) => p.id),
      botsWithSkin: BOT_PROFILES.filter((p) => availableSkinIds.has(p.skinId)).length,
    });
    const skins = assignSkins(game.players, skinCatalog, skinSelectionStore.getSelected()?.id ?? null);
    return { controller: new PotatoController({ game, difficulty, rng }), skins };
  });

  const narratorRef = useRef<PotatoNarrator | null>(null);

  useEffect(() => {
    let narrator: PotatoNarrator | null = null;
    try {
      narrator = new PotatoNarrator(controller, createSherpaVoice());
    } catch (error) {
      // Bez głosu da się grać, tylko cicho.
      log.error('Nie udało się uruchomić lektora', { error: error instanceof Error ? error.message : String(error) });
    }
    narratorRef.current = narrator;
    controller.start();
    return () => {
      narratorRef.current = null;
      controller.stop();
      narrator?.dispose();
    };
  }, [controller]);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  const silenceHost = () => narratorRef.current?.silence();
  return { controller, view, skins, silenceHost };
}
