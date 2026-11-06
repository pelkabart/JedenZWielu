import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CartoonBackground } from '@/components/home/CartoonBackground';
import { colors } from '@/constants/theme';

/** Zasłona przed pierwszą rundą: postacie i lektor wczytują się pod nią. Przechwytuje dotknięcia. */
export function LoadingScreen({ progress }: { progress: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View style={styles.root} accessibilityLabel={`Wczytywanie gry: ${percent}%`} accessibilityLiveRegion="polite">
      <CartoonBackground />
      <View style={styles.card}>
        <Text style={styles.title}>Wczytywanie gry…</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <View style={styles.row}>
          <ActivityIndicator color={colors.starYellow} />
          <Text style={styles.percent}>{percent}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  card: {
    width: '60%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 14,
    padding: 22,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.panel,
  },
  title: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  track: {
    width: '100%',
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.categories,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  percent: {
    color: colors.starYellow,
    fontSize: 18,
    fontWeight: '900',
  },
});
