import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/home/MenuButton';
import { SkinFigure } from '@/components/skins/SkinFigure';
import { colors } from '@/constants/theme';
import type { PotatoState } from '@/game/potato/engine';
import { createLogger } from '@/lib/log';
import type { Skin } from '@/skins/catalog';

import { SEAT_COLORS } from './gameDisplay';
import { scoreboardHeadline, scoreboardNote, scoreboardRowHeight, scoreboardRows, type ScoreboardRow } from './scoreboardData';

const log = createLogger('tabela-wynikow');

const REVEAL_STEP_MS = 160;
const MEDALS = ['#FFD54A', '#D5DEEA', '#E8A56B'];
const HERO_WIDTH = 170;
const HERO_HEIGHT = 150;
const HERO_IMAGE = 260;
const FACE_IMAGE_SCALE = 1.9;

type Props = {
  game: PotatoState;
  skins: Record<string, Skin | null | undefined>;
  onPlayAgain: () => void;
  onMenu: () => void;
};

export function Scoreboard({ game, skins, onPlayAgain, onMenu }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rows = scoreboardRows(game);
  const headline = scoreboardHeadline(game);
  const note = scoreboardNote(game);
  const heroSkin = headline.heroId ? (skins[headline.heroId] ?? null) : null;
  const rowHeight = scoreboardRowHeight(height - insets.top - insets.bottom - 16, rows.length);
  const humanPlace = rows.find((r) => r.isHuman)?.place ?? null;
  const winnerId = headline.won ? headline.heroId : null;

  useEffect(() => {
    log.info('Tabela wyników', { winner: winnerId, humanPlace });
  }, [winnerId, humanPlace]);

  return (
    <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
      <View style={styles.hero}>
        {headline.won && (
          <Animated.View entering={ZoomIn.delay(rows.length * REVEAL_STEP_MS).springify()} style={styles.trophy}>
            <Ionicons name="trophy" size={30} color={colors.starYellow} />
          </Animated.View>
        )}
        {heroSkin && (
          <HeroMotion won={headline.won}>
            <SkinFigure skin={heroSkin} expression={headline.won ? 'smile' : 'closed-eyes'} width={HERO_WIDTH} height={HERO_HEIGHT} imageSize={HERO_IMAGE} />
          </HeroMotion>
        )}
        <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
          {headline.title}
        </Text>
        {headline.subtitle !== '' && <Text style={styles.subtitle}>{headline.subtitle}</Text>}
      </View>

      <View style={styles.tableColumn}>
        <View style={styles.table}>
          <View style={styles.header}>
            <Text style={[styles.headerText, styles.headerName]}>Gracz</Text>
            <Text style={[styles.headerText, styles.errorsColumn]}>Błędy</Text>
            <Text style={[styles.headerText, styles.pointsColumn]}>Punkty</Text>
          </View>
          {rows.map((row) => (
            <Row key={row.id} row={row} skin={skins[row.id] ?? null} height={rowHeight} delay={(rows.length - row.place) * REVEAL_STEP_MS} />
          ))}
        </View>
        {note && <Text style={styles.note}>{note}</Text>}
        <View style={styles.actions}>
          <MenuButton label="Zagraj ponownie" color={colors.solo} baseColor={colors.soloBase} width={200} onPress={onPlayAgain} />
          <MenuButton label="Menu" color={colors.multi} baseColor={colors.multiBase} width={140} onPress={onMenu} />
        </View>
      </View>
    </View>
  );
}

/** Wiersze pojawiają się od ostatniego miejsca, więc zwycięzca wchodzi na końcu. */
function Row({ row, skin, height, delay }: { row: ScoreboardRow; skin: Skin | null; height: number; delay: number }) {
  const face = height - 8;
  const medal = MEDALS[row.place - 1];
  return (
    <Animated.View
      entering={FadeInRight.delay(delay).duration(320)}
      accessible
      accessibilityLabel={`Miejsce ${row.place}: ${row.name}, punkty: ${row.points}, błędy: ${row.errors}`}
      style={[styles.row, { height }, row.isHuman && styles.rowHuman, row.winner && styles.rowWinner]}
    >
      <View style={[styles.place, { backgroundColor: medal ?? colors.navyDeep }]}>
        <Text style={[styles.placeText, !medal && styles.placeTextPlain]}>{row.place}</Text>
      </View>
      <View style={[styles.face, { width: face, height: face, borderRadius: face / 2, backgroundColor: SEAT_COLORS[row.seat % SEAT_COLORS.length] }]}>
        {skin ? (
          <SkinFigure skin={skin} expression={row.winner ? 'smile' : 'normal'} width={face} height={face} imageSize={face * FACE_IMAGE_SCALE} />
        ) : (
          <Text style={styles.faceText}>{row.name.charAt(0)}</Text>
        )}
      </View>
      <Text style={[styles.name, row.winner && styles.textOnGold]} numberOfLines={1}>
        {row.name}
      </Text>
      <Text style={[styles.errors, styles.errorsColumn, row.winner && styles.textOnGold]}>{row.errors}</Text>
      <Text style={[styles.points, styles.pointsColumn, row.winner && styles.textOnGold]} numberOfLines={1}>
        {row.points}
      </Text>
    </Animated.View>
  );
}

/** Zwycięzca delikatnie się kołysze. Postać gracza, który odpadł, stoi spokojnie. */
function HeroMotion({ won, children }: { won: boolean; children: ReactNode }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!won) return;
    scale.set(withDelay(800, withRepeat(withSequence(withTiming(1.05, { duration: 700 }), withTiming(1, { duration: 700 })), -1)));
  }, [won, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(5, 11, 36, 0.88)',
  },
  hero: {
    width: HERO_WIDTH + 20,
    alignItems: 'center',
    gap: 2,
  },
  trophy: {
    zIndex: 1,
    marginBottom: -4,
  },
  title: {
    color: colors.starYellow,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  },
  subtitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  tableColumn: {
    flex: 1,
    maxWidth: 560,
    gap: 6,
  },
  table: {
    gap: 3,
    padding: 6,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  headerText: {
    color: colors.sky,
    fontSize: 11,
    fontWeight: '800',
  },
  headerName: {
    flex: 1,
  },
  errorsColumn: {
    width: 44,
    textAlign: 'center',
  },
  pointsColumn: {
    width: 60,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.navyLight,
  },
  rowHuman: {
    borderColor: colors.multi,
  },
  rowWinner: {
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
  },
  place: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    color: colors.outline,
    fontSize: 13,
    fontWeight: '900',
  },
  placeTextPlain: {
    color: colors.white,
  },
  face: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outline,
  },
  faceText: {
    color: colors.outline,
    fontSize: 14,
    fontWeight: '900',
  },
  name: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  errors: {
    color: colors.sky,
    fontSize: 15,
    fontWeight: '800',
  },
  points: {
    color: colors.starYellow,
    fontSize: 20,
    fontWeight: '900',
  },
  textOnGold: {
    color: colors.outline,
  },
  note: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
