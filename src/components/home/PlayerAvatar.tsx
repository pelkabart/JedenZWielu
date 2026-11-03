import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SkinFigure } from '@/components/skins/SkinFigure';
import { colors } from '@/constants/theme';
import { useIdleFace } from '@/hooks/useIdleFace';
import type { Skin } from '@/skins/catalog';

/** Część obrazka, którą zajmuje postać; reszta to przezroczysty margines. */
const FIGURE_WIDTH_RATIO = 0.48;
const SMILE_CHANCE = 0.25;

type Props = {
  skin: Skin;
  height: number;
};

/** Postać gracza w menu i wieszak otwierający wybór skórki. */
export function PlayerAvatar({ skin, height }: Props) {
  const expression = useIdleFace(true, SMILE_CHANCE);
  const openSkins = () => router.push('/skins');

  return (
    <View style={styles.root}>
      <Pressable onPress={openSkins} accessible={false}>
        <SkinFigure skin={skin} expression={expression} width={height * FIGURE_WIDTH_RATIO} height={height} imageSize={height} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zmień postać"
        hitSlop={10}
        onPress={openSkins}
        style={({ pressed }) => [styles.hanger, pressed && styles.hangerPressed]}
      >
        <MaterialCommunityIcons name="hanger" size={26} color={colors.outline} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 8,
  },
  hanger: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 4px 0 ${colors.outline}`,
  },
  hangerPressed: {
    transform: [{ translateY: 3 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
});
