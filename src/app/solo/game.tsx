import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { questionSetStore } from '@/categories/questionSets';
import { DEFAULT_SET_ID } from '@/categories/types';
import { PotatoGame } from '@/components/potato/PotatoGame';
import { DIFFICULTIES } from '@/game/rules';
import type { Difficulty } from '@/game/types';

export default function SoloGameScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; set?: string }>();
  const difficulty: Difficulty = DIFFICULTIES.find((d) => d === params.difficulty) ?? 'normal';
  const questions = questionSetStore.questionsForSet(params.set ?? DEFAULT_SET_ID);
  // Zmiana klucza tworzy nową grę od zera.
  const [round, setRound] = useState(0);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <PotatoGame key={round} difficulty={difficulty} questions={questions} onPlayAgain={() => setRound((r) => r + 1)} />
    </>
  );
}
