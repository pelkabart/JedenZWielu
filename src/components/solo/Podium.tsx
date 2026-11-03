import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SkinFigure } from '@/components/skins/SkinFigure';
import { colors } from '@/constants/theme';
import type { PlayerState } from '@/game/types';
import { useIdleFace } from '@/hooks/useIdleFace';
import type { Skin } from '@/skins/catalog';
import { podiumExpression } from '@/skins/expression';

export type PodiumBubble = { kind: 'thinking' } | { kind: 'answer'; text: string | null; correct: boolean };

/** Popiersie nad pulpitem: wysokość okna i bok obrazka względem szerokości pulpitu. */
const BUST_HEIGHT = 0.72;
const BUST_IMAGE_SIZE = 1.7;

type Props = {
  player: PlayerState;
  /** `null`: rysunek zastępczy, gdy zabrakło skórek. */
  skin: Skin | null;
  color: string;
  width: number;
  /** Gracz, na którego teraz patrzymy (odpowiada albo wskazuje). */
  highlighted: boolean;
  selectable: boolean;
  showScore: boolean;
  bubble: PodiumBubble | null;
  onPress?: () => void;
};

export function Podium({ player, skin, color, width, highlighted, selectable, showScore, bubble, onPress }: Props) {
  const head = width * 0.4;
  const label = player.isHuman ? 'TY' : player.name.charAt(0);
  // Postać, która odpadła, nie mruga: zostaje z otwartymi oczami, przyciemniona.
  const idle = useIdleFace(!player.eliminated);

  return (
    <Pressable
      disabled={!selectable}
      onPress={onPress}
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityLabel={selectable ? `Wskaż: ${player.name}` : player.name}
      style={[styles.root, { width }]}
    >
      {bubble && (
        <View
          style={[
            styles.bubble,
            bubble.kind === 'answer' && (bubble.correct ? styles.bubbleCorrect : styles.bubbleWrong),
          ]}
        >
          <Text style={styles.bubbleText} numberOfLines={2}>
            {bubble.kind === 'thinking' ? '…' : `${bubble.correct ? '✓' : '✗'} ${bubble.text ?? '(brak)'}`}
          </Text>
        </View>
      )}

      {skin ? (
        <SkinFigure
          skin={skin}
          expression={podiumExpression(bubble, idle)}
          width={width}
          height={width * BUST_HEIGHT}
          imageSize={width * BUST_IMAGE_SIZE}
          dimmed={player.eliminated}
        />
      ) : (
        <>
          <View style={[styles.head, player.eliminated && styles.eliminated, { width: head, height: head, borderRadius: head / 2, backgroundColor: color }]}>
            <Text style={[styles.headLabel, { fontSize: head * (player.isHuman ? 0.36 : 0.5) }]}>{label}</Text>
          </View>
          <View style={[styles.body, player.eliminated && styles.eliminated, { width: width * 0.66, height: width * 0.28, backgroundColor: color }]} />
        </>
      )}

      <View
        style={[
          styles.desk,
          { height: width * 0.62 },
          player.eliminated && styles.eliminated,
          highlighted && styles.deskHighlighted,
          selectable && styles.deskSelectable,
        ]}
      >
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {player.name}
        </Text>
        <View style={styles.lives}>
          {Array.from({ length: 3 }, (_, i) => (
            <View key={i} style={[styles.lamp, i < player.lives ? styles.lampOn : styles.lampOff]} />
          ))}
        </View>
        {showScore && <Text style={styles.score}>{player.score} pkt</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  eliminated: {
    opacity: 0.35,
  },
  bubble: {
    position: 'absolute',
    top: -34,
    zIndex: 2,
    minWidth: 44,
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.white,
  },
  bubbleCorrect: {
    backgroundColor: '#B8F5A8',
  },
  bubbleWrong: {
    backgroundColor: '#FFB3B3',
  },
  bubbleText: {
    color: colors.outline,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  head: {
    borderWidth: 3,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headLabel: {
    color: colors.outline,
    fontWeight: '900',
  },
  body: {
    marginTop: -6,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.outline,
  },
  desk: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  deskHighlighted: {
    borderColor: colors.starYellow,
    boxShadow: `0 0 12px ${colors.starYellow}`,
  },
  deskSelectable: {
    borderColor: colors.multi,
    borderStyle: 'dashed',
  },
  name: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  lives: {
    flexDirection: 'row',
    gap: 5,
  },
  lamp: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outline,
  },
  lampOn: {
    backgroundColor: colors.starYellow,
  },
  lampOff: {
    backgroundColor: colors.navyDeep,
  },
  score: {
    color: colors.starYellow,
    fontSize: 14,
    fontWeight: '900',
  },
});
