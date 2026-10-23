import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncExternalStore } from 'react';

import { isMusicMuted, subscribeMusicMuted, toggleMusicMuted } from '@/audio/musicMute';
import { colors } from '@/constants/theme';

/** Przycisk wyciszania muzyki w prawym dolnym rogu. Stan jest wspólny dla wszystkich ekranów. */
export function MusicToggle() {
  const insets = useSafeAreaInsets();
  const muted = useSyncExternalStore(subscribeMusicMuted, isMusicMuted);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Włącz muzykę' : 'Wycisz muzykę'}
      hitSlop={10}
      onPress={toggleMusicMuted}
      style={({ pressed }) => [
        styles.button,
        { bottom: insets.bottom + 16, right: insets.right + 20 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={muted ? 'musical-notes-outline' : 'musical-notes'} size={24} color={colors.outline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    zIndex: 5,
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
