import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuestionSet } from '@/categories/types';
import { colors } from '@/constants/theme';

type Props = {
  set: QuestionSet;
  onDelete?: () => void;
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

export function CategoryRow({ set, onDelete }: Props) {
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Usuń kategorię ${set.name}`}
          hitSlop={8}
          onPress={onDelete}
          style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
        >
          <Ionicons name="trash" size={20} color={colors.outline} />
        </Pressable>
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
  delete: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 0 ${colors.outline}`,
  },
  deletePressed: {
    transform: [{ translateY: 2 }],
    boxShadow: `0 1px 0 ${colors.outline}`,
  },
});
