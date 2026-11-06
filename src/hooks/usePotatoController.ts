import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { frameKey, LoadingGate } from '@/components/potato/loadingGate';
import { BOT_PROFILES } from '@/game/bots/profiles';
import { createRng } from '@/game/rng';
import { PotatoNarrator } from '@/narration/PotatoNarrator';
import { createSherpaVoice, prepareVoice } from '@/narration/sherpaVoice';
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { createPotatoSoloGame } from '@/game/potato/solo';
import type { Difficulty, Question } from '@/game/types';
import { createLogger } from '@/lib/log';
import { assignSkins, availableBotSkins } from '@/skins/assignSkins';
import { skinSelectionStore } from '@/skins/selection';
import { EXPRESSIONS } from '@/skins/catalog';
import { skinCatalog } from '@/skins/skinAssets';

const log = createLogger('gra-solo');
/** Id prowadzącego w kluczach klatek ekranu ładowania. */
export const HOST_LOAD_ID = 'host';

/**
 * Gra solo w nowych zasadach (rundy 1–4) na pytaniach wybranej kategorii.
 * Gra rusza dopiero po ekranie ładowania (skórki i lektor). Zegary zatrzymują się przy odmontowaniu ekranu.
 */
export function usePotatoController(difficulty: Difficulty, questions: Question[]) {
  const [{ controller, skins, gate }] = useState(() => {
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
    // Ekran ładowania czeka na wszystkie klatki postaci przy stole i prowadzącego.
    const owners = [...game.players.filter((p) => skins[p.id]).map((p) => p.id), ...(skinCatalog.host ? [HOST_LOAD_ID] : [])];
    const gate = new LoadingGate(owners.flatMap((id) => EXPRESSIONS.map((frame) => frameKey(id, frame))));
    return { controller: new PotatoController({ game, difficulty, rng }), skins, gate };
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
    void prepareVoice()
      .catch(() => false)
      .then(() => gate.voiceReady());
    // Sterownik rusza dopiero po ekranie ładowania (bramka zgłasza gotowość raz).
    const startWhenReady = () => {
      if (gate.getState().ready) controller.start();
    };
    const unsubscribe = gate.subscribe(startWhenReady);
    gate.start();
    startWhenReady();
    return () => {
      unsubscribe();
      gate.stop();
      narratorRef.current = null;
      controller.stop();
      narrator?.dispose();
    };
  }, [controller, gate]);

  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  const loading = useSyncExternalStore(gate.subscribe, gate.getState);
  const silenceHost = () => narratorRef.current?.silence();
  return { controller, view, skins, silenceHost, loading, onFrameLoad: gate.imageLoaded };
}
