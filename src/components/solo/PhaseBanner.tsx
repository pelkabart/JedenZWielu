import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { PHASE_RULES, PHASE_TITLES } from '@/game/controller/hostLine';
import type { Phase } from '@/game/types';

type Props = {
  phase: Phase;
  onPress: () => void;
};

export function PhaseBanner({ phase, onPress }: Props) {
  return (
    <Pressable style={styles.backdrop} onPress={onPress} accessibilityRole="button" accessibilityLabel="Dalej">
      <View style={styles.card}>
        <Text style={styles.title}>{PHASE_TITLES[phase]}</Text>
        <Text style={styles.rules}>{PHASE_RULES[phase]}</Text>
        <Text style={styles.hint}>Dotknij, aby kontynuować</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 36, 0.6)',
  },
  card: {
    maxWidth: 460,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.solo,
    boxShadow: `0 6px 0 ${colors.outline}`,
    transform: [{ rotate: '-2deg' }],
  },
  title: {
    color: colors.outline,
    fontSize: 40,
    fontWeight: '900',
  },
  rules: {
    color: colors.outline,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: colors.outline,
    opacity: 0.6,
    fontSize: 12,
    fontWeight: '700',
  },
});
