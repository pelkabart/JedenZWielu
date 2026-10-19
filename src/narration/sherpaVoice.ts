
import { createAudioPlayer } from 'expo-audio';
import Constants from 'expo-constants';
import type { GeneratedAudio, TtsEngine } from 'react-native-sherpa-onnx/tts';

import { createLogger } from '@/lib/log';

import { MODEL_FOLDER_PREFIX, pickModelAsset } from './modelAsset';
import type { Voice } from './NarrationDirector';
import { toSpeakable } from './pronunciation';

const log = createLogger('lektor');

/**
 * Folder modelu w zasobach Androida.
 * Nazwę generuje plugins/withVoiceModel.js.
 */
const VOICE_MODEL_ASSET: string | null =
  Constants.expoConfig?.extra?.voiceModelAsset ?? null;

const TEMP_FILES = 6;

const REQUIRED_FILES = [
  'model.onnx',
  'tokens.txt',
  'espeak-ng-data',
] as const;

type NativeFs = typeof import('@dr.pogodin/react-native-fs');

interface NativeTts {
  engine: TtsEngine;
  cacheDir: string;
  saveAudioToFile: (
    audio: GeneratedAudio,
    path: string
  ) => Promise<string>;
}

let enginePromise: Promise<NativeTts | null> | null = null;

let synthQueue: Promise<unknown> = Promise.resolve();
let tempCounter = 0;

/**
 * Zamienia dowolny błąd na czytelny komunikat.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sprawdza rzeczywistą zawartość folderu modelu
 * w pamięci telefonu.
 */
async function inspectModelFiles(
  fs: NativeFs,
  modelDir: string
): Promise<boolean> {
  log.info('Sprawdzam katalog modelu', {
    path: modelDir,
  });

  const exists = await fs.exists(modelDir);

  if (!exists) {
    log.warn('Katalog modelu nie istnieje', {
      path: modelDir,
    });
    return false;
  }

  const files = await fs.readDir(modelDir);

  log.info('Zawartość katalogu modelu', {
    files: files.map((file) => ({
      name: file.name,
      directory: file.isDirectory(),
      size: file.size,
    })),
  });

  const missing: string[] = [];

  for (const name of REQUIRED_FILES) {
    const fullPath = `${modelDir}/${name}`;

    if (!(await fs.exists(fullPath))) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    log.error('Brak wymaganych plików modelu', {
      missing,
      modelDir,
    });

    return false;
  }

  const tokensPath = `${modelDir}/tokens.txt`;
  const modelPath = `${modelDir}/model.onnx`;
  const espeakPath = `${modelDir}/espeak-ng-data`;

  const tokensStat = await fs.stat(tokensPath);
  const modelStat = await fs.stat(modelPath);
  const espeakStat = await fs.stat(espeakPath);

  if (
    Number(tokensStat.size) === 0 ||
    Number(modelStat.size) === 0 ||
    !espeakStat.isDirectory()
  ) {
    log.error('Nieprawidłowe pliki modelu', {
      tokensSize: tokensStat.size,
      modelSize: modelStat.size,
      espeakIsDirectory: espeakStat.isDirectory(),
    });

    return false;
  }

  log.info('Wymagane pliki modelu istnieją', {
    modelMB: (
      Number(modelStat.size) /
      1024 /
      1024
    ).toFixed(1),
    tokensBytes: tokensStat.size,
  });

  return true;
}

/**
 * Usuwa starsze wersje modelu.
 * Nie usuwa bieżącej wersji.
 */
async function removeOldModels(
  fs: NativeFs,
  current: string
): Promise<void> {
  const dir = current.slice(
    0,
    current.lastIndexOf('/')
  );

  if (!(await fs.exists(dir))) {
    return;
  }

  const items = await fs.readDir(dir);

  for (const item of items) {
    if (
      item.isDirectory() &&
      item.name.startsWith(MODEL_FOLDER_PREFIX) &&
      item.path !== current
    ) {
      try {
        log.info('Usuwam starą wersję modelu', {
          name: item.name,
        });

        await fs.unlink(item.path);
      } catch (error) {
        log.warn('Nie udało się usunąć starego modelu', {
          error: errorMessage(error),
        });
      }
    }
  }
}

/**
 * Rozwiązuje ścieżkę modelu i sprawdza,
 * czy sherpa-onnx rozpoznaje jego strukturę.
 */
async function diagnoseModel(
  fs: NativeFs,
  assetPath: string
): Promise<void> {
  const { resolveModelPath } = await import(
    'react-native-sherpa-onnx'
  );

  const { detectTtsModel } = await import(
    'react-native-sherpa-onnx/tts'
  );

  const modelPath = {
    type: 'asset' as const,
    path: assetPath,
  };

  log.info('Rozpoczynam diagnostykę modelu', {
    assetPath,
  });

  let resolvedPath: string;

  try {
    resolvedPath = await resolveModelPath(modelPath);

    log.info('Rozwiązana ścieżka modelu', {
      resolvedPath,
    });
  } catch (error) {
    log.error('Nie udało się rozwiązać ścieżki modelu', {
      error: errorMessage(error),
    });

    throw error;
  }

  const filesValid = await inspectModelFiles(
    fs,
    resolvedPath
  );

  if (!filesValid) {
    throw new Error(
      `Niekompletne pliki modelu w ${resolvedPath}`
    );
  }

  log.info('Uruchamiam wykrywanie modelu VITS');

  const detection = await detectTtsModel(modelPath, {
    modelType: 'vits',
  });

  log.info('Wynik wykrywania modelu', {
    success: detection.success,
    modelType: detection.modelType,
    detectedModels: detection.detectedModels,
    error: detection.error,
  });

  if (!detection.success) {
    throw new Error(
      detection.error ??
        'Sherpa-onnx nie rozpoznał modelu VITS'
    );
  }

  log.info('Model przeszedł diagnostykę');
}

/**
 * Ładuje silnik TTS jeden raz.
 *
 * W przypadku problemu z kopiowaniem modelu
 * usuwa lokalną kopię i próbuje ponownie.
 */
function loadEngine(): Promise<NativeTts | null> {
  enginePromise ??= (async () => {
    const started = Date.now();

    try {
      const { listAssetModels } = await import(
        'react-native-sherpa-onnx'
      );

      const { createTTS, saveAudioToFile } =
        await import('react-native-sherpa-onnx/tts');

      const fs = await import(
        '@dr.pogodin/react-native-fs'
      );

      /**
       * Nazwę folderu bierzemy z APK, a nie tylko z expoConfig:
       * w development buildzie expoConfig podaje Metro, a kopia
       * z nieistniejącego assetu daje pusty katalog bez błędu.
       */
      const bundled = await listAssetModels();
      const choice = pickModelAsset(
        VOICE_MODEL_ASSET,
        bundled.map((model) => model.folder)
      );

      if (!choice.asset) {
        throw new Error(
          `Brak modelu ${MODEL_FOLDER_PREFIX}* w assets/models aplikacji (foldery: ${bundled.length})`
        );
      }

      if (choice.mismatch) {
        log.warn('Folder modelu z konfiguracji nie istnieje w APK', {
          configured: VOICE_MODEL_ASSET,
          used: choice.asset,
        });
      }

      const asset = choice.asset;

      log.info('Inicjalizacja lektora', { asset });

      const copied =
        `${fs.DocumentDirectoryPath}/${asset}`;

      const modelPath = {
        type: 'asset' as const,
        path: asset,
      };

      await removeOldModels(fs, copied);

      /**
       * sherpa-onnx zwraca istniejący katalog bez sprawdzania zawartości,
       * więc pusta lub przerwana kopia zostałaby na zawsze.
       */
      if (
        (await fs.exists(copied)) &&
        !(await inspectModelFiles(fs, copied))
      ) {
        log.warn('Usuwam niekompletną kopię modelu', { path: copied });
        await fs.unlink(copied);
      }

      /**
       * Diagnostyka i inicjalizacja są wykonywane
       * w tej samej próbie, żeby ewentualna niepełna
       * kopia mogła zostać naprawiona.
       */
      const create = async (): Promise<TtsEngine> => {
        await diagnoseModel(
          fs,
          asset
        );

        log.info('Tworzę silnik TTS VITS');

        return createTTS({
          modelPath,
          modelType: 'vits',
          numThreads: 2,
          debug: true,
        });
      };

      let engine: TtsEngine;

      try {
        engine = await create();
      } catch (firstError) {
        log.warn(
          'Pierwsza próba ładowania modelu nieudana',
          {
            error: errorMessage(firstError),
          }
        );

        log.info(
          'Usuwam lokalną kopię modelu i ponawiam próbę'
        );

        if (await fs.exists(copied)) {
          await fs.unlink(copied);
        }

        engine = await create();
      }

      log.info('Model głosu wczytany poprawnie', {
        ms: Date.now() - started,
        model: asset,
      });

      return {
        engine,
        cacheDir: fs.CachesDirectoryPath,
        saveAudioToFile,
      };
    } catch (error) {
      log.error(
        'Nie udało się wczytać modelu głosu, gra będzie bez lektora',
        {
          error: errorMessage(error),
          ms: Date.now() - started,
        }
      );

      return null;
    }
  })();

  return enginePromise;
}

/**
 * Syntezuje tekst do pliku WAV.
 * Kolejne zadania są wykonywane sekwencyjnie.
 */
function synthesize(
  {
    engine,
    cacheDir,
    saveAudioToFile,
  }: NativeTts,
  text: string
): Promise<string> {
  const job = synthQueue.then(async () => {
    const started = Date.now();

    const speakable = toSpeakable(text);

    if (!speakable.trim()) {
      throw new Error(
        'Próba syntezy pustego tekstu'
      );
    }

    log.debug('Rozpoczynam syntezę', {
      chars: speakable.length,
    });

    const audio = await engine.generateSpeech(
      speakable
    );

    if (
      !audio.samples ||
      audio.samples.length === 0 ||
      audio.sampleRate <= 0
    ) {
      throw new Error(
        'Silnik TTS zwrócił pusty lub nieprawidłowy dźwięk'
      );
    }

    const path =
      `${cacheDir}/lektor-${tempCounter++ % TEMP_FILES}.wav`;

    await saveAudioToFile(audio, path);

    log.debug('Synteza zakończona', {
      chars: text.length,
      audioMs: Math.round(
        (audio.samples.length / audio.sampleRate) *
          1000
      ),
      ms: Date.now() - started,
      path,
    });

    return path;
  });

  synthQueue = job.catch(() => undefined);

  return job;
}

/**
 * Lektor dla pojedynczego ekranu gry.
 *
 * Synteza: Piper / sherpa-onnx
 * Odtwarzanie: expo-audio
 */
export function createSherpaVoice(): Voice {
  void loadEngine();

  const player = createAudioPlayer(null);

  let token = 0;
  let paused = false;
  let disposed = false;

  let finishClip: (() => void) | null = null;

  /**
   * Kończy oczekiwanie na aktualny klip.
   */
  const finishCurrentClip = () => {
    const finish = finishClip;
    finishClip = null;
    finish?.();
  };

  const subscription = player.addListener(
    'playbackStatusUpdate',
    (status) => {
      if (status.didJustFinish) {
        finishCurrentClip();
      }
    }
  );

  /**
   * Odtwarza wygenerowany WAV.
   */
  const playFile = (
    path: string
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (disposed) {
        resolve();
        return;
      }

      finishClip = resolve;

      try {
        player.replace({
          uri: `file://${path}`,
        });

        if (!paused) {
          player.play();
        }
      } catch (error) {
        finishClip = null;
        reject(error);
      }
    });

  return {
    async say(texts) {
      const mine = ++token;

      if (disposed || texts.length === 0) {
        return;
      }

      try {
        const tts = await loadEngine();

        if (
          !tts ||
          mine !== token ||
          disposed
        ) {
          return;
        }

        let next: Promise<string> | null =
          synthesize(tts, texts[0]);

        for (
          let i = 0;
          next !== null;
          i++
        ) {
          const path = await next;

          if (
            mine !== token ||
            disposed
          ) {
            return;
          }

          /**
           * Przygotowujemy następne zdanie,
           * podczas gdy bieżące jest odtwarzane.
           */
          next =
            i + 1 < texts.length
              ? synthesize(
                  tts,
                  texts[i + 1]
                )
              : null;

          await playFile(path);

          if (
            mine !== token ||
            disposed
          ) {
            return;
          }
        }
      } catch (error) {
        log.error('Błąd odtwarzania lektora', {
          error: errorMessage(error),
        });
      }
    },

    pause() {
      if (disposed) {
        return;
      }

      paused = true;
      player.pause();
    },

    resume() {
      if (disposed) {
        return;
      }

      paused = false;

      if (finishClip) {
        player.play();
      }
    },

    stop() {
      if (disposed) {
        return;
      }

      token++;
      paused = false;

      player.pause();
      finishCurrentClip();
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      token++;

      finishCurrentClip();

      subscription.remove();
      player.remove();
    },
  };
}
