import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryError } from '@/categories/errors';
import { questionSetStore } from '@/categories/questionSets';
import { MAX_CUSTOM_SETS, type QuestionSet } from '@/categories/types';
import { CategoryRow } from '@/components/categories/CategoryRow';
import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { colors } from '@/constants/theme';
import { useQuestionSets } from '@/hooks/useQuestionSets';
import { createLogger } from '@/lib/log';

const log = createLogger('ekran-kategorii');

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const sets = useQuestionSets();
  const customCount = sets.filter((s) => !s.builtIn).length;
  const full = customCount >= MAX_CUSTOM_SETS;

  const confirmDelete = (set: QuestionSet) => {
    Alert.alert('Usunąć kategorię?', `„${set.name}” zostanie usunięta z telefonu razem z pytaniami.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await questionSetStore.remove(set.id);
          } catch (error) {
            log.warn('Nie udało się usunąć kategorii', { setId: set.id });
            Alert.alert('Błąd', error instanceof CategoryError ? error.message : 'Nie udało się usunąć kategorii.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: insets.left + 88 },
        ]}
      >
        <Text style={styles.title}>Kategorie</Text>
        <Text style={styles.subtitle}>
          Własne kategorie: {customCount}/{MAX_CUSTOM_SETS}
        </Text>

        <View style={styles.list}>
          {sets.map((set) => (
            <CategoryRow key={set.id} set={set} onDelete={() => confirmDelete(set)} />
          ))}
        </View>

        <MenuButton
          label="Dodaj kategorię"
          color={colors.categories}
          baseColor={colors.categoriesBase}
          disabled={full}
          onPress={() => router.push('/categories/new')}
        />
        {full && <Text style={styles.hint}>Masz już {MAX_CUSTOM_SETS} własne kategorie – usuń którąś, żeby dodać nową.</Text>}
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
    gap: 14,
  },
  title: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  subtitle: {
    color: colors.starYellow,
    fontSize: 15,
    fontWeight: '800',
    marginTop: -8,
  },
  list: {
    width: '100%',
    maxWidth: 560,
    gap: 8,
  },
  hint: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
