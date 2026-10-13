import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Question } from '@/game/types';

import { TimerBar } from './TimerBar';

type Props = {
  question: Question;
  deadline: number | null;
  totalMs: number | null;
  paused: boolean;
  /** Mało miejsca nad klawiaturą: bez nagłówka i z mniejszym pytaniem. */
  compact?: boolean;
  onSubmit: (text: string) => void;
};

/**
 * Widok na czas wpisywania odpowiedzi. W poziomie klawiatura zasłania ok. połowę ekranu,
 * więc wszystko, co potrzebne, mieści się w górnej części.
 */
export function AnswerPanel({ question, deadline, totalMs, paused, compact = false, onSubmit }: Props) {
  const [text, setText] = useState('');
  const submit = () => {
    if (text.trim() !== '') onSubmit(text);
  };

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      {!compact && (
        <View style={styles.header}>
          <Text style={styles.category}>{question.category}</Text>
          <Text style={styles.turn}>Twoja kolej!</Text>
        </View>
      )}
      <Text style={[styles.question, compact && styles.questionCompact]} numberOfLines={2}>
        {question.question}
      </Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Dotknij, aby wpisać odpowiedź…"
          placeholderTextColor="#7C8DB5"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="done"
          submitBehavior="submit"
          // Bez tego Android w poziomie otwiera pełnoekranowe pole edycji.
          disableFullscreenUI
          editable={!paused}
        />
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel="Zatwierdź odpowiedź"
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, text.trim() === '' && styles.submitDisabled]}
        >
          <Text style={styles.submitLabel}>OK</Text>
        </Pressable>
      </View>
      <TimerBar deadline={deadline} totalMs={totalMs} paused={paused} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    padding: 10,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.navyDeep,
  },
  rootCompact: {
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.multi,
    color: colors.outline,
    fontSize: 11,
    fontWeight: '900',
  },
  turn: {
    color: colors.starYellow,
    fontSize: 13,
    fontWeight: '900',
  },
  question: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  questionCompact: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.white,
    color: colors.outline,
    fontSize: 16,
    fontWeight: '700',
  },
  submit: {
    width: 64,
    height: 42,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.solo,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  submitPressed: {
    transform: [{ translateY: 2 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    color: colors.outline,
    fontSize: 16,
    fontWeight: '900',
  },
});
