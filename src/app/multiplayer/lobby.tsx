import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
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
  // Ostatni stan inny niż „idle”. Po wyjściu ekran zostaje taki, jaki był, aż zniknie: przerysowanie
  // ekranu w trakcie odpinania wywracało Fabric (`addViewAt: View already has a parent`, zob. 7.76).
  const [state, setState] = useState(roomClient.getState);

  useEffect(() => {
    let removing = false;
    const sync = () => {
      if (removing) return;
      const next = roomClient.getState();
      // Ekran bez połączenia („Wyjdź”, otwarcie bezpośrednio) wraca do wyboru.
      if (next.status === 'idle') {
        removing = true;
        router.replace('/multiplayer');
      } else {
        setState(next);
      }
    };
    sync();
    const unsubscribe = roomClient.subscribe(sync);
    // Każde wyjście z poczekalni (strzałka, systemowe „wstecz”) zwalnia miejsce w pokoju. Ekran już znika,
    // więc ani nie przerysowujemy go, ani nie nawigujemy drugi raz.
    const unlisten = navigation.addListener('beforeRemove', () => {
      removing = true;
      roomClient.leave();
    });
    return () => {
      unsubscribe();
      unlisten();
    };
  }, [navigation]);

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
  error: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 480,
  },
});
