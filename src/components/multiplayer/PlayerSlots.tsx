import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { PlayerView } from '@/multiplayer/protocol';

import { lobbySlots } from './lobbySlots';

type Props = {
  players: PlayerView[];
  youId: string;
  maxPlayers: number;
};

/** Miejsca w poczekalni: zajęte (nick, korona hosta, „Ty”) i puste. */
export function PlayerSlots({ players, youId, maxPlayers }: Props) {
  return (
    <View style={styles.row}>
      {lobbySlots(players, youId, maxPlayers).map((slot) =>
        slot.kind === 'player' ? (
          <View key={slot.id} style={[styles.slot, slot.you && styles.slotYou]} accessibilityLabel={slot.label}>
            <View style={styles.badge}>
              {slot.host ? (
                <MaterialCommunityIcons name="crown" size={26} color={colors.starYellow} />
              ) : (
                <Text style={styles.initial}>{slot.initial}</Text>
              )}
            </View>
            <Text style={styles.nick} numberOfLines={1}>
              {slot.nick}
            </Text>
            <Text style={styles.tag}>{slot.you ? 'Ty' : slot.host ? 'Host' : ' '}</Text>
          </View>
        ) : (
          <View key={slot.id} style={[styles.slot, styles.slotEmpty]} accessibilityLabel="Wolne miejsce">
            <View style={[styles.badge, styles.badgeEmpty]}>
              <MaterialCommunityIcons name="account-plus" size={24} color={colors.sky} />
            </View>
            <Text style={styles.waiting}>Czekam…</Text>
            <Text style={styles.tag}> </Text>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  slot: {
    width: 112,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.panel,
  },
  slotYou: {
    borderColor: colors.multi,
  },
  slotEmpty: {
    opacity: 0.55,
    borderStyle: 'dashed',
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.multiBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmpty: {
    backgroundColor: colors.navyLight,
  },
  initial: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
  },
  nick: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    maxWidth: '100%',
  },
  waiting: {
    color: colors.sky,
    fontSize: 14,
    fontWeight: '700',
  },
  tag: {
    color: colors.starYellow,
    fontSize: 12,
    fontWeight: '800',
  },
});
