import type { BotProfile } from '@/game/bots/profiles';

import type { SkinFile } from '../catalog';

/** Trzy klatki skórki, tak jak w folderze `assets/skins`. */
export function skinFiles(pool: string, id: string): SkinFile[] {
  return ['normal', 'smile', 'closed-eyes'].map((frame, i) => ({
    path: `./${pool}/${id}/${id}-${frame}.png`,
    asset: `${pool}/${id}`.length * 100 + i,
  }));
}

/** Pliki skórek przypisanych tym botom. Testy nie zależą dzięki temu od tego, kto jaką skórkę ma w profilach. */
export const botSkinFiles = (profiles: readonly BotProfile[]): SkinFile[] =>
  profiles.flatMap(({ skinId }) => {
    const [pool, id] = skinId.split('/');
    return skinFiles(pool, id);
  });

export const hostFiles = (): SkinFile[] =>
  ['normal', 'smile', 'closed-eyes'].map((frame, i) => ({ path: `./host/host-${frame}.png`, asset: 900 + i }));

/** Układ jak w grze: po 3 skórki każdej płci, jedna gracza i prowadzący. */
export const standardFiles = (): SkinFile[] => [
  ...['001', '002', '003'].flatMap((id) => skinFiles('male', id)),
  ...['101', '102', '103'].flatMap((id) => skinFiles('female', id)),
  ...skinFiles('player', '201'),
  ...hostFiles(),
];
