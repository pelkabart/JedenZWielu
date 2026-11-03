/**
 * Testy integracyjne: te same moduły, które składa `usePotatoController` w aplikacji —
 * prawdziwy folder skórek, wybór gracza, losowanie botów, przydział, sterownik i silnik —
 * na udawanym zegarze Jesta.
 */
import { getBotProfile } from '@/game/bots/profiles';
import { PotatoController } from '@/game/potato/controller/PotatoController';
import { activePlayers } from '@/game/potato/engine';
import { createPotatoSoloGame, HUMAN_ID } from '@/game/potato/solo';
import { QUESTION_BANK } from '@/game/questions';
import { createRng } from '@/game/rng';

import { assignSkins, genderLimits } from '../assignSkins';
import { buildCatalog, type Expression } from '../catalog';
import { podiumExpression } from '../expression';
import { SkinSelectionStore, type SkinStorage } from '../SkinSelectionStore';
import { diskSkinFiles } from '../testing/diskSkins';
import { skinFiles } from '../testing/fixtures';

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
  const game = createPotatoSoloGame({ humanName: 'Ty', questions: QUESTION_BANK, rng, botLimits: genderLimits(catalog) });
  const skins = assignSkins(game.players, catalog, null, createRng(seed + 1));
  return { game, rng, skins, catalog };
}

describe('skórki w całej grze', () => {
  it('prawdziwe skórki: każdy ma własną, zgodną z płcią, na wielu ziarnach', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { game, skins } = newGame(seed);
      const ids = game.players.map((p) => skins[p.id]?.id);
      expect(new Set(ids).size).toBe(game.players.length);
      for (const player of game.players) {
        expect(skins[player.id]?.pool).toBe(player.isHuman ? 'player' : getBotProfile(player.botId!).gender);
      }
    }
  });

  it('nowa skórka trafia do losowania bez zmian w kodzie', () => {
    const catalog = buildCatalog([...diskSkinFiles(), ...skinFiles('female', 'nowa')]);
    const used = new Set<string | undefined>();
    for (let seed = 0; seed < 200; seed++) {
      const { game, skins } = newGame(seed, catalog);
      game.players.forEach((p) => used.add(skins[p.id]?.id));
    }
    expect(used).toContain('female/nowa');
  });

  it('nowe skórki poluzowują limit: skład samych kobiet staje się możliwy', () => {
    const catalog = buildCatalog([...diskSkinFiles(), ...skinFiles('female', 'nowa')]);
    const onlyWomen = Array.from({ length: 2000 }, (_, seed) => newGame(seed, catalog)).some(({ game }) =>
      game.players.filter((p) => !p.isHuman).every((p) => getBotProfile(p.botId!).gender === 'female'),
    );
    expect(onlyWomen).toBe(true);
  });

  it('wybór gracza z magazynu trafia do gry', async () => {
    const catalog = buildCatalog([...diskSkinFiles(), ...skinFiles('player', 'nowy')]);
    const store = new SkinSelectionStore(memoryStorage(), catalog.player);
    await store.select('player/nowy');
    const { game } = newGame(1, catalog);
    const skins = assignSkins(game.players, catalog, store.getSelected()?.id ?? null, createRng(2));
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
      if (overlay?.kind === 'reveal') {
        const expression = podiumExpression({ kind: 'answer', correct: overlay.correct }, 'normal');
        expect(expression).toBe(overlay.correct ? 'smile' : 'closed-eyes');
        seen.add(expression);
        expect(skins[overlay.playerId]).toBeTruthy();
      } else if (awaitingPick) {
        const target = activePlayers(state).find((p) => awaitingPick.allowSelf || p.id !== awaitingPick.chooserId);
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
