import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type Props = {
  line: string;
  size: number;
};

// Placeholder prowadzącego; grafika postaci wejdzie w etapie 6.
export function Host({ line, size }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.bubble}>
        <Text style={styles.line}>{line}</Text>
        <View style={styles.tail} />
      </View>
      <View style={[styles.head, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.headLabel, { fontSize: size * 0.22 }]}>PROW.</Text>
      </View>
      <View style={[styles.body, { width: size * 1.5, height: size * 0.8 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubble: {
    marginBottom: 14,
    padding: 10,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.white,
    alignSelf: 'stretch',
  },
  tail: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 16,
    height: 16,
    backgroundColor: colors.white,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.outline,
    transform: [{ rotate: '45deg' }],
  },
  line: {
    color: colors.outline,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  head: {
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headLabel: {
    color: colors.outline,
    fontWeight: '900',
  },
  body: {
    marginTop: -8,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.outline,
    backgroundColor: '#3A5BC7',
  },
});
