import { StyleSheet, Text, View } from 'react-native';

import { SkinFigure } from '@/components/skins/SkinFigure';
import { colors } from '@/constants/theme';
import { useIdleFace } from '@/hooks/useIdleFace';
import { hostExpression } from '@/skins/expression';
import { skinCatalog } from '@/skins/skinAssets';

/** Popiersie prowadzącego: wysokość okna i bok obrazka względem szerokości miejsca. */
const FIGURE_HEIGHT = 0.9;
const FIGURE_IMAGE_SIZE = 2;

type Props = {
  line: string;
  /** Szerokość miejsca na prowadzącego. */
  width: number;
  smiling: boolean;
};

export function Host({ line, width, smiling }: Props) {
  const skin = skinCatalog.host;
  const idle = useIdleFace();
  const size = width * 0.42;
  return (
    <View style={styles.root}>
      <View style={styles.bubble}>
        <Text style={styles.line}>{line}</Text>
        <View style={styles.tail} />
      </View>
      {skin ? (
        <SkinFigure
          skin={skin}
          expression={hostExpression(smiling, idle)}
          width={width}
          height={width * FIGURE_HEIGHT}
          imageSize={width * FIGURE_IMAGE_SIZE}
        />
      ) : (
        <>
          <View style={[styles.head, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.headLabel, { fontSize: size * 0.22 }]}>PROW.</Text>
          </View>
          <View style={[styles.body, { width: size * 1.5, height: size * 0.8 }]} />
        </>
      )}
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
