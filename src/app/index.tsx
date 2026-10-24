import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { questionSetStore } from '@/categories/questionSets';
import { soloEntryRoute } from '@/categories/soloEntry';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { MusicToggle } from '@/components/home/MusicToggle';
import { colors } from '@/constants/theme';
import { useQuestionSets } from '@/hooks/useQuestionSets';
import { useMenuMusic } from '@/hooks/useMenuMusic';

/** Poniżej tej wysokości (telefon w poziomie) cztery przyciski i tytuł muszą się ścisnąć. */
const COMPACT_HEIGHT = 400;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height - insets.top - insets.bottom < COMPACT_HEIGHT;
  useMenuMusic();
  // Wczytuje kategorie już na ekranie głównym, żeby wybór trybu jednoosobowego ich nie czekał.
  useQuestionSets();

  const openSolo = async () => {
    await questionSetStore.load();
    router.push(soloEntryRoute(questionSetStore.getSets()));
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CartoonBackground />
      <MusicToggle />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ustawienia"
        hitSlop={10}
        onPress={() => router.push('/settings')}
        style={({ pressed }) => [
          styles.settings,
          { top: insets.top + 16, right: insets.right + 20 },
          pressed && styles.settingsPressed,
        ]}
      >
        <Ionicons name="settings-sharp" size={26} color={colors.outline} />
      </Pressable>

      <View style={[styles.content, compact && styles.contentCompact, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <Text style={[styles.title, compact && styles.titleCompact]}>Jeden z Wielu</Text>

        <View style={[styles.menu, compact && styles.menuCompact]}>
          <MenuButton
            label="Tryb Jednoosobowy"
            color={colors.solo}
            baseColor={colors.soloBase}
            onPress={openSolo}
          />
          <MenuButton label="MultiPlayer" color={colors.multi} baseColor={colors.multiBase} />
          <MenuButton label="Dodatki" color={colors.extras} baseColor={colors.extrasBase} />
          <MenuButton
            label="Kategorie"
            color={colors.categories}
            baseColor={colors.categoriesBase}
            onPress={() => router.push('/categories')}
          />
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
  contentCompact: {
    gap: 10,
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
  titleCompact: {
    fontSize: 42,
  },
  menu: {
    gap: 12,
    alignItems: 'center',
  },
  menuCompact: {
    gap: 6,
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
