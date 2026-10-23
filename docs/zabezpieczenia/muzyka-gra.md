# Muzyka w rozgrywce

Funkcjonalność: muzyka w tle rozgrywki (`assets/audio/gra.mp3`), cichsza niż lektor. Osobny odtwarzacz od muzyki menu (`src/audio/gameMusic.ts`).

## Ryzyka

### 1. Muzyka zagłusza lektora
- **Ryzyko:** lektor mówi na pełnej głośności, więc muzyka na stałym poziomie utrudni słuchanie pytań.
- **Zabezpieczenie:** głośność 0,22 w grze, a na czas wypowiedzi lektora 0,066 (`DUCKED_VOLUME`). Stan „lektor mówi” idzie z kontrolera (`speaking` w widoku).
- **Test:** przeglądarka sprawdza głośność 0,22 i pauzę (`gamemusic-probe`). Przyciszanie wymaga lektora, a w przeglądarce go nie ma; do sprawdzenia na telefonie.

### 2. Muzyka gra, gdy gra stoi
- **Ryzyko:** po pauzie („Przerwać grę?”) muzyka dalej gra.
- **Zabezpieczenie:** `useEffect` na `view.paused` zatrzymuje i wznawia odtwarzacz; wyjście z ekranu zatrzymuje muzykę.
- **Test:** `gamemusic-probe`: po X muzyka jest wstrzymana, po „Graj dalej” wraca.

### 3. Wyciszenie nie działa w grze
- **Ryzyko:** przycisk wyciszenia działa tylko w menu.
- **Zabezpieczenie:** stan wyciszenia jest w `src/audio/musicMute.ts`; oba odtwarzacze (menu i gra) go słuchają.
- **Test:** ręcznie w przeglądarce (`mute-probe`): wyciszenie utrzymuje się w grze.
