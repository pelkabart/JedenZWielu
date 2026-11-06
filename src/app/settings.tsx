import { useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkServer, normalizeServerUrl, type HealthResult } from '@/backend/serverHealth';
import { CONFIG_SERVER_URL } from '@/backend/serverUrl';
import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { VolumeSlider } from '@/components/settings/VolumeSlider';
import { colors } from '@/constants/theme';
import { volumeStore } from '@/settings/volume';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const volume = useSyncExternalStore(volumeStore.subscribe, volumeStore.getSettings);
  const volumeSaveFailed = useSyncExternalStore(volumeStore.subscribe, volumeStore.didSaveFail);
  const [serverResult, setServerResult] = useState<HealthResult | null>(null);
  const [serverChecking, setServerChecking] = useState(false);
  const serverUrl = normalizeServerUrl(CONFIG_SERVER_URL);

  const testServer = async () => {
    setServerChecking(true);
    setServerResult(null);
    setServerResult(await checkServer(CONFIG_SERVER_URL));
    setServerChecking(false);
  };

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
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
            enabled={volume.musicEnabled}
            onToggle={(enabled) => void volumeStore.setEnabled('music', enabled)}
          />
          <VolumeSlider
            label="Lektor"
            icon="mic"
            value={volume.voice}
            onPreview={(value) => volumeStore.preview('voice', value)}
            onCommit={(value) => void volumeStore.set('voice', value)}
            enabled={volume.voiceEnabled}
            onToggle={(enabled) => void volumeStore.setEnabled('voice', enabled)}
          />
          {volumeSaveFailed && (
            <Text style={styles.error}>Nie udało się zapisać głośności – po ponownym uruchomieniu gry wróci poprzednia.</Text>
          )}
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
