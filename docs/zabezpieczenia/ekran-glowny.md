# Ekran główny i wybór poziomu

Pliki: `src/app/index.tsx`, `src/app/solo/index.tsx`, `src/components/home/*`
Testy: ręczne w Expo Go (komponenty nie mają jeszcze testów automatycznych – brak biblioteki do renderowania w testach).

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Tło ucięte albo z pustymi pasami na różnych telefonach
**Ryzyko:** telefony mają proporcje 16:9, 19,5:9 i 20:9.
**Zabezpieczenie:** tło SVG rysowane w układzie 1600×900 i skalowane z `preserveAspectRatio="xMidYMid slice"`. Ważne elementy są bliżej środka.
**Test:** ręcznie w Expo Go i na zrzutach z przeglądarki w rozmiarze telefonu (844×390).

### 2. Ikona ustawień pod wycięciem aparatu
**Ryzyko:** w poziomie wycięcie aparatu jest z boku ekranu.
**Zabezpieczenie:** położenie z `useSafeAreaInsets()`.
**Test:** ręcznie w Expo Go.

### 3. Przyciski nie mieszczą się na niskim ekranie
**Ryzyko:** w poziomie ekran ma ok. 360–400 dp wysokości.
**Zabezpieczenie:** stała orientacja `landscape` w `app.json` i rozmiary dobrane do niskiego ekranu.
**Test:** ręcznie w Expo Go.

### 4. Pliki gry traktowane jak ekrany
**Ryzyko:** każdy plik w `src/app` jest ekranem, a typowane trasy generowały błędne typy dla plików spoza tego folderu.
**Zabezpieczenie:** kod gry trzymamy poza `src/app`. Po dodaniu nowych plików restartujemy serwer, a `npx tsc --noEmit` wyłapuje błędne trasy.
**Test:** `npx tsc --noEmit`.
