import { Stack } from "expo-router";
import { useEffect } from "react";

import { colors } from "@/constants/theme";
import { useMenuMusic } from "@/hooks/useMenuMusic";
import { volumeStore } from "@/settings/volume";

export default function RootLayout() {
  // Głośność wczytuje się przed pierwszym ekranem, żeby muzyka menu od razu grała tak, jak ustawił gracz.
  useEffect(() => {
    void volumeStore.load();
  }, []);
  useMenuMusic();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.navy },
      }}
    />
  );
}
