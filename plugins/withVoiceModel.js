// Kopiuje model głosu (Piper przygotowany dla sherpa-onnx) do zasobów aplikacji na Androidzie.
// Folder android/ jest generowany przez `npx expo prebuild`, więc nie wkładamy tam plików ręcznie.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const SOURCE = 'voiceModel/vits-piper-pl';
const REQUIRED = ['model.onnx', 'tokens.txt', 'espeak-ng-data'];

/**
 * Skrót zawartości modelu. Trafia do nazwy folderu w zasobach: sherpa-onnx kopiuje model do plików
 * aplikacji tylko raz i potem go nie odświeża, więc nowy model musi mieć nową nazwę folderu.
 *
 * Skrót musi wyjść tak samo na każdym systemie: `expo start` na Windowsie podaje aplikacji
 * nazwę z lokalnego liczenia, a folder w APK powstaje przy prebuildzie na Linuksie (EAS).
 * Dlatego ścieżki są zawsze z „/” (path.relative na Windowsie daje „\”).
 */
function modelVersion(source) {
  const hash = crypto.createHash('sha1');
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else {
        const relative = path.relative(source, file).split(path.sep).join('/');
        hash.update(relative).update(fs.readFileSync(file));
      }
    }
  };
  walk(source);
  return hash.digest('hex').slice(0, 8);
}

module.exports = function withVoiceModel(config) {
  const source = path.join(config._internal?.projectRoot ?? process.cwd(), SOURCE);
  const missing = REQUIRED.filter((name) => !fs.existsSync(path.join(source, name)));
  // Nazwa musi zawierać „vits” — po niej sherpa-onnx rozpoznaje typ modelu.
  const folder = missing.length === 0 ? `vits-piper-pl-${modelVersion(source)}` : null;
  // Aplikacja czyta ścieżkę z expo-constants (src/narration/sherpaVoice.ts).
  config.extra = { ...config.extra, voiceModelAsset: folder ? `models/${folder}` : null };

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      if (!folder) {
        // Bez modelu aplikacja zbudowałaby się po cichu bez lektora — lepiej przerwać z instrukcją.
        throw new Error(
          `[withVoiceModel] Brak ${missing.join(', ')} w ${SOURCE}. ` +
            'Uruchom: scripts/narration/.venv/Scripts/python scripts/narration/prepare_voice_model.py ' +
            '(potrzebny voiceModel/voice.onnx i voice.onnx.json).',
        );
      }
      const modelsDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/assets/models');
      fs.rmSync(modelsDir, { recursive: true, force: true });
      fs.cpSync(source, path.join(modelsDir, folder), { recursive: true });
      return cfg;
    },
  ]);
};

module.exports.modelVersion = modelVersion;
