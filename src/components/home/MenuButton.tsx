import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

const DEPTH = 6;

type Props = {
  label: string;
  color: string;
  baseColor: string;
  width?: number;
  disabled?: boolean;
  onPress?: () => void;
};

export function MenuButton({ label, color, baseColor, width = 320, disabled = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => (
        <View style={[styles.base, { width, backgroundColor: baseColor }, disabled && styles.disabled]}>
          <View
            style={[
              styles.face,
              { backgroundColor: color, transform: [{ translateY: pressed ? DEPTH : 0 }] },
            ]}
          >
            <View style={styles.shine} />
            <Text style={styles.label}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.outline,
    paddingBottom: DEPTH,
  },
  face: {
    height: 52,
    borderRadius: 17,
    marginTop: -3,
    marginHorizontal: -3,
    borderWidth: 3,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 5,
    left: 14,
    right: 14,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    opacity: 0.35,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.outline,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
