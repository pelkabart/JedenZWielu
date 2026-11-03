import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useSyncExternalStore } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkServer, normalizeServerUrl, type HealthResult } from '@/backend/serverHealth';
import { CONFIG_SERVER_URL } from '@/backend/serverUrl';
import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { VolumeSlider } from '@/components/settings/VolumeSlider';
import { colors } from '@/constants/theme';
import { useApiKey } from '@/hooks/useApiKey';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useMenuMusic } from '@/hooks/useMenuMusic';
import { createLogger } from '@/lib/log';
import { apiKeyStore } from '@/settings/apiKey';
import { ApiKeyError, maskApiKey, validateApiKey } from '@/settings/ApiKeyStore';
import { volumeStore } from '@/settings/volume';

const log = createLogger('ustawienia');

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const savedKey = useApiKey();
  const fromConfig = apiKeyStore.isFromConfig();
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const volume = useSyncExternalStore(volumeStore.subscribe, volumeStore.getSettings);
  const volumeSaveFailed = useSyncExternalStore(volumeStore.subscribe, volumeStore.didSaveFail);
  const [serverResult, setServerResult] = useState<HealthResult | null>(null);
  const [serverChecking, setServerChecking] = useState(false);
  const serverUrl = normalizeServerUrl(CONFIG_SERVER_URL);
  // Muzyka menu gra dalej w ustawieniach, żeby od razu było słychać zmianę głośności.
  useMenuMusic();

  const testServer = async () => {
    setServerChecking(true);
    setServerResult(null);
    setServerResult(await checkServer(CONFIG_SERVER_URL));
    setServerChecking(false);
  };

  const check = input.trim() === '' ? null : validateApiKey(input);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setInput('');
      setMessage({ text: success, error: false });
    } catch (e) {
      log.warn('Nie udało się zmienić klucza API', { kind: e instanceof ApiKeyError ? e.kind : 'unknown' });
      setMessage({ text: e instanceof ApiKeyError ? e.message : 'Coś poszło nie tak. Spróbuj ponownie.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const confirmClear = () => {
    Alert.alert('Usunąć klucz API?', 'Bez klucza nie da się tworzyć nowych kategorii. Istniejące kategorie zostaną.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => void run(() => apiKeyStore.clear(), 'Klucz usunięty z telefonu.') },
    ]);
  };

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16 + keyboardHeight,
            paddingHorizontal: insets.left + 88,
          },
        ]}
      >
        <Text style={styles.title}>Ustawienia</Text>

        <View style={styles.panel}>
          <Text style={styles.label}>Głośność</Text>
          <VolumeSlider
            label="Muzyka"
            icon="musical-notes"
            value={volume.music}
            onPreview={(value) => volumeStore.preview('music', value)}
            onCommit={(value) => void volumeStore.set('music', value)}
          />
          <VolumeSlider
            label="Lektor"
            icon="mic"
            value={volume.voice}
            onPreview={(value) => volumeStore.preview('voice', value)}
            onCommit={(value) => void volumeStore.set('voice', value)}
          />
          {volumeSaveFailed && (
            <Text style={styles.error}>Nie udało się zapisać głośności – po ponownym uruchomieniu gry wróci poprzednia.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Klucz API OpenAI</Text>
          <Text style={styles.hint}>Potrzebny do tworzenia własnych kategorii pytań z plików.</Text>

          <View style={styles.status}>
            <Ionicons
              name={savedKey ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={savedKey ? colors.categories : colors.starYellow}
            />
            <Text style={styles.statusText}>
              {!savedKey
                ? 'Brak zapisanego klucza'
                : fromConfig
                  ? `Z pliku .env.local: ${maskApiKey(savedKey)}`
                  : `Zapisany na telefonie: ${maskApiKey(savedKey)}`}
            </Text>
          </View>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              setMessage(null);
            }}
            placeholder={savedKey ? 'Wklej nowy klucz, żeby go zmienić' : 'sk-…'}
            placeholderTextColor={colors.sky}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          {check && !check.ok && <Text style={styles.error}>{check.reason}</Text>}
          {message && <Text style={message.error ? styles.error : styles.success}>{message.text}</Text>}

          <View style={styles.buttons}>
            <MenuButton
              label="Zapisz klucz"
              color={colors.categories}
              baseColor={colors.categoriesBase}
              width={240}
              disabled={busy || !check?.ok}
              onPress={() => void run(() => apiKeyStore.save(input), 'Klucz zapisany na telefonie.')}
            />
            {savedKey !== '' && !fromConfig && (
              <MenuButton
                label="Usuń klucz"
                color={colors.danger}
                baseColor={colors.outline}
                width={200}
                disabled={busy}
                onPress={confirmClear}
              />
            )}
          </View>
          <Text style={styles.hint}>
            Klucz zostaje tylko na tym telefonie, w szyfrowanym magazynie Androida (Keystore). Nie trafia do kopii
            zapasowej ani do logów.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Serwer gry</Text>
          <Text style={styles.hint}>
            {serverUrl ? serverUrl.replace(/^https?:\/\//i, '') : 'Brak adresu – wpisz EXPO_PUBLIC_SERVER_URL w pliku .env.local.'}
          </Text>
          <View style={styles.buttons}>
            <MenuButton
              label={serverChecking ? 'Sprawdzam…' : 'Sprawdź połączenie'}
              color={colors.categories}
              baseColor={colors.categoriesBase}
              width={260}
              disabled={serverChecking || !serverUrl}
              onPress={() => void testServer()}
            />
          </View>
          {serverResult && (
            <Text style={serverResult.ok ? styles.success : styles.error}>
              {serverResult.ok
                ? `Połączono z serwerem w wersji ${serverResult.version} (${serverResult.latencyMs} ms).`
                : serverResult.message}
            </Text>
          )}
        </View>
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
  panel: {
    width: '100%',
    maxWidth: 560,
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.panel,
  },
  label: {
    color: colors.starYellow,
    fontSize: 17,
    fontWeight: '900',
  },
  hint: {
    color: colors.sky,
    fontSize: 12,
    fontWeight: '600',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
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
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  success: {
    color: colors.categories,
    fontSize: 14,
    fontWeight: '800',
  },
});
