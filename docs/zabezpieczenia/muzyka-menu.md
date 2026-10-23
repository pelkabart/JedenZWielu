# Muzyka w menu i wyborze poziomu

Funkcjonalność: muzyka w tle na ekranie głównym i na ekranie wyboru poziomu trudności (plik `assets/audio/menu.mp3`). W rozgrywce muzyki z tego modułu nie ma, będzie tam osobny utwór.

## Ryzyka

### 1. Muzyka gra dalej po wejściu do gry
- **Ryzyko:** ekrany menu zostają w stosie nawigacji, więc ich muzyka grałaby też w rozgrywce.
- **Zabezpieczenie:** odtwarzanie jest powiązane z fokusem ekranu (`useFocusEffect`): gra, gdy ekran jest na wierzchu, i pauzuje po wejściu dalej.
- **Test:** ręcznie w przeglądarce (`muzyka-probe`): na ekranie głównym odtwarzacz gra, po wejściu w poziomy jest wstrzymany.

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
