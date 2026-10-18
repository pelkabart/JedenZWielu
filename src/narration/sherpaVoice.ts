import { createAudioPlayer } from 'expo-audio';
import Constants from 'expo-constants';
import type { GeneratedAudio, TtsEngine } from 'react-native-sherpa-onnx/tts';

import { createLogger } from '@/lib/log';

import type { Voice } from './NarrationDirector';
import { toSpeakable } from './pronunciation';

const log = createLogger('lektor');

/**
 * Folder z modelem w zasobach aplikacji. Nazwę z wersją modelu (np. `models/vits-piper-pl-976a80a8`)
 * nadaje wtyczka plugins/withVoiceModel.js i przekazuje ją przez `extra` w konfiguracji.
 */
const VOICE_MODEL_ASSET: string | null = Constants.expoConfig?.extra?.voiceModelAsset ?? null;
/** Pliki tymczasowe z syntezy krążą po kilku nazwach — gra jeden, następny się liczy, przerwane mogą jeszcze się dopisywać. */
const TEMP_FILES = 6;

/** Moduły natywne (sherpa-onnx, react-native-fs) — w Expo Go ich nie ma, więc ładujemy je dopiero tu. */
interface NativeTts {
  engine: TtsEngine;
  cacheDir: string;
  saveAudioToFile: (audio: GeneratedAudio, path: string) => Promise<string>;
}

let enginePromise: Promise<NativeTts | null> | null = null;
/** Synteza po kolei: jeden silnik nie powinien liczyć dwóch zdań naraz. */
let synthQueue: Promise<unknown> = Promise.resolve();
let tempCounter = 0;

/**
 * Silnik syntezy wczytywany raz (model ma ok. 60 MB) i trzymany do końca działania aplikacji.
 * Moduł natywny ładujemy dopiero tu: w Expo Go go nie ma, a gra ma wtedy działać bez głosu.
 */
function loadEngine(): Promise<NativeTts | null> {
  enginePromise ??= (async () => {
    const started = Date.now();
    try {
      if (!VOICE_MODEL_ASSET) throw new Error('Brak modelu głosu w konfiguracji (voiceModelAsset)');
      const { createTTS, saveAudioToFile } = await import('react-native-sherpa-onnx/tts');
      const fs = await import('@dr.pogodin/react-native-fs');
      // sherpa-onnx kopiuje model z zasobów do plików aplikacji (DocumentDirectoryPath) tylko raz.
      const copied = `${fs.DocumentDirectoryPath}/${VOICE_MODEL_ASSET}`;
      await removeOldModels(fs, copied);
      const create = () =>
        createTTS({ modelPath: { type: 'asset', path: VOICE_MODEL_ASSET }, modelType: 'vits', numThreads: 2 });
      let engine: TtsEngine;
      try {
        engine = await create();
      } catch (error) {
        // Np. kopiowanie przerwane przy poprzednim uruchomieniu — kasujemy niepełną kopię i próbujemy raz jeszcze.
        log.warn('Model głosu nie wczytał się, kopiuję go od nowa', { error: error instanceof Error ? error.message : String(error) });
        await fs.unlink(copied).catch(() => undefined);
        engine = await create();
      }
      log.info('Model głosu wczytany', { ms: Date.now() - started, model: VOICE_MODEL_ASSET });
      return { engine, cacheDir: fs.CachesDirectoryPath, saveAudioToFile };
    } catch (error) {
      // Logujemy raz; potem prowadzący po prostu milczy.
      log.error('Nie udało się wczytać modelu głosu, gra będzie bez lektora', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  })();
  return enginePromise;
}

/** Usuwa kopie poprzednich wersji modelu (każda ma ok. 80 MB). */
async function removeOldModels(fs: typeof import('@dr.pogodin/react-native-fs'), current: string) {
  const dir = current.slice(0, current.lastIndexOf('/'));
  if (!(await fs.exists(dir))) return;
  for (const item of await fs.readDir(dir)) {
    if (item.isDirectory() && item.name.startsWith('vits-piper-pl') && item.path !== current) {
      log.info('Usuwam starą wersję modelu głosu', { name: item.name });
      await fs.unlink(item.path).catch(() => undefined);
    }
  }
}

/** Syntezuje zdanie do pliku WAV w cache aplikacji. */
function synthesize({ engine, cacheDir, saveAudioToFile }: NativeTts, text: string): Promise<string> {
  const job = synthQueue.then(async () => {
    const started = Date.now();
    const audio = await engine.generateSpeech(toSpeakable(text));
    const path = `${cacheDir}/lektor-${tempCounter++ % TEMP_FILES}.wav`;
    await saveAudioToFile(audio, path);
    log.debug('Synteza zdania', {
      chars: text.length,
      audioMs: Math.round((audio.samples.length / audio.sampleRate) * 1000),
      ms: Date.now() - started,
    });
    return path;
  });
  synthQueue = job.catch(() => undefined);
  return job;
}

/** Lektor na żywo: Piper przez sherpa-onnx, odtwarzanie przez expo-audio. Jeden na ekran gry. */
export function createSherpaVoice(): Voice {
  void loadEngine();
  const player = createAudioPlayer(null);
  /** Numer bieżącej wypowiedzi; `stop` go zmienia, więc przerwana wypowiedź kończy się po cichu. */
  let token = 0;
  let paused = false;
  let finishClip: (() => void) | null = null;

  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) finishClip?.();
  });

  const playFile = (path: string) =>
    new Promise<void>((resolve) => {
      finishClip = () => {
        finishClip = null;
        resolve();
      };
      player.replace({ uri: `file://${path}` });
      if (!paused) player.play();
    });

  return {
    async say(texts) {
      const mine = ++token;
      const tts = await loadEngine();
      if (!tts || mine !== token || texts.length === 0) return;
      // Następne zdanie liczy się, gdy poprzednie gra — krótsze przerwy między zdaniami.
      let next: Promise<string> | null = synthesize(tts, texts[0]);
      for (let i = 0; next; i++) {
        const path = await next;
        if (mine !== token) return;
        next = i + 1 < texts.length ? synthesize(tts, texts[i + 1]) : null;
        await playFile(path);
        if (mine !== token) return;
      }
    },
    pause() {
      paused = true;
      player.pause();
    },
    resume() {
      paused = false;
      player.play();
    },
    stop() {
      token++;
      player.pause();
      finishClip?.();
    },
    dispose() {
      token++;
      finishClip?.();
      subscription.remove();
      player.remove();
    },
  };
}
