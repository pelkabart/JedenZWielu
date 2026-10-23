import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createQuestionSet, type CreationStep } from '@/categories/createQuestionSet';
import { loadApiKey, saveApiKey } from '@/categories/device/apiKeyStorage';
import { pickSourceFiles, readFileBase64 } from '@/categories/device/pickSourceFiles';
import { CategoryError } from '@/categories/errors';
import { questionSetStore } from '@/categories/questionSets';
import { MAX_SET_NAME_LENGTH } from '@/categories/QuestionSetStore';
import {
  describeSourceFileProblem,
  MAX_FILE_BYTES,
  MAX_SOURCE_FILES,
  SUPPORTED_EXTENSIONS,
  validateSourceFiles,
  type PickedFile,
} from '@/categories/sourceFiles';
import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { colors } from '@/constants/theme';
import { createLogger } from '@/lib/log';

const log = createLogger('ekran-kategorii');

const STEP_LABELS: Record<CreationStep, string> = {
  reading: 'Czytam pliki…',
  generating: 'OpenAI układa pytania…',
  saving: 'Zapisuję kategorię…',
};

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function NewCategoryScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [step, setStep] = useState<CreationStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Dwa szybkie stuknięcia w jednej klatce widzą jeszcze stary stan — bez tego poszłyby dwa płatne zapytania.
  const submitting = useRef(false);

  useEffect(() => {
    void loadApiKey().then((saved) => setApiKey((current) => current || saved));
  }, []);

  const busy = step !== null;
  const problem = files.length > 0 ? validateSourceFiles(files) : null;
  const canSubmit = !busy && name.trim() !== '' && apiKey.trim() !== '' && files.length > 0 && problem === null;

  const addFiles = async () => {
    try {
      const picked = await pickSourceFiles();
      log.debug('Wybrano pliki', { count: picked.length });
      setFiles((current) => [...current, ...picked.filter((p) => !current.some((f) => f.name === p.name))]);
    } catch (e) {
      log.warn('Nie udało się otworzyć wyboru plików', { error: e instanceof Error ? e.message : String(e) });
      setError('Nie udało się otworzyć wyboru plików.');
    }
  };

  const submit = async () => {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setError(null);
    setStep('reading');
    try {
      const set = await createQuestionSet(
        { name, files },
        { store: questionSetStore, readFile: readFileBase64, apiKey, onProgress: setStep },
      );
      await saveApiKey(apiKey);
      log.info('Utworzono kategorię z ekranu', { setId: set.id, questions: set.questions.length });
      router.back();
    } catch (e) {
      const kind = e instanceof CategoryError ? e.kind : 'unknown';
      log.warn('Nie udało się utworzyć kategorii', { kind });
      setError(e instanceof CategoryError ? e.message : 'Coś poszło nie tak. Spróbuj ponownie.');
      setStep(null);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: insets.left + 88 },
        ]}
      >
        <Text style={styles.title}>Nowa kategoria</Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.label}>Nazwa</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="np. Biologia – komórka"
              placeholderTextColor={colors.sky}
              maxLength={MAX_SET_NAME_LENGTH}
              editable={!busy}
            />

            <Text style={styles.label}>Klucz API OpenAI</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-…"
              placeholderTextColor={colors.sky}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Text style={styles.hint}>Klucz zostaje tylko na tym telefonie (szyfrowany magazyn systemu).</Text>
          </View>

          <View style={styles.column}>
            <Text style={styles.label}>
              Pliki ({files.length}/{MAX_SOURCE_FILES})
            </Text>
            <View style={styles.files}>
              {files.length === 0 && <Text style={styles.hint}>Nie wybrano plików.</Text>}
              {files.map((file) => (
                <View key={file.name} style={styles.file}>
                  <Ionicons name="document-text" size={18} color={colors.categories} />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileSize}>{megabytes(file.size)}</Text>
                  {!busy && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Usuń plik ${file.name}`}
                      hitSlop={8}
                      onPress={() => setFiles((current) => current.filter((f) => f.name !== file.name))}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            <MenuButton
              label="Wybierz pliki"
              color={colors.multi}
              baseColor={colors.multiBase}
              width={240}
              disabled={busy || files.length >= MAX_SOURCE_FILES}
              onPress={addFiles}
            />
            <Text style={styles.hint}>
              {SUPPORTED_EXTENSIONS.join(', ').toUpperCase()} · do {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB na plik
            </Text>
          </View>
        </View>

        {problem && <Text style={styles.error}>{describeSourceFileProblem(problem)}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {step !== null ? (
          <View style={styles.progress}>
            <ActivityIndicator size="large" color={colors.starYellow} />
            <View>
              <Text style={styles.progressText}>{STEP_LABELS[step]}</Text>
              <Text style={styles.hint}>To może potrwać do kilku minut.</Text>
            </View>
          </View>
        ) : (
          <MenuButton
            label="Utwórz kategorię"
            color={colors.categories}
            baseColor={colors.categoriesBase}
            disabled={!canSubmit}
            onPress={submit}
          />
        )}
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
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  columns: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 760,
  },
  column: {
    flex: 1,
    gap: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.panel,
  },
  label: {
    color: colors.starYellow,
    fontSize: 15,
    fontWeight: '900',
  },
  input: {
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.outline,
  },
  hint: {
    color: colors.sky,
    fontSize: 12,
    fontWeight: '600',
  },
  files: {
    gap: 4,
    marginBottom: 6,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  fileSize: {
    color: colors.sky,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 760,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
});
