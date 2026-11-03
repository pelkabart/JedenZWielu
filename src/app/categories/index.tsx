import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickCategoryFile, readCategoryFileText, saveCategoryFile } from '@/categories/device/categoryFiles';
import { CategoryError } from '@/categories/errors';
import { questionSetStore } from '@/categories/questionSets';
import { exportQuestionSet, importQuestionSet } from '@/categories/transferQuestionSet';
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
  const [busy, setBusy] = useState(false);
  // Dwa szybkie stuknięcia w jednej klatce widzą jeszcze stary stan `busy`.
  const working = useRef(false);

  /** Import i eksport po jednym naraz; błąd pokazuje okno „Błąd”. */
  const runExclusive = async (action: string, task: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      const kind = error instanceof CategoryError ? error.kind : 'unknown';
      log.warn(`Nie udało się: ${action}`, { kind });
      Alert.alert('Błąd', error instanceof CategoryError ? error.message : `Nie udało się: ${action}.`);
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const importFile = () =>
    runExclusive('import kategorii', async () => {
      const file = await pickCategoryFile();
      if (!file) return;
      const set = await importQuestionSet(file, { store: questionSetStore, readText: readCategoryFileText });
      log.info('Zaimportowano kategorię z ekranu', { setId: set.id, questions: set.questions.length });
      Alert.alert('Zaimportowano', `Dodano kategorię „${set.name}” (${set.questions.length} pytań).`);
    });

  const exportSet = (set: QuestionSet) =>
    runExclusive('eksport kategorii', async () => {
      const fileName = await exportQuestionSet(set, { saveFile: saveCategoryFile });
      if (fileName) Alert.alert('Wyeksportowano', `Zapisano plik „${fileName}”.`);
    });

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
            <CategoryRow
              key={set.id}
              set={set}
              disabled={busy}
              onDelete={() => confirmDelete(set)}
              onExport={() => exportSet(set)}
            />
          ))}
        </View>

        <View style={styles.buttons}>
          <MenuButton
            label="Dodaj kategorię"
            color={colors.categories}
            baseColor={colors.categoriesBase}
            width={260}
            disabled={full || busy}
            onPress={() => router.push('/categories/new')}
          />
          <MenuButton
            label="Importuj"
            color={colors.multi}
            baseColor={colors.multiBase}
            width={200}
            disabled={full || busy}
            onPress={importFile}
          />
        </View>
        {full && <Text style={styles.hint}>Masz już {MAX_CUSTOM_SETS} własne kategorie – usuń którąś, żeby dodać albo zaimportować nową.</Text>}
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
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  hint: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
