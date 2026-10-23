import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { AnswerPanel } from '@/components/solo/AnswerPanel';
import { answerLayout, KEYBOARD_GAP } from '@/components/solo/answerLayout';
import { Host } from '@/components/solo/Host';
import { Podium, type PodiumBubble } from '@/components/solo/Podium';
import { QuestionCard } from '@/components/solo/QuestionCard';
import { TimerBar } from '@/components/solo/TimerBar';
import { colors } from '@/constants/theme';
import type { PotatoView } from '@/game/potato/controller/PotatoController';
import { activePlayers, POTATO, type PotatoPhase, type PotatoPlayer } from '@/game/potato/engine';
import { legendFor, PHASE_RULE, PHASE_TITLE } from '@/game/potato/texts';
import { DIFFICULTY_PRESETS } from '@/game/rules';
import type { Difficulty, PlayerState } from '@/game/types';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { usePotatoController } from '@/hooks/usePotatoController';

const SEAT_COLORS = ['#FF7A9C', '#4FD1E8', '#FFC83D', '#8BE07A', '#B98CFF'];
/** Przesunięcie pulpitów w pionie — układają się w łuk. */
const ARC = [16, 6, 0, 6, 16];
const PODIUM_GAP = 22;
/** Szerokość pulpitu wg miejsca: skrajne największe, środkowy najmniejszy (efekt perspektywy). */
const SEAT_SCALE = [1, 0.92, 0.84, 0.92, 1];

type Props = {
  difficulty: Difficulty;
  onPlayAgain: () => void;
};

/** Pulpit pokazuje zasób bieżącej rundy: osłonę w rundzie 2, punkty w sprincie, życia w pozostałych. */
function toPodium(p: PotatoPlayer, phase: PotatoPhase): PlayerState {
  return {
    id: p.id,
    name: p.name,
    isHuman: p.isHuman,
    botId: p.botId,
    seat: p.seat,
    // Odpadający pokazują zero kropek; w rundzie 2 kropki to osłona, w pozostałych życia.
    lives: p.eliminated ? 0 : phase === 'round2' ? p.shield : p.lives,
    score: p.points,
    eliminated: p.eliminated,
    eliminatedOrder: p.eliminatedAt,
    finalist: phase === 'duel',
    correct: 0,
    wrong: p.errors,
    questionsWithoutTurn: 0,
  };
}

function bubbleFor(view: PotatoView, id: string): PodiumBubble | null {
  const { overlay } = view;
  if (overlay?.kind === 'reveal' && overlay.playerId === id) {
    return { kind: 'answer', text: overlay.text, correct: overlay.correct };
  }
  return view.thinkingId === id ? { kind: 'thinking' } : null;
}

function hostLine(view: PotatoView): string {
  const { overlay, awaitingPick, thinkingId, game } = view;
  if (overlay?.kind === 'finished') return 'Mamy zwycięzcę!';
  if (overlay?.kind === 'round') return PHASE_RULE[overlay.phase];
  if (overlay?.kind === 'reveal') {
    const name = game.players.find((p) => p.id === overlay.playerId)?.name ?? '';
    return overlay.correct ? `Dobrze, ${name}!` : `Niestety. Poprawna odpowiedź: ${overlay.correctAnswer}`;
  }
  if (awaitingPick) return 'Komu przekazujesz pytanie?';
  if (thinkingId) return 'Czekamy na odpowiedź…';
  return 'Gramy dalej.';
}

export function PotatoGame({ difficulty, onPlayAgain }: Props) {
  const { controller, view } = usePotatoController(difficulty);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [blindMode, setBlindMode] = useState(false);

  const { game, overlay, awaitingPick } = view;
  const phase = game.phase;
  const me = game.players.find((p) => p.isHuman)!;
  const humanTurn = overlay === null && awaitingPick === null && game.holderId === me.id && game.question !== null;
  const blindAvailable = humanTurn && phase === 'round1' && !me.blindPassUsed;
  // Tryb odbicia działa tylko wtedy, gdy odbicie jest dostępne (poza tym zostaje wyłączony).
  const blindOn = blindMode && blindAvailable;
  const finished = overlay?.kind === 'finished';

  const [exitAsked, setExitAsked] = useState(false);

  /** Wyjście z gry: zatrzymuje zegary i wraca do menu. */
  const leave = () => {
    controller.stop();
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  /** X: wstrzymuje grę i pyta, czy na pewno wyjść (po zakończeniu gry wychodzi od razu). */
  const askExit = () => {
    if (finished) {
      leave();
      return;
    }
    controller.pause();
    setExitAsked(true);
  };

  const stayInGame = () => {
    setExitAsked(false);
    controller.unpause();
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitAsked) stayInGame();
      else askExit();
      return true;
    });
    return () => subscription.remove();
  });

  useEffect(() => {
    if (!humanTurn) Keyboard.dismiss();
  }, [humanTurn]);

  // Rozmiary liczone z ekranu, jak w grze z poprzednich zasad: prowadzący ma szerokość środkowego pulpitu.
  const usableWidth = width - insets.left - insets.right - 24;
  const usableHeight = height - insets.top - insets.bottom - 16;
  const scaleSum = SEAT_SCALE.reduce((sum, scale) => sum + scale, 0);
  const centerScale = SEAT_SCALE[Math.floor(SEAT_SCALE.length / 2)];
  const podiumUnit = Math.max(
    64,
    Math.min(
      (usableWidth - 24 - PODIUM_GAP * (SEAT_SCALE.length - 1)) / (scaleSum + 2 * centerScale),
      (usableHeight - 230) / 1.35,
      160,
    ),
  );
  const hostWidth = podiumUnit * centerScale;

  const targets = awaitingPick
    ? activePlayers(game)
        .filter((p) => awaitingPick.allowSelf || p.id !== awaitingPick.chooserId)
        .map((p) => p.id)
    : blindOn
      ? activePlayers(game)
          .filter((p) => p.id !== me.id)
          .map((p) => p.id)
      : [];

  const onPickPlayer = (id: string) => {
    if (awaitingPick) {
      controller.pick(id);
      return;
    }
    if (blindOn) {
      setBlindMode(false);
      controller.blindPass(id);
    }
  };

  const answering = answerLayout({ windowHeight: height, keyboardHeight, safeTop: insets.top });
  const choices = game.question && view.choices?.questionId === game.question.id ? view.choices.options : null;
  const difficultyLabel = DIFFICULTY_PRESETS[difficulty].label;

  return (
    <View style={styles.container}>
      <CartoonBackground />

      <View style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
        {!(humanTurn && answering.keyboardOpen) && (
          <View style={styles.topBar}>
            <Pressable
              onPress={askExit}
              accessibilityRole="button"
              accessibilityLabel="Przerwij grę"
              hitSlop={10}
              style={({ pressed }) => [styles.exit, pressed && styles.exitPressed]}
            >
              <Ionicons name="close" size={22} color={colors.outline} />
            </Pressable>
            <Text style={styles.phase}>{PHASE_TITLE[phase]}</Text>
            <Text style={styles.meta}>
              {difficultyLabel}
            </Text>
          </View>
        )}

        {!(humanTurn && answering.keyboardOpen) && legendFor(phase, game.multiplier) !== '' && (
          <View style={styles.legend}>
            <Text style={styles.legendText}>{legendFor(phase, game.multiplier)}</Text>
          </View>
        )}

        {phase === 'sprint' && view.sprintEndsAt !== null && !(humanTurn && answering.keyboardOpen) && (
          <TimerBar deadline={view.sprintEndsAt} totalMs={POTATO.sprintMs} paused={false} />
        )}

        <View style={styles.stage}>
          <View style={[styles.hostSlot, { width: hostWidth }]}>
            <Host line={hostLine(view)} size={hostWidth * 0.42} />
          </View>

          <View style={styles.main}>
            {humanTurn && game.question ? (
              <View
                style={
                  answering.keyboardOpen
                    ? [styles.aboveKeyboard, { top: insets.top + KEYBOARD_GAP, bottom: answering.bottom, left: insets.left + 12, right: insets.right + 12 }]
                    : undefined
                }
              >
                <AnswerPanel
                  key={`${game.question.id}-${game.cursor}`}
                  question={game.question}
                  deadline={view.deadline}
                  totalMs={view.timerMs}
                  paused={false}
                  compact={answering.compact}
                  choices={choices}
                  onSubmit={(text) => controller.submitAnswer(text)}
                />
              </View>
            ) : (
              <QuestionCard
                question={game.question}
                deadline={view.deadline}
                totalMs={view.timerMs}
                paused={false}
              />
            )}

            <View style={[styles.podiums, { paddingHorizontal: hostWidth + 12, paddingTop: 36 + usableHeight * 0.07 }]}>
              {game.players.map((player) => (
                <View key={player.id} style={{ transform: [{ translateY: ARC[player.seat] ?? 0 }] }}>
                  <Podium
                    player={toPodium(player, phase)}
                    color={SEAT_COLORS[player.seat % SEAT_COLORS.length]}
                    width={podiumUnit * (SEAT_SCALE[player.seat] ?? 1)}
                    highlighted={game.holderId === player.id}
                    selectable={targets.includes(player.id)}
                    showScore={phase === 'sprint' || phase === 'finished'}
                    bubble={bubbleFor(view, player.id)}
                    onPress={() => onPickPlayer(player.id)}
                  />
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              {awaitingPick ? (
                <>
                  <Text style={styles.hint}>Dotknij gracza, którego wybierasz</Text>
                  {awaitingPick.allowSelf && (
                    <MenuButton
                      label="Biorę na siebie"
                      color={colors.solo}
                      baseColor={colors.soloBase}
                      width={200}
                      onPress={() => controller.pick(me.id)}
                    />
                  )}
                </>
              ) : blindOn ? (
                <>
                  <Text style={styles.hint}>Dotknij, komu odbijasz pytanie</Text>
                  <MenuButton label="Anuluj" color={colors.multi} baseColor={colors.multiBase} width={160} onPress={() => setBlindMode(false)} />
                </>
              ) : blindAvailable ? (
                <MenuButton label="Odbicie w ciemno" color={colors.multi} baseColor={colors.multiBase} width={220} onPress={() => setBlindMode(true)} />
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {overlay?.kind === 'round' && (
        <View style={styles.backdrop} pointerEvents="none">
          <View style={styles.card}>
            <Text style={styles.title}>{PHASE_TITLE[overlay.phase]}</Text>
            <Text style={styles.rule}>{PHASE_RULE[overlay.phase]}</Text>
          </View>
        </View>
      )}

      {exitAsked && (
        // Dotknięcie tła poza okienkiem wznawia grę; samo okienko pochłania dotknięcia.
        <Pressable style={styles.backdrop} onPress={stayInGame} accessible={false}>
          <Pressable style={styles.card} onPress={() => {}} accessible={false}>
            <Text style={styles.title}>Przerwać grę?</Text>
            <Text style={styles.rule}>Postęp tej rozgrywki zostanie utracony.</Text>
            <View style={styles.actions}>
              <MenuButton label="Graj dalej" color={colors.solo} baseColor={colors.soloBase} width={170} onPress={stayInGame} />
              <MenuButton label="Wyjdź" color={colors.multi} baseColor={colors.multiBase} width={170} onPress={leave} />
            </View>
          </Pressable>
        </Pressable>
      )}

      {finished && <Finish game={game} onPlayAgain={onPlayAgain} onMenu={leave} />}
    </View>
  );
}

function Finish({ game, onPlayAgain, onMenu }: { game: PotatoView['game']; onPlayAgain: () => void; onMenu: () => void }) {
  const names = (game.ranking ?? []).map((id) => game.players.find((p) => p.id === id)?.name ?? id);
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Koniec gry</Text>
        <Text style={styles.rule}>{names.map((name, i) => `${i + 1}. ${name}`).join('   ')}</Text>
        <View style={styles.actions}>
          <MenuButton label="Zagraj ponownie" color={colors.solo} baseColor={colors.soloBase} width={200} onPress={onPlayAgain} />
          <MenuButton label="Menu" color={colors.multi} baseColor={colors.multiBase} width={140} onPress={onMenu} />
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
    gap: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  exitPressed: {
    transform: [{ translateY: 2 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
  phase: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  },
  meta: {
    marginLeft: 'auto',
    color: colors.sky,
    fontSize: 13,
    fontWeight: '800',
  },
  legend: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.navyDeep,
  },
  legendText: {
    color: colors.starYellow,
    fontSize: 13,
    fontWeight: '800',
  },
  aboveKeyboard: {
    position: 'absolute',
    justifyContent: 'flex-end',
  },
  stage: {
    flex: 1,
  },
  hostSlot: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  main: {
    flex: 1,
    justifyContent: 'space-between',
  },
  podiums: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: PODIUM_GAP,
  },
  actions: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hint: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 36, 0.6)',
  },
  card: {
    maxWidth: 460,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.white,
  },
  title: {
    color: colors.outline,
    fontSize: 22,
    fontWeight: '900',
  },
  rule: {
    color: colors.outline,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
