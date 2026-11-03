import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuestionSet } from '@/categories/types';
import { colors } from '@/constants/theme';

type Props = {
  set: QuestionSet;
  onDelete?: () => void;
  onExport?: () => void;
  /** Wyłącza przyciski na czas importu lub eksportu. */
  disabled?: boolean;
};

/** 1 pytanie, 2–4 pytania (ale 12–14 pytań), 5 pytań. */
function questionsLabel(n: number) {
  if (n === 1) return '1 pytanie';
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${few ? 'pytania' : 'pytań'}`;
}

function details(set: QuestionSet) {
  const questions = questionsLabel(set.questions.length);
  if (set.builtIn) return `${questions} · wbudowana`;
  const n = set.sourceFiles.length;
  return `${questions} · z ${n} ${n === 1 ? 'pliku' : 'plików'}`;
}

export function CategoryRow({ set, onDelete, onExport, disabled = false }: Props) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={set.builtIn ? 'library' : 'document-text'}
        size={26}
        color={set.builtIn ? colors.solo : colors.categories}
      />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {set.name}
        </Text>
        <Text style={styles.details} numberOfLines={1}>
          {details(set)}
        </Text>
      </View>
      {set.builtIn ? (
        <Ionicons name="lock-closed" size={20} color={colors.sky} accessibilityLabel="Nie można usunąć" />
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Eksportuj kategorię ${set.name}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            hitSlop={8}
            onPress={onExport}
            style={({ pressed }) => [styles.action, styles.export, pressed && styles.actionPressed, disabled && styles.actionDisabled]}
          >
            <Ionicons name="share-outline" size={20} color={colors.outline} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Usuń kategorię ${set.name}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            hitSlop={8}
            onPress={onDelete}
            style={({ pressed }) => [styles.action, styles.delete, pressed && styles.actionPressed, disabled && styles.actionDisabled]}
          >
            <Ionicons name="trash" size={20} color={colors.outline} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.panel,
  },
  text: {
    flex: 1,
  },
  name: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '900',
  },
  details: {
    color: colors.sky,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  export: {
    backgroundColor: colors.categories,
  },
  delete: {
    backgroundColor: colors.danger,
  },
  actionPressed: {
    transform: [{ translateY: 2 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
