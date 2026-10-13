import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SoloGame } from '@/components/solo/SoloGame';
import { DIFFICULTIES } from '@/game/rules';
import type { Difficulty } from '@/game/types';

export default function SoloGameScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = DIFFICULTIES.find((d) => d === params.difficulty) ?? 'normal';
  // Zmiana klucza tworzy nową grę od zera.
  const [round, setRound] = useState(0);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SoloGame key={round} difficulty={difficulty} onPlayAgain={() => setRound((r) => r + 1)} />
    </>
  );
}
