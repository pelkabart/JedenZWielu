import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoonBackground } from '@/components/home/CartoonBackground';
import { MenuButton } from '@/components/home/MenuButton';
import { colors } from '@/constants/theme';
import { humanTurn, visibleQuestion, type SoloView } from '@/game/controller/SoloController';
import { hostLine, introLine, PHASE_TITLES } from '@/game/controller/hostLine';
import { getPlayer, pickTargets } from '@/game/engine';
import { DIFFICULTY_PRESETS } from '@/game/rules';
import { HUMAN_ID } from '@/game/solo';
import type { Difficulty, PlayerState, Question } from '@/game/types';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useSoloController } from '@/hooks/useSoloController';
import { createLogger } from '@/lib/log';

import { AnswerPanel } from './AnswerPanel';
import { answerLayout, KEYBOARD_GAP } from './answerLayout';
import { Host } from './Host';
import { PhaseBanner } from './PhaseBanner';
import { Podium, type PodiumBubble } from './Podium';
import { QuestionCard } from './QuestionCard';
import { Results } from './Results';

const SEAT_COLORS = ['#FF7A9C', '#4FD1E8', '#FFC83D', '#8BE07A', '#B98CFF'];
/** Przesunięcie pulpitów w pionie — układają się w łuk. */
const ARC = [16, 6, 0, 6, 16];
const PODIUM_GAP = 22;
/** Szerokość pulpitu wg miejsca: skrajne są największe, środkowy najmniejszy (efekt perspektywy). */
const SEAT_SCALE = [1, 0.92, 0.84, 0.92, 1];

const log = createLogger('ekran-gry');

type Props = {
  difficulty: Difficulty;
  /** Pytania wybranej kategorii. */
  questions: Question[];
  onPlayAgain: () => void;
};

function bubbleFor(view: SoloView, player: PlayerState): PodiumBubble | null {
  const { overlay } = view;
  if (overlay?.kind === 'reveal' && overlay.playerId === player.id) {
    return { kind: 'answer', text: overlay.text, correct: overlay.correct };
  }
  return view.thinkingId === player.id ? { kind: 'thinking' } : null;
}

function isHighlighted(view: SoloView, player: PlayerState): boolean {
  const { overlay, game } = view;
  if (overlay?.kind === 'reveal' || overlay?.kind === 'buzz' || overlay?.kind === 'intro') return overlay.playerId === player.id;
  if (overlay?.kind === 'pick') return overlay.targetId === player.id;
  // W czasie czytania pytania wyróżniamy tego, kto będzie odpowiadał.
  if (overlay && overlay.kind !== 'reading') return false;
  const { pending } = game;
  if (pending.kind === 'answer') return pending.playerId === player.id;
  if (pending.kind === 'pick') return pending.chooserId === player.id;
  return false;
}

export function SoloGame({ difficulty, questions, onPlayAgain }: Props) {
  const { controller, view } = useSoloController(difficulty, questions);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const { game, overlay } = view;
  const turn = humanTurn(view);
  const question = visibleQuestion(view);
  const finished = game.phase === 'finished' && overlay === null;
  const humanOut = getPlayer(game, HUMAN_ID).eliminated;
  const targets = turn === 'pick' ? pickTargets(game, HUMAN_ID).map((p) => p.id) : [];
  const allowSelf = game.pending.kind === 'pick' && game.pending.allowSelf;

  // Własne okno zamiast Alert.alert: na webie Alert nic nie pokazuje, a gra zostawała zatrzymana.
  const [exitAsked, setExitAsked] = useState(false);

  const confirmExit = () => {
    if (finished) {
      router.dismissAll();
      return;
    }
    controller.pause();
    setExitAsked(true);
  };

  const stayInGame = () => {
    setExitAsked(false);
    controller.start();
  };

  const leaveGame = () => {
    log.info('Gracz przerwał grę', { phase: game.phase });
    // Po odświeżeniu strony gra jest jedynym ekranem w stosie, więc dismissAll nie ma dokąd wrócić.
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (finished) return false;
      if (exitAsked) stayInGame();
      else confirmExit();
      return true;
    });
    return () => subscription.remove();
  });

  useEffect(() => {
    if (turn !== 'answer') Keyboard.dismiss();
  }, [turn]);

  // Rozmiary liczone z ekranu, żeby scena zmieściła się na niskich telefonach w poziomie.
  const usableWidth = width - insets.left - insets.right - 24;
  const usableHeight = height - insets.top - insets.bottom - 16;
  // Prowadzący ma szerokość środkowego pulpitu. Rząd jest wyśrodkowany, a po obu stronach zostaje miejsce na prowadzącego.
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

  const answering = answerLayout({ windowHeight: height, keyboardHeight, safeTop: insets.top });

  const finalCounter =
    game.phase === 'final' ? `Pytanie ${game.rules.finalQuestionPool - game.finalQuestionsLeft}/${game.rules.finalQuestionPool}` : null;

  return (
    <View style={styles.container}>
      <CartoonBackground />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 8,
            paddingLeft: insets.left + 12,
            paddingRight: insets.right + 12,
          },
        ]}
      >
        {/* Przy otwartej klawiaturze pasek znika, żeby zostało więcej miejsca na pytanie i pole odpowiedzi. */}
        {!(turn === 'answer' && answering.keyboardOpen) && (
          <View style={styles.topBar}>
            <Pressable
              onPress={confirmExit}
              accessibilityRole="button"
              accessibilityLabel="Przerwij grę"
              hitSlop={10}
              style={({ pressed }) => [styles.exit, pressed && styles.exitPressed]}
            >
              <Ionicons name="close" size={22} color={colors.outline} />
            </Pressable>
            <Text style={styles.phase}>{PHASE_TITLES[game.phase]}</Text>
            <Text style={styles.meta}>
              {[finalCounter, DIFFICULTY_PRESETS[difficulty].label].filter(Boolean).join('  •  ')}
            </Text>
          </View>
        )}

        {turn === 'answer' && question ? (
          // Ten sam element niezależnie od klawiatury — zmienia się tylko styl, więc pole nie traci fokusu ani tekstu.
          <View
            style={
              answering.keyboardOpen
                ? [
                    styles.aboveKeyboard,
                    {
                      top: insets.top + KEYBOARD_GAP,
                      bottom: answering.bottom,
                      left: insets.left + 12,
                      right: insets.right + 12,
                    },
                  ]
                : undefined
            }
          >
            <AnswerPanel
              key={`${question.id}-${game.cursor}`}
              question={question}
              deadline={view.deadline}
              totalMs={view.timerMs}
              paused={view.paused}
              compact={answering.compact}
              onSubmit={(text) => controller.submitAnswer(text)}
              onListening={(listening) => controller.setListening(listening)}
              choices={view.choices?.questionId === question.id ? view.choices.options : null}
            />
          </View>
        ) : (
          <Pressable style={styles.stage} onPress={() => controller.skip()} accessible={false}>
            <View style={[styles.hostSlot, { width: hostWidth }]}>
              <Host line={hostLine(view)} size={hostWidth * 0.42} />
            </View>

            <View style={styles.main}>
              <QuestionCard
                question={question}
                announcement={overlay?.kind === 'intro' ? introLine(view, overlay.playerId) : null}
                deadline={view.deadline}
                totalMs={view.timerMs}
                paused={view.paused}
                reading={overlay?.kind === 'reading'}
              />

              <View style={[styles.podiums, { paddingHorizontal: hostWidth + 12, paddingTop: 36 + usableHeight * 0.07 }]}>
                {game.players.map((player) => (
                  <View key={player.id} style={{ transform: [{ translateY: ARC[player.seat] ?? 0 }] }}>
                    <Podium
                      player={player}
                      color={SEAT_COLORS[player.seat % SEAT_COLORS.length]}
                      width={podiumUnit * (SEAT_SCALE[player.seat] ?? 1)}
                      highlighted={isHighlighted(view, player)}
                      selectable={targets.includes(player.id)}
                      showScore={game.phase === 'final' || (game.phase === 'finished' && player.finalist)}
                      bubble={bubbleFor(view, player)}
                      onPress={() => controller.pick(player.id)}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                {turn === 'buzz' && (
                  <MenuButton label="ZGŁASZAM SIĘ!" color={colors.extras} baseColor={colors.extrasBase} width={260} onPress={() => controller.buzz()} />
                )}
                {turn === 'pick' && (
                  <>
                    <Text style={styles.hint}>Dotknij pulpitu gracza, którego wskazujesz</Text>
                    {allowSelf && (
                      <MenuButton
                        label="Biorę na siebie"
                        color={colors.solo}
                        baseColor={colors.soloBase}
                        width={200}
                        onPress={() => controller.pick(HUMAN_ID)}
                      />
                    )}
                  </>
                )}
                {humanOut && !finished && (
                  <MenuButton
                    label="Pomiń do wyników"
                    color={colors.multi}
                    baseColor={colors.multiBase}
                    width={220}
                    onPress={() => controller.fastForward()}
                  />
                )}
              </View>
            </View>
          </Pressable>
        )}
      </View>

      {overlay?.kind === 'banner' && <PhaseBanner phase={overlay.phase} onPress={() => controller.skip()} />}
      {exitAsked && (
        // Dotknięcie tła poza okienkiem wznawia grę; samo okienko pochłania dotknięcia.
        <Pressable style={styles.exitBackdrop} onPress={stayInGame} accessible={false}>
          <Pressable style={styles.exitCard} onPress={() => {}} accessible={false}>
            <Text style={styles.exitTitle}>Przerwać grę?</Text>
            <Text style={styles.exitText}>Postęp tej rozgrywki zostanie utracony.</Text>
            <View style={styles.exitActions}>
              <MenuButton label="Graj dalej" color={colors.solo} baseColor={colors.soloBase} width={170} onPress={stayInGame} />
              <MenuButton label="Wyjdź" color={colors.multi} baseColor={colors.multiBase} width={170} onPress={leaveGame} />
            </View>
          </Pressable>
        </Pressable>
      )}
      {finished && <Results game={game} onPlayAgain={onPlayAgain} onMenu={() => router.dismissAll()} />}
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
    paddingTop: 36,
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
  exitBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 36, 0.6)',
  },
  exitCard: {
    maxWidth: 460,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.white,
  },
  exitTitle: {
    color: colors.outline,
    fontSize: 22,
    fontWeight: '900',
  },
  exitText: {
    color: colors.outline,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  exitActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
});
