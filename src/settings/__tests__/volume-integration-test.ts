/**
 * Testy integracyjne głośności: te same moduły co aplikacja — prawdziwy magazyn głośności
 * (plik udawany w pamięci), prawdziwa muzyka menu i gry, wyciszenie i podpięcie lektora.
 * Atrapa jest tylko w miejscu odtwarzacza `expo-audio` (natywny moduł).
 */
import { MemoryStorage } from '@/categories/testing/fakes';
import { getLogEntries, resetLog } from '@/lib/log';

import { VolumeStore } from '../VolumeStore';

interface FakePlayer {
  volume: number;
  loop: boolean;
  playing: boolean;
  play(): void;
  pause(): void;
}

const players: FakePlayer[] = [];

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => {
    const player = {
      volume: 1,
      loop: false,
      playing: false,
      play() {
        player.playing = true;
      },
      pause() {
        player.playing = false;
      },
    };
    players.push(player);
    return player;
  },
}));

let file: MemoryStorage;

jest.mock('@/settings/volume', () => {
  const { VolumeStore: Store } = jest.requireActual('../VolumeStore');
  const { MemoryStorage: Storage } = jest.requireActual('@/categories/testing/fakes');
  return {
    get volumeStore() {
      return (globalThis as { __volumeStore?: unknown }).__volumeStore ?? new Store(new Storage());
    },
  };
});

type AudioModules = {
  store: VolumeStore;
  menu: typeof import('@/audio/menuMusic');
  game: typeof import('@/audio/gameMusic');
  mute: typeof import('@/audio/musicMute');
  volume: typeof import('@/audio/volume');
};

/** Jedno „uruchomienie gry”: świeże moduły audio i magazyn czytający ten sam plik. */
function launch(storage: MemoryStorage): AudioModules {
  players.length = 0;
  const store = new VolumeStore(storage);
  (globalThis as { __volumeStore?: unknown }).__volumeStore = store;
  let modules!: AudioModules;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports -- świeże moduły audio w każdym „uruchomieniu” */
    modules = {
      store,
      menu: require('@/audio/menuMusic'),
      game: require('@/audio/gameMusic'),
      mute: require('@/audio/musicMute'),
      volume: require('@/audio/volume'),
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return modules;
}

beforeEach(() => {
  jest.useFakeTimers();
  resetLog();
  file = new MemoryStorage();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('głośność w całej aplikacji', () => {
  it('domyślnie 100%: dotychczasowe poziomy muzyki i lektora', async () => {
    const app = launch(file);
    await app.store.load();
    app.menu.acquireMenuMusic();
    app.game.startGameMusic();
    const [menuPlayer, gamePlayer] = players;
    const voice = { volume: -1 };
    app.volume.bindVoiceVolume(voice, app.store);

    expect(menuPlayer.volume).toBeCloseTo(0.3);
    expect(gamePlayer.volume).toBeCloseTo(0.22);
    expect(voice.volume).toBe(1);
  });

  it('zmiana głośności od razu zmienia muzykę menu, gry i lektora', async () => {
    const app = launch(file);
    await app.store.load();
    app.menu.acquireMenuMusic();
    app.game.startGameMusic();
    const [menuPlayer, gamePlayer] = players;
    const voice = { volume: -1 };
    app.volume.bindVoiceVolume(voice, app.store);

    app.store.preview('music', 50);
    expect(menuPlayer.volume).toBeCloseTo(0.15);
    expect(gamePlayer.volume).toBeCloseTo(0.11);
    expect(voice.volume).toBe(1);

    app.game.setGameMusicDucked(true);
    expect(gamePlayer.volume).toBeCloseTo(0.033);

    await app.store.set('voice', 25);
    expect(voice.volume).toBeCloseTo(0.25);
    expect(menuPlayer.volume).toBeCloseTo(0.15);
  });

  it('wyciszenie przyciskiem i suwak działają razem', async () => {
    const app = launch(file);
    await app.store.load();
    app.menu.acquireMenuMusic();
    const [menuPlayer] = players;

    app.mute.toggleMusicMuted();
    expect(menuPlayer.volume).toBe(0);
    app.store.preview('music', 70);
    expect(menuPlayer.volume).toBe(0);
    app.mute.toggleMusicMuted();
    expect(menuPlayer.volume).toBeCloseTo(0.21);
  });

  it('po ponownym uruchomieniu głośność z pliku', async () => {
    const first = launch(file);
    await first.store.load();
    await first.store.set('music', 20);
    await first.store.set('voice', 60);

    const second = launch(file);
    second.menu.acquireMenuMusic();
    const [menuPlayer] = players;
    // Muzyka startuje przed wczytaniem pliku; po wczytaniu głośność od razu się poprawia.
    await second.store.load();
    expect(second.store.getSettings()).toEqual({ music: 20, voice: 60 });
    expect(menuPlayer.volume).toBeCloseTo(0.06);

    second.game.startGameMusic();
    expect(players[1].volume).toBeCloseTo(0.044);
    const voice = { volume: -1 };
    second.volume.bindVoiceVolume(voice, second.store);
    expect(voice.volume).toBeCloseTo(0.6);
  });

  it('nieudany zapis nie psuje dźwięku; logi bez stanu gry', async () => {
    file.failWrites = true;
    const app = launch(file);
    app.menu.acquireMenuMusic();
    await app.store.set('music', 0);
    expect(players[0].volume).toBe(0);
    expect(app.store.didSaveFail()).toBe(true);
    expect(getLogEntries().some((e) => e.level === 'error' && e.tag === 'ustawienia')).toBe(true);
  });
});
