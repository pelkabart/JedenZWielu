import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View, type GestureResponderEvent } from 'react-native';

import { colors } from '@/constants/theme';

import { sliderValue, stepSlider } from './sliderValue';

const THUMB = 28;

interface Props {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  /** Palec w ruchu: zmiana na żywo, bez zapisu. */
  onPreview: (value: number) => void;
  /** Palec puszczony albo krok czytnika ekranu: zmiana ostateczna. */
  onCommit: (value: number) => void;
  /** Dźwięk włączony; wyłączony = suwak blednie i nie reaguje na dotyk. */
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Suwak 0–100% w stylu gry z włącznikiem dźwięku. Dotknięcie toru ustawia wartość od razu,
 * przeciąganie zmienia ją na żywo. Przy wyłączonym dźwięku suwak jest blady i zablokowany.
 */
export function VolumeSlider({ label, icon, value, onPreview, onCommit, enabled, onToggle }: Props) {
  const [width, setWidth] = useState(0);
  // Początek dotyku: położenie na torze i na ekranie. Zmieniane tylko w obsłudze dotyku.
  const drag = useRef({ startX: 0, startPageX: 0, value });

  const valueAt = (event: GestureResponderEvent) =>
    sliderValue(drag.current.startX + (event.nativeEvent.pageX - drag.current.startPageX), width);

  const move = (event: GestureResponderEvent) => {
    drag.current.value = valueAt(event);
    onPreview(drag.current.value);
  };

  const release = () => onCommit(drag.current.value);

  return (
    <View style={styles.row}>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        accessibilityLabel={`${label}: ${enabled ? 'włączony' : 'wyłączony'}`}
        trackColor={{ false: colors.outline, true: colors.categories }}
        thumbColor={colors.starYellow}
      />
      <View style={[styles.slider, !enabled && styles.disabled]}>
        <Ionicons name={!enabled || value === 0 ? 'volume-mute' : icon} size={22} color={colors.starYellow} />
        <Text style={styles.label}>{label}</Text>
        <View
          style={styles.touchArea}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Głośność: ${label}`}
          accessibilityState={{ disabled: !enabled }}
          accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }}
          accessibilityActions={enabled ? [{ name: 'increment' }, { name: 'decrement' }] : []}
          onAccessibilityAction={(event) => {
            if (enabled) onCommit(stepSlider(value, event.nativeEvent.actionName === 'increment' ? 1 : -1));
          }}
          onStartShouldSetResponder={() => enabled}
          onMoveShouldSetResponder={() => enabled}
          // Przewijanie ekranu nie zabiera suwaka w trakcie przeciągania.
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            drag.current.startX = event.nativeEvent.locationX;
            drag.current.startPageX = event.nativeEvent.pageX;
            move(event);
          }}
          onResponderMove={move}
          onResponderRelease={release}
          onResponderTerminate={release}
        >
          {/* Elementy w środku nie przechwytują dotyku, więc locationX jest zawsze względem toru. */}
          <View style={styles.track} pointerEvents="none">
            <View style={[styles.fill, { width: `${value}%` }]} />
          </View>
          <View style={[styles.thumb, { left: `${value}%` }]} pointerEvents="none" />
        </View>
        <Text style={styles.percent}>{value}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slider: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    width: 70,
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  touchArea: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.categories,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  percent: {
    width: 48,
    textAlign: 'right',
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
});
