import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Question } from '@/game/types';

import { TimerBar } from './TimerBar';

type Props = {
  question: Question | null;
  /** Zapowiedź („Odpowiada: …”) pokazywana zamiast pytania, zanim pytanie padnie. */
  announcement?: string | null;
  deadline: number | null;
  totalMs: number | null;
  paused: boolean;
  /** Lektor czyta pytanie (licznik jeszcze nie biegnie). */
  reading?: boolean;
};

export function QuestionCard({ question, announcement, deadline, totalMs, paused, reading = false }: Props) {
  if (announcement) {
    return (
      <View style={[styles.card, styles.announcementCard]}>
        <Text style={styles.announcement}>{announcement}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, question === null && styles.empty]}>
      {question && (
        <>
          <View style={styles.header}>
            <Text style={styles.category}>{question.category}</Text>
            {reading && (
              <Ionicons name="volume-high" size={16} color={colors.sky} accessibilityLabel="Lektor czyta pytanie" />
            )}
          </View>
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
  announcementCard: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.solo,
  },
  announcement: {
    color: colors.outline,
    fontSize: 26,
    fontWeight: '900',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
