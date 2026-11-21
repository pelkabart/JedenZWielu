import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { TextField } from '@/components/multiplayer/TextField';
import { colors } from '@/constants/theme';
import { NICK_MAX, NICK_MIN, normalizeNick } from '@/multiplayer/nick';
import { loadNick, saveNick } from '@/multiplayer/nickStore';
import { nickStorage, roomClient } from '@/multiplayer/roomStore';

export default function MultiplayerScreen() {
  const [nick, setNick] = useState('');
  const valid = normalizeNick(nick);

  // Podpowiada ostatni nick; nie nadpisuje tego, co gracz zdążył już wpisać.
  useEffect(() => {
    let active = true;
    void loadNick(nickStorage).then((saved) => {
      if (active && saved) setNick((current) => current || saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const create = () => {
    if (!valid) return;
    void saveNick(nickStorage, valid);
    roomClient.create(valid);
    router.push('/multiplayer/lobby');
  };

  const join = () => {
    if (!valid) return;
    void saveNick(nickStorage, valid);
    roomClient.clearError();
    router.push({ pathname: '/multiplayer/join', params: { nick: valid } });
  };

  return (
    <View style={styles.container}>
      <CartoonBackground />
      <BackButton />

      <View style={styles.content}>
        <Text style={styles.title}>MultiPlayer</Text>
        <TextField
          label="Twój nick"
          value={nick}
          onChangeText={setNick}
          placeholder="np. Bartek"
          maxLength={NICK_MAX + 4}
          autoCapitalize="words"
          returnKeyType="done"
          hint={`Od ${NICK_MIN} do ${NICK_MAX} znaków. Zobaczą go inni gracze w pokoju.`}
          error={nick.trim() !== '' && !valid ? `Nick musi mieć od ${NICK_MIN} do ${NICK_MAX} znaków.` : null}
        />
        <View style={styles.buttons}>
          <MenuButton label="Stwórz grę" color={colors.multi} baseColor={colors.multiBase} width={220} disabled={!valid} onPress={create} />
          <MenuButton label="Dołącz do gry" color={colors.solo} baseColor={colors.soloBase} width={220} disabled={!valid} onPress={join} />
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
    gap: 18,
  },
  title: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
});
