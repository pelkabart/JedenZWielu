import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export function BackButton() {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Wróć"
      hitSlop={10}
      onPress={() => router.back()}
      style={({ pressed }) => [
        styles.button,
        { top: insets.top + 16, left: insets.left + 20 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="arrow-back" size={26} color={colors.outline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    zIndex: 1,
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
  pressed: {
    transform: [{ translateY: 3 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
});
