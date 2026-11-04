import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

import { secondsLeft } from './gameDisplay';

const REFRESH_MS = 100;

/** Duży licznik czasu na wskazanie gracza. Pokazuje się, gdy czas biegnie, czyli po ciszy lektora. */
export function PickCountdown({ deadline, totalMs, paused }: { deadline: number | null; totalMs: number | null; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null || paused) return;
    const interval = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(interval);
  }, [deadline, paused]);

  const seconds = secondsLeft(deadline, now, totalMs);
  if (seconds === null) return null;

  return (
    <View style={styles.circle} accessibilityLabel={`Zostało sekund: ${seconds}`}>
      <Text style={styles.number}>{seconds}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  number: {
    color: colors.outline,
    fontSize: 28,
    fontWeight: '900',
  },
});
