import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { colors } from '@/constants/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CartoonBackground />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ustawienia"
        hitSlop={10}
        style={({ pressed }) => [
          styles.settings,
          { top: insets.top + 16, right: insets.right + 20 },
          pressed && styles.settingsPressed,
        ]}
      >
        <Ionicons name="settings-sharp" size={26} color={colors.outline} />
      </Pressable>

      <View style={[styles.content, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <Text style={styles.title}>Jeden z Wielu</Text>

        <View style={styles.menu}>
          <MenuButton
            label="Tryb Jednoosobowy"
            color={colors.solo}
            baseColor={colors.soloBase}
            onPress={() => router.push('/solo')}
          />
          <MenuButton label="MultiPlayer" color={colors.multi} baseColor={colors.multiBase} />
          <MenuButton label="Dodatki" color={colors.extras} baseColor={colors.extrasBase} />
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
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 1,
  },
  menu: {
    gap: 12,
    alignItems: 'center',
  },
  settings: {
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
  settingsPressed: {
    transform: [{ translateY: 3 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
});
