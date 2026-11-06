import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { EXPRESSIONS, type Expression, type Skin } from '@/skins/catalog';

type Props = {
  skin: Skin;
  expression: Expression;
  /** Szerokość i wysokość okna, w którym widać postać. */
  width: number;
  height: number;
  /** Bok kwadratowego obrazka. Postać zajmuje ok. 40% jego szerokości, resztę okno ucina. */
  imageSize: number;
  /** Przyciemnia postać: pod obrazkiem leży jej ciemna sylwetka, więc tło nie prześwituje. */
  dimmed?: boolean;
  /** Klatka się wczytała albo nie dała się wczytać (ekran ładowania gry). */
  onFrameLoad?: (frame: Expression) => void;
};

const DIMMED_OPACITY = 0.4;

/** Klatki leżą jedna na drugiej i zmienia się tylko przezroczystość, więc mrugnięcie nie miga pustym polem. */
export function SkinFigure({ skin, expression, width, height, imageSize, dimmed = false, onFrameLoad }: Props) {
  const position = { width: imageSize, height: imageSize, left: (width - imageSize) / 2 };
  return (
    <View style={[styles.window, { width, height }]}>
      {dimmed && (
        <Image source={skin.frames.normal} contentFit="contain" tintColor={colors.outline} accessible={false} style={[styles.frame, position]} />
      )}
      {EXPRESSIONS.map((frame) => (
        <Image
          key={frame}
          source={skin.frames[frame]}
          contentFit="contain"
          accessible={false}
          onLoad={onFrameLoad && (() => onFrameLoad(frame))}
          onError={onFrameLoad && (() => onFrameLoad(frame))}
          style={[styles.frame, position, { opacity: frame !== expression ? 0 : dimmed ? DIMMED_OPACITY : 1 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    top: 0,
  },
});
