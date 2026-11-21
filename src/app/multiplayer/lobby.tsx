import { router, useNavigation } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { PlayerSlots } from '@/components/multiplayer/PlayerSlots';
import { colors } from '@/constants/theme';
import { MAX_PLAYERS } from '@/multiplayer/protocol';
import { roomClient } from '@/multiplayer/roomStore';

export default function LobbyScreen() {
  const navigation = useNavigation();
  const state = useSyncExternalStore(roomClient.subscribe, roomClient.getState);

  // Ekran bez połączenia (wyjście, otwarcie bezpośrednio) wraca do wyboru.
  useEffect(() => {
    if (state.status === 'idle') router.replace('/multiplayer');
  }, [state.status]);

  // Każde wyjście z poczekalni (przycisk, systemowe „wstecz”) zwalnia miejsce w pokoju.
  useEffect(() => navigation.addListener('beforeRemove', () => roomClient.leave()), [navigation]);

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton to="/multiplayer" />

      <View style={styles.content}>
        {state.status === 'connecting' && (
          <>
            <ActivityIndicator size="large" color={colors.starYellow} />
            <Text style={styles.info}>{state.action === 'create' ? 'Tworzę pokój…' : 'Dołączam…'}</Text>
          </>
        )}

        {state.status === 'error' && (
          <>
            <Text style={styles.title}>Ups!</Text>
            <Text style={styles.error}>{state.message}</Text>
            <MenuButton
              label="Wróć"
              color={colors.solo}
              baseColor={colors.soloBase}
              width={220}
              onPress={() => router.replace('/multiplayer')}
            />
          </>
        )}

        {state.status === 'in-room' && (
          <>
            <View style={styles.header}>
              <Text style={styles.codeLabel}>Kod pokoju</Text>
              <Text style={styles.code} accessibilityLabel={`Kod pokoju ${state.room.code.split('').join(' ')}`}>
                {state.room.code}
              </Text>
              <Text style={styles.info}>
                Podaj ten kod znajomym · {state.room.players.length}/{MAX_PLAYERS} graczy
              </Text>
            </View>
            <PlayerSlots players={state.room.players} youId={state.youId} maxPlayers={MAX_PLAYERS} />
            <Text style={styles.hint}>Rozgrywka multiplayer pojawi się w kolejnej wersji.</Text>
            <MenuButton label="Wyjdź" color={colors.extras} baseColor={colors.extrasBase} width={200} onPress={() => roomClient.leave()} />
          </>
        )}
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
    gap: 12,
    paddingHorizontal: 80,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  codeLabel: {
    color: colors.starYellow,
    fontSize: 15,
    fontWeight: '900',
  },
  code: {
    color: colors.white,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 10,
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  info: {
    color: colors.sky,
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    color: colors.sky,
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 480,
  },
});
