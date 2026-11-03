import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Question } from '@/game/types';

import { TimerBar } from './TimerBar';

type Props = {
  question: Question | null;
  deadline: number | null;
  totalMs: number | null;
  paused: boolean;
};

export function QuestionCard({ question, deadline, totalMs, paused }: Props) {
  return (
    <View style={[styles.card, question === null && styles.empty]}>
      {question && (
        <>
          <Text style={styles.category}>{question.category}</Text>
          <Text style={styles.text} numberOfLines={3}>
            {question.question}
          </Text>
        </>
      )}
      <TimerBar deadline={deadline} totalMs={totalMs} paused={paused} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 10,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.navyDeep,
  },
  empty: {
    opacity: 0,
  },
  category: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.multi,
    color: colors.outline,
    fontSize: 11,
    fontWeight: '900',
  },
  text: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
});
