/**
 * Testy integracyjne: te same moduły, które składa `usePotatoController` w aplikacji —
 * prawdziwy folder skórek, wybór gracza, losowanie botów, przydział, sterownik i silnik —
 * na udawanym zegarze Jesta.
 */
import { BOT_PROFILES, getBotProfile } from '@/game/bots/profiles';
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { activePlayers } from '@/game/potato/engine';
import { createPotatoSoloGame, HUMAN_ID } from '@/game/potato/solo';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';

import { assignSkins, availableBotSkins } from '../assignSkins';
import { buildCatalog, type Expression } from '../catalog';
import { podiumExpression } from '../expression';
import { SkinSelectionStore, type SkinStorage } from '../SkinSelectionStore';
import { diskSkinFiles } from '../testing/diskSkins';
import { botSkinFiles, skinFiles } from '../testing/fixtures';

const STEP_MS = 100;
const MAX_GAME_MS = 2 * 60 * 60 * 1000;

const memoryStorage = (): SkinStorage => {
  let text: string | null = null;
  return {
    read: async () => text,
    write: async (value) => {
      text = value;
    },
  };
};

function newGame(seed: number, catalog = buildCatalog(diskSkinFiles())) {
  const rng = createRng(seed);
  const game = createPotatoSoloGame({ humanName: 'Ty', questions: QUESTION_BANK, rng, availableSkinIds: availableBotSkins(catalog) });
  const skins = assignSkins(game.players, catalog, null);
  return { game, rng, skins, catalog };
}

describe('skórki w całej grze', () => {
  it('prawdziwe skórki: każdy ma własną, a bot zawsze tę z profilu, na wielu ziarnach', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { game, skins } = newGame(seed);
      const ids = game.players.map((p) => skins[p.id]?.id);
      expect(new Set(ids).size).toBe(game.players.length);
      for (const player of game.players) {
        if (player.isHuman) expect(skins[player.id]?.pool).toBe('player');
        else expect(skins[player.id]?.id).toBe(getBotProfile(player.botId!).skinId);
      }
    }
  });

  it('dodanie plików skórki wprowadza jej bota do losowania bez zmian w kodzie', () => {
    const [newcomer, ...others] = BOT_PROFILES;
    const drawn = (catalog: ReturnType<typeof buildCatalog>) => {
      const ids = new Set<string>();
      for (let seed = 0; seed < 200; seed++) newGame(seed, catalog).game.players.forEach((p) => ids.add(p.id));
      return ids;
    };
    const rest = others.slice(0, 6);
    expect(drawn(buildCatalog([...botSkinFiles(rest), ...skinFiles('player', '201')]))).not.toContain(newcomer.id);
    expect(drawn(buildCatalog([...botSkinFiles([newcomer, ...rest]), ...skinFiles('player', '201')]))).toContain(newcomer.id);
  });

  it('ten sam bot ma tę samą skórkę w każdej grze', () => {
    const catalog = buildCatalog([...botSkinFiles(BOT_PROFILES), ...skinFiles('player', '201')]);
    const skinOf = new Map<string, string | undefined>();
    for (let seed = 0; seed < 300; seed++) {
      const { game, skins } = newGame(seed, catalog);
      for (const player of game.players) {
        if (!skinOf.has(player.id)) skinOf.set(player.id, skins[player.id]?.id);
        expect(skins[player.id]?.id).toBe(skinOf.get(player.id));
      }
    }
  });

  it('wybór gracza z magazynu trafia do gry', async () => {
    const catalog = buildCatalog([...diskSkinFiles(), ...skinFiles('player', 'nowy')]);
    const store = new SkinSelectionStore(memoryStorage(), catalog.player);
    await store.select('player/nowy');
    const { game } = newGame(1, catalog);
    const skins = assignSkins(game.players, catalog, store.getSelected()?.id ?? null);
    expect(skins[HUMAN_ID]?.id).toBe('player/nowy');
  });

  it('cała gra: mimika odpowiada wynikom odpowiedzi, a przydział się nie zmienia', () => {
    jest.useFakeTimers();
    const { game, rng, skins } = newGame(11);
    const controller = new PotatoController({ game, difficulty: 'normal', rng });
    const assigned = { ...skins };
    const seen = new Set<Expression>();

    controller.start();
    for (let elapsed = 0; elapsed < MAX_GAME_MS && controller.getView().overlay?.kind !== 'finished'; elapsed += STEP_MS) {
      const view = controller.getView();
      const { overlay, awaitingPick, game: state } = view;
      if (overlay?.kind === 'round') {
        controller.acceptRound();
      } else if (overlay?.kind === 'reveal') {
        const expression = podiumExpression({ kind: 'answer', correct: overlay.correct }, 'normal');
        expect(expression).toBe(overlay.correct ? 'smile' : 'closed-eyes');
        seen.add(expression);
        expect(skins[overlay.playerId]).toBeTruthy();
      } else if (awaitingPick) {
        const target = activePlayers(state).find((p) => p.id !== awaitingPick.chooserId);
        controller.pick(target!.id);
      } else if (overlay === null && state.question && state.holderId === HUMAN_ID) {
        controller.submitAnswer(state.question.answers[0]);
      }
      jest.advanceTimersByTime(STEP_MS);
    }

    const final = controller.getView();
    controller.stop();
    jest.useRealTimers();

    expect(final.overlay?.kind).toBe('finished');
    expect(seen).toContain('smile');
    expect(skins).toEqual(assigned);
    expect(final.game.players.every((p) => skins[p.id])).toBe(true);
  });
});
