import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { colors } from '@/constants/theme';
import { useQuestionSets } from '@/hooks/useQuestionSets';
import { createLogger } from '@/lib/log';

const log = createLogger('ekran-kategorii');

export default function SoloCategoryScreen() {
  const insets = useSafeAreaInsets();
  const sets = useQuestionSets();

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Wybierz kategorię</Text>
        {sets.map((set) => (
          <MenuButton
            key={set.id}
            label={set.name}
            color={set.builtIn ? colors.solo : colors.categories}
            baseColor={set.builtIn ? colors.soloBase : colors.categoriesBase}
            onPress={() => {
              log.info('Wybrano kategorię', { setId: set.id, questions: set.questions.length });
              router.push({ pathname: '/solo', params: { set: set.id } });
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
});
