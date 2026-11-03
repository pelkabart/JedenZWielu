# Muzyka w menu i wyborze poziomu

Funkcjonalność: muzyka w tle na każdym ekranie poza rozgrywką (plik `assets/audio/menu.mp3`), włączana w głównym układzie (`useMenuMusic` w `src/app/_layout.tsx`). Głośność ustawia się suwakiem w Ustawieniach. Od 03.11.2026 nie ma przycisku wyciszania, więc punkty o nim są już nieaktualne.

## Ryzyka

### 1. Muzyka gra dalej po wejściu do gry
- **Ryzyko:** ekrany menu zostają w stosie nawigacji, więc ich muzyka grałaby też w rozgrywce.
- **Zabezpieczenie:** jeden współdzielony odtwarzacz (`src/audio/menuMusic.ts`); ekrany menu zgłaszają się przez `useFocusEffect`, a pauza przychodzi po 400 ms, gdy żaden ekran menu nie jest na wierzchu. Melodia płynie więc przez menu główne i wybór poziomu bez restartu.
- **Test:** ręcznie w przeglądarce (`music-probe`): jedna instancja odtwarzacza, czas odtwarzania rośnie po przejściu do wyboru poziomu.

### 2. Muzyka zagłusza lektora
- **Ryzyko:** zbyt głośny utwór utrudni słuchanie prowadzącego.
- **Zabezpieczenie:** stała `MENU_VOLUME = 0.3`, ustawiana przy odtwarzaczu.
- **Test:** ręcznie: głośność 0,3 w odtwarzaczu (sprawdzone w przeglądarce).

### 3. Ustawienia odtwarzacza w renderze
- **Ryzyko:** zmiana właściwości zwracanej z hooka w renderze jest błędem dla React Compiler.
- **Zabezpieczenie:** pętla i głośność ustawiane w funkcji `configureLoop` w efekcie.
- **Test:** `npx expo lint` (reguła `react-hooks/immutability`).

### 4. Brak pliku muzyki
- **Ryzyko:** zmiana nazwy lub usunięcie pliku zepsuje ekrany menu.
- **Zabezpieczenie:** plik w repozytorium pod stałą nazwą `assets/audio/menu.mp3`; zmiana nazwy wymaga zmiany w `useMenuMusic.ts`.
- **Test:** `npx tsc --noEmit` (ścieżka `require` jest sprawdzana przy bundlowaniu).

### 5. Wyciszenie nie działa po zmianie ekranu
- **Ryzyko:** stan wyciszenia zapisany tylko w ekranie znika przy przejściu do innego ekranu.
- **Zabezpieczenie:** stan jest w module muzyki (`src/audio/menuMusic.ts`) i jest wspólny dla wszystkich ekranów; przycisk czyta go przez `useSyncExternalStore`.
- **Test:** ręcznie w przeglądarce (`mute-probe`): wyciszenie utrzymuje się na wyborze poziomu i w grze. Od 03.11.2026 ekran główny nie ma już tego przycisku; muzyką zarządza się w Ustawieniach.

### 6. Nowy ekran bez muzyki
- **Ryzyko:** gdy każdy ekran sam włącza muzykę, łatwo o tym zapomnieć. Tak się stało: kategorie i skórki grały w ciszy (dokumentacja postępów, 7.58).
- **Zabezpieczenie:** muzyka jest włączona w głównym układzie i zależy od trasy (`playsMenuMusic`). Domyślnie gra, a wyjątkiem jest tylko rozgrywka.
- **Test:** `audio/__tests__/menuMusicRoutes-test.ts` czyta trasy z folderu `src/app`; `volume-integration-test.ts` › „muzyka gra na ekranach menu bez przerwy, a w rozgrywce milknie”.

### 7. Muzyka menu nakłada się na rozgrywkę
- **Ryzyko:** po wejściu do gry dwa utwory grają razem.
- **Zabezpieczenie:** trasa `/solo/game` jest wyłączona z muzyki menu; po opuszczeniu ekranu muzyka pauzuje po 400 ms.
- **Test:** jak w punkcie 6.
