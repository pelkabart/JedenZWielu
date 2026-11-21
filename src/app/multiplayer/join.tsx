import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { TextField } from '@/components/multiplayer/TextField';
import { colors } from '@/constants/theme';
import { normalizeNick } from '@/multiplayer/nick';
import { CODE_LENGTH, isCompleteCode, normalizeCodeInput } from '@/multiplayer/roomCode';
import { roomClient } from '@/multiplayer/roomStore';

export default function JoinScreen() {
  const { nick: rawNick = '' } = useLocalSearchParams<{ nick?: string }>();
  const nick = normalizeNick(rawNick);
  const navigation = useNavigation();
  const state = useSyncExternalStore(roomClient.subscribe, roomClient.getState);
  const [code, setCode] = useState('');
  // „W pokoju” wygląda tu tak samo jak „łączę”: ekran właśnie przechodzi do poczekalni, a zmiana przycisku
  // w trakcie odpinania ekranu wywracała Fabric (`addViewAt: View already has a parent`, zob. 7.76).
  const connecting = state.status === 'connecting' || state.status === 'in-room';

  // Bez nicku (np. ekran otwarty bezpośrednio) wracamy do jego wpisania.
  useEffect(() => {
    if (!nick) router.replace('/multiplayer');
  }, [nick]);

  useEffect(() => {
    if (state.status === 'in-room') router.replace('/multiplayer/lobby');
  }, [state.status]);

  // Wyjście w trakcie łączenia przerywa próbę – spóźniona odpowiedź nie wrzuci gracza do pokoju.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (roomClient.getState().status === 'connecting') roomClient.leave();
      }),
    [navigation],
  );

  const error = state.status === 'error' && state.action === 'join' ? state.message : null;

  const submit = () => {
    if (!nick || !isCompleteCode(code) || connecting) return;
    roomClient.join(code, nick);
  };

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton to="/multiplayer" />

      <View style={styles.content}>
        <Text style={styles.title}>Dołącz do gry</Text>
        {nick && <Text style={styles.subtitle}>Grasz jako {nick}</Text>}
        <TextField
          label="Kod pokoju"
          value={code}
          onChangeText={(text) => {
            setCode(normalizeCodeInput(text));
            roomClient.clearError();
          }}
          placeholder="ABCDE"
          large
          maxLength={CODE_LENGTH + 2}
          autoCapitalize="characters"
          autoComplete="off"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!connecting}
          hint={`${CODE_LENGTH} znaków – kod widzi twórca pokoju na swoim ekranie.`}
          error={error}
        />
        <MenuButton
          label={connecting ? 'Łączę…' : 'Dołącz'}
          color={colors.solo}
          baseColor={colors.soloBase}
          width={220}
          disabled={connecting || !isCompleteCode(code)}
          onPress={submit}
        />
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
    gap: 14,
  },
  title: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  subtitle: {
    color: colors.starYellow,
    fontSize: 16,
    fontWeight: '800',
    marginTop: -10,
  },
});
