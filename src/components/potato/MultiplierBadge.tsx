import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { colors } from '@/constants/theme';

import { multiplierBurstText, multiplierColor } from './gameDisplay';

const BURST_IN_MS = 180;
const BURST_HOLD_MS = 450;
const BURST_OUT_MS = 350;
/** Mnożnik przebija przez ramkę, kiedy rośnie. */
const POP_SCALE = 1.5;

/** Stały znacznik mnożnika na środku górnego paska. Przy każdej zmianie „podskakuje”. */
export function MultiplierBadge({ multiplier }: { multiplier: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.set(withSequence(withTiming(POP_SCALE, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 180 })));
  }, [multiplier, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View style={styles.badgeSlot} pointerEvents="none">
      <Animated.View
        accessibilityLabel={`Mnożnik: ${multiplier}`}
        style={[styles.badge, { backgroundColor: multiplierColor(multiplier) }, style]}
      >
        <Ionicons name="flame" size={24} color={colors.outline} />
        <Text style={styles.badgeText}>×{multiplier}</Text>
      </Animated.View>
    </View>
  );
}

/** Wejście, chwila w miejscu i wyjście napisu przy każdej zmianie `trigger` (gdy `enabled`). */
function useBurst(trigger: unknown, enabled: boolean) {
  const progress = useSharedValue(0);
  const previous = useRef(trigger);

  useEffect(() => {
    if (previous.current === trigger) return;
    previous.current = trigger;
    if (!enabled) return;
    progress.set(0);
    progress.set(
      withSequence(
        withTiming(1, { duration: BURST_IN_MS, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: BURST_HOLD_MS }),
        withTiming(2, { duration: BURST_OUT_MS, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [trigger, enabled, progress]);

  return useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p <= 1 ? Math.min(1, p) : 2 - p,
      transform: [{ scale: p <= 1 ? 0.3 + 0.7 * p : 1 + (p - 1) * 0.6 }],
    };
  });
}

/**
 * Duży napis na środku ekranu po zmianie mnożnika. Nie przechwytuje dotknięć i sam znika.
 * `suppress`: błąd zabrał osłonę, więc zamiast „BUM!” widać napis o osłonie.
 */
export function MultiplierBurst({ multiplier, suppress = false }: { multiplier: number; suppress?: boolean }) {
  const style = useBurst(multiplier, !suppress);
  return (
    <View style={styles.burstSlot} pointerEvents="none">
      <Animated.Text style={[styles.burstText, { color: multiplierColor(multiplier) }, style]}>{multiplierBurstText(multiplier)}</Animated.Text>
    </View>
  );
}

/** Napis „TRACISZ OSŁONĘ” na środku ekranu. `eventKey` zmienia się przy każdej utracie osłony. */
export function ShieldBurst({ text, eventKey }: { text: string | null; eventKey: number | null }) {
  const style = useBurst(eventKey, text !== null);
  return (
    <View style={styles.burstSlot} pointerEvents="none">
      <Animated.Text style={[styles.burstText, styles.shieldText, style]} numberOfLines={2} adjustsFontSizeToFit>
        {text ?? ''}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: colors.outline,
    boxShadow: `0 4px 0 ${colors.outline}`,
  },
  badgeText: {
    color: colors.outline,
    fontSize: 32,
    fontWeight: '900',
  },
  burstSlot: {
    ...StyleSheet.absoluteFill,
    zIndex: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstText: {
    fontSize: 120,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 2,
  },
  shieldText: {
    fontSize: 60,
    color: colors.sky,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
