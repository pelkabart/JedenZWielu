import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { MusicToggle } from '@/components/home/MusicToggle';
import { colors } from '@/constants/theme';
import { DIFFICULTY_PRESETS } from '@/game/rules';
import { useMenuMusic } from '@/hooks/useMenuMusic';
import type { Difficulty } from '@/game/types';

const OPTIONS: { difficulty: Difficulty; color: string; baseColor: string }[] = [
  { difficulty: 'easy', color: colors.multi, baseColor: colors.multiBase },
  { difficulty: 'normal', color: colors.solo, baseColor: colors.soloBase },
  { difficulty: 'expert', color: colors.extras, baseColor: colors.extrasBase },
];

export default function DifficultyScreen() {
  useMenuMusic();
  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />
      <MusicToggle />

      <View style={styles.content}>
        <Text style={styles.title}>Wybierz poziom trudności</Text>
        <View style={styles.menu}>
          {OPTIONS.map(({ difficulty, color, baseColor }) => (
            <MenuButton
              key={difficulty}
              label={DIFFICULTY_PRESETS[difficulty].label}
              color={color}
              baseColor={baseColor}
              onPress={() => router.push({ pathname: '/solo/game', params: { difficulty } })}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  title: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  menu: {
    gap: 12,
    alignItems: 'center',
  },
});
