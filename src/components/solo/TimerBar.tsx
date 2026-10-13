import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/constants/theme';

type Props = {
  deadline: number | null;
  totalMs: number | null;
  paused: boolean;
};

export function TimerBar({ deadline, totalMs, paused }: Props) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (deadline === null || totalMs === null) {
      cancelAnimation(progress);
      progress.set(1);
      return;
    }
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(0, deadline - Date.now());
    progress.set(remaining / totalMs);
    progress.set(withTiming(0, { duration: remaining, easing: Easing.linear }));
  }, [deadline, totalMs, paused, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.get() * 100}%`,
    backgroundColor: progress.get() < 0.25 ? colors.extras : colors.starYellow,
  }));

  return (
    <View style={[styles.track, deadline === null && styles.hidden]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.navyDeep,
    overflow: 'hidden',
  },
  hidden: {
    opacity: 0,
  },
  fill: {
    height: '100%',
  },
});
