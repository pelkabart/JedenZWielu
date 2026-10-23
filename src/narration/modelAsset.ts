/** Przedrostek folderu modelu w assets/models (nadaje go plugins/withVoiceModel.js). */
export const MODEL_FOLDER_PREFIX = 'vits-piper-pl';

export type ModelAssetChoice =
  | { asset: string; mismatch: boolean }
  | { asset: null; mismatch: false };

/**
 * Wybiera folder modelu, który naprawdę jest w APK.
 *
 * `configured` pochodzi z expoConfig, a w development buildzie expoConfig podaje serwer Metro,
 * nie APK — nazwa może nie pasować do zainstalowanej aplikacji. Wtedy bierzemy folder z APK
 * (`mismatch: true`), bo kopia z nieistniejącego assetu daje pusty katalog.
 */
export function pickModelAsset(
  configured: string | null,
  bundledFolders: readonly string[],
): ModelAssetChoice {
  const candidates = bundledFolders.filter((name) => name.startsWith(MODEL_FOLDER_PREFIX)).sort();
  const configuredFolder = configured?.split('/').pop();
  if (configuredFolder && candidates.includes(configuredFolder)) {
    return { asset: `models/${configuredFolder}`, mismatch: false };
  }
  const fallback = candidates.at(-1);
  return fallback ? { asset: `models/${fallback}`, mismatch: true } : { asset: null, mismatch: false };
}
