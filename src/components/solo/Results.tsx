import { StyleSheet, Text, View } from 'react-native';

import { MenuButton } from '@/components/home/MenuButton';
import { colors } from '@/constants/theme';
import { getPlayer } from '@/game/engine';
import type { GameState } from '@/game/types';

type Props = {
  game: GameState;
  onPlayAgain: () => void;
  onMenu: () => void;
};

export function Results({ game, onPlayAgain, onMenu }: Props) {
  const ranking = (game.ranking ?? []).map((id) => getPlayer(game, id));
  const winner = ranking[0];

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{winner?.isHuman ? 'Wygrywasz!' : `Wygrywa ${winner?.name}!`}</Text>
        <View style={styles.list}>
          {ranking.map((p, i) => (
            <View key={p.id} style={[styles.row, p.isHuman && styles.rowHuman]}>
              <Text style={styles.place}>{i + 1}.</Text>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.detail}>{p.finalist ? `${p.score} pkt` : 'poza finałem'}</Text>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <MenuButton label="Zagraj ponownie" color={colors.solo} baseColor={colors.soloBase} width={220} onPress={onPlayAgain} />
          <MenuButton label="Menu" color={colors.multi} baseColor={colors.multiBase} width={140} onPress={onMenu} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 36, 0.75)',
  },
  card: {
    width: 480,
    maxWidth: '90%',
    gap: 12,
    padding: 18,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.navy,
  },
  title: {
    color: colors.starYellow,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rowHuman: {
    backgroundColor: colors.navyLight,
  },
  place: {
    width: 24,
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  name: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  detail: {
    color: colors.sky,
    fontSize: 14,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
});
