# Muzyka w menu i wyborze poziomu

Funkcjonalność: muzyka w tle na ekranie głównym i na ekranie wyboru poziomu trudności (plik `assets/audio/menu.mp3`). W rozgrywce muzyki z tego modułu nie ma, będzie tam osobny utwór.

## Ryzyka

### 1. Muzyka gra dalej po wejściu do gry
- **Ryzyko:** ekrany menu zostają w stosie nawigacji, więc ich muzyka grałaby też w rozgrywce.
- **Zabezpieczenie:** jeden współdzielony odtwarzacz (`src/audio/menuMusic.ts`); ekrany menu zgłaszają się przez `useFocusEffect`, a pauza przychodzi po 400 ms, gdy żaden ekran menu nie jest na wierzchu. Melodia płynie więc przez menu główne i wybór poziomu bez restartu.
- **Test:** ręcznie w przeglądarce (`music-probe`): jedna instancja odtwarzacza, czas odtwarzania rośnie po przejściu do wyboru poziomu.

### 2. Muzyka zagłusza lektora
- **Ryzyko:** zbyt głośny utwór utrudni słuchanie prowadzącego.
- **Zabezpieczenie:** stała `MENU_VOLUME = 0.4`, ustawiana przy odtwarzaczu.
- **Test:** ręcznie: głośność 0,4 w odtwarzaczu (sprawdzone w przeglądarce).

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
- **Test:** ręcznie w przeglądarce (`mute-probe`): wyciszenie na ekranie głównym utrzymuje się na wyborze poziomu i w grze.
