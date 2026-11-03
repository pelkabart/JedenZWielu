import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/home/BackButton';
import { CartoonBackground } from '@/components/home/CartoonBackground';
import { SkinFigure } from '@/components/skins/SkinFigure';
import { colors } from '@/constants/theme';
import { useIdleFace } from '@/hooks/useIdleFace';
import { useSelectedSkin } from '@/hooks/useSelectedSkin';
import type { Skin } from '@/skins/catalog';
import { skinSelectionStore } from '@/skins/selection';
import { skinCatalog } from '@/skins/skinAssets';

const TILE_SIZE = 96;
const SMILE_AFTER_PICK_MS = 1500;

function SkinTile({ skin, selected, onPress }: { skin: Skin; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Postać ${skin.id.split('/')[1]}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tile, selected && styles.tileSelected]}
    >
      <SkinFigure skin={skin} expression="normal" width={TILE_SIZE} height={TILE_SIZE} imageSize={TILE_SIZE * 1.9} />
      {selected && (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={16} color={colors.outline} />
        </View>
      )}
    </Pressable>
  );
}

export default function SkinsScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const selected = useSelectedSkin();
  const idle = useIdleFace(true, 0.25);
  // Licznik, a nie znacznik: każdy kolejny wybór uruchamia odliczanie od nowa.
  const [picks, setPicks] = useState(0);

  // Po wyborze postać chwilę się uśmiecha.
  useEffect(() => {
    if (picks === 0) return;
    const timer = setTimeout(() => setPicks(0), SMILE_AFTER_PICK_MS);
    return () => clearTimeout(timer);
  }, [picks]);

  const pick = (skin: Skin) => {
    setPicks((count) => count + 1);
    void skinSelectionStore.select(skin.id);
  };

  const previewHeight = Math.min(height - insets.top - insets.bottom - 32, 420);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CartoonBackground />
      <BackButton />

      <View style={[styles.content, { paddingLeft: insets.left + 84, paddingRight: insets.right + 24 }]}>
        {selected && (
          <SkinFigure
            skin={selected}
            expression={picks !== 0 ? 'smile' : idle}
            width={previewHeight * 0.48}
            height={previewHeight}
            imageSize={previewHeight}
          />
        )}

        <View style={styles.panel}>
          <Text style={styles.title}>Wybierz postać</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
            {skinCatalog.player.map((skin) => (
              <SkinTile key={skin.id} skin={skin} selected={skin.id === selected?.id} onPress={() => pick(skin)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  panel: {
    flexShrink: 1,
    gap: 14,
  },
  title: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: colors.outline,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  tiles: {
    gap: 12,
    paddingVertical: 4,
  },
  tile: {
    borderRadius: 16,
    borderWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.navyLight,
    overflow: 'hidden',
  },
  tileSelected: {
    borderColor: colors.starYellow,
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.starYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
