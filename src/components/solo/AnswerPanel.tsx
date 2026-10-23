import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Question } from '@/game/types';
import { useVoiceAnswer } from '@/hooks/useVoiceAnswer';

import { TimerBar } from './TimerBar';

type Props = {
  question: Question;
  deadline: number | null;
  totalMs: number | null;
  paused: boolean;
  /** Mało miejsca nad klawiaturą: bez nagłówka i z mniejszym pytaniem. */
  compact?: boolean;
  onSubmit: (text: string) => void;
  /** Mikrofon zaczął albo przestał słuchać (sterownik ucisza wtedy lektora). */
  onListening?: (listening: boolean) => void;
  /** Opcje A–D; brak = odpowiedź wpisywana albo mówiona. */
  choices?: string[] | null;
};

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Widok na czas odpowiedzi: wpisanej albo powiedzianej (mikrofon). W poziomie klawiatura zasłania
 * ok. połowę ekranu, więc wszystko, co potrzebne, mieści się w górnej części.
 */
export function AnswerPanel({ question, deadline, totalMs, paused, compact = false, onSubmit, onListening, choices }: Props) {
  const [text, setText] = useState('');
  const submit = () => {
    if (text.trim() !== '') onSubmit(text);
  };
  // Przy wyborze A–D mikrofon nie nasłuchuje, bo odpowiedź to jeden z przycisków.
  const voice = useVoiceAnswer(question, paused || choices != null, {
    onTranscript: setText,
    onAnswer: onSubmit,
    onListening: (listening) => onListening?.(listening),
  });

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
      {choices ? (
        <View style={styles.choices}>
          {choices.map((option, i) => (
            <Pressable
              key={option}
              onPress={() => onSubmit(option)}
              accessibilityRole="button"
              accessibilityLabel={`${LETTERS[i]}: ${option}`}
              style={({ pressed }) => [styles.choice, pressed && styles.submitPressed]}
            >
              <Text style={styles.choiceLetter}>{LETTERS[i]}</Text>
              <Text style={styles.choiceText} numberOfLines={2}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder={voice.listening ? 'Słucham…' : voice.available ? 'Wpisz albo powiedz odpowiedź…' : 'Dotknij, aby wpisać odpowiedź…'}
          placeholderTextColor="#7C8DB5"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="done"
          submitBehavior="submit"
          // Bez tego Android w poziomie otwiera pełnoekranowe pole edycji.
          disableFullscreenUI
          editable={!paused && !voice.listening}
        />
        {voice.available && (
          <Pressable
            onPress={voice.toggle}
            disabled={paused}
            accessibilityRole="button"
            accessibilityLabel={voice.listening ? 'Zakończ mówienie' : 'Powiedz odpowiedź'}
            style={({ pressed }) => [styles.mic, voice.listening && styles.micListening, pressed && styles.submitPressed]}
          >
            <Ionicons name={voice.listening ? 'stop' : 'mic'} size={22} color={colors.outline} />
          </Pressable>
        )}
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel="Zatwierdź odpowiedź"
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, text.trim() === '' && styles.submitDisabled]}
        >
          <Text style={styles.submitLabel}>OK</Text>
        </Pressable>
      </View>
      )}
      {voice.message && <Text style={styles.message}>{voice.message}</Text>}
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
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.navy,
  },
  choiceLetter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '900',
  },
  choiceText: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
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
  mic: {
    width: 48,
    height: 42,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.multi,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  micListening: {
    backgroundColor: colors.extras,
  },
  message: {
    color: colors.starYellow,
    fontSize: 12,
    fontWeight: '800',
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
