# Ustawienia: głośność muzyki i lektora

Moduły: `src/settings/VolumeStore.ts` (wartości 0–100, wczytanie, zapis), wspólna instancja `src/settings/volume.ts` (plik `volume.json` w katalogu dokumentów aplikacji, adapter `src/categories/device/fileStorage.ts`), przeliczanie na głośność odtwarzaczy `src/audio/volume.ts`, odtwarzacze `src/audio/menuMusic.ts`, `src/audio/gameMusic.ts`, `src/narration/sherpaVoice.ts`, suwak `src/components/settings/VolumeSlider.tsx` (+ czysta funkcja `sliderValue.ts`), ekran `src/app/settings.tsx`, wczytanie przy starcie w `src/app/_layout.tsx`.
Testy: `src/settings/__tests__/VolumeStore-test.ts`, `src/audio/__tests__/volume-test.ts`, `src/components/settings/__tests__/sliderValue-test.ts`, `src/settings/__tests__/volume-integration-test.ts`.
Logi: `[ustawienia]` (wczytanie, zapis, błędy pliku), `[muzyka]`.

Na ekranie „Ustawienia” (zębatka w prawym górnym rogu ekranu głównego) są dwa suwaki 0–100%: **Muzyka** i **Lektor**. Domyślnie oba na 100%. 100% oznacza dotychczasowy poziom (muzyka menu 0,3, muzyka gry 0,22 i 0,066 przy lektorze, lektor 1,0), więc zmiana nie psuje proporcji między muzyką a lektorem. Ustawienia zostają po zamknięciu gry.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Zapis w złym formacie albo uszkodzony plik
**Ryzyko:** plik `volume.json` jest pusty, ucięty, zawiera tekst zamiast liczb, liczby spoza zakresu albo ułamki (np. ręcznie zmieniony, przerwany zapis). Gra wywróciłaby się przy starcie albo ustawiła głośność 250% / −10% / `NaN` (expo-audio rzuca wyjątek albo gra głośno).
**Zabezpieczenie:** `parseVolumeSettings` czyta każde pole osobno: brakujące albo nieliczbowe → 100, liczby przycinane do 0–100 i zaokrąglane. Uszkodzony JSON → wartości domyślne i ostrzeżenie w logach. Zapis idzie przez plik tymczasowy i podmianę (`fileStorage`), więc przerwany zapis nie psuje starego pliku.
**Test:** `VolumeStore-test.ts › parseVolumeSettings` (przypadki `it.each`), `› uszkodzony plik: wartości domyślne`.

### 2. Błąd odczytu lub zapisu pliku
**Ryzyko:** brak miejsca na dysku albo błąd systemu plików przy zapisie wyrzuciłby wyjątek z suwaka.
**Zabezpieczenie:** `load` i zapis łapią błędy (`warn`/`error` w logach). Głośność w pamięci zostaje zmieniona i działa do końca uruchomienia; ekran pokazuje komunikat, że ustawienie nie zostanie zapamiętane.
**Test:** `VolumeStore-test.ts › błąd odczytu`, `› błąd zapisu: głośność działa, saveFailed`.

### 3. Wczytanie z pliku nadpisuje to, co gracz właśnie ustawił
**Ryzyko:** gracz przesuwa suwak, zanim plik się wczyta – wczytana stara wartość zastępuje nową.
**Zabezpieczenie:** zmiana przed wczytaniem jest zapamiętywana; `load` nie nadpisuje pól, które gracz już zmienił. Zapis czeka na wczytanie.
**Test:** `VolumeStore-test.ts › zmiana przed wczytaniem nie zostaje nadpisana`.

### 4. Za dużo zapisów przy przesuwaniu suwaka
**Ryzyko:** przesuwanie palcem daje dziesiątki zmian na sekundę; zapis każdej obciąża telefon, a równoległe zapisy mogłyby skończyć się w złej kolejności (w pliku zostaje starsza wartość).
**Zabezpieczenie:** suwak w trakcie ruchu woła `preview` (tylko pamięć i odtwarzacze, bez zapisu), a po puszczeniu `set` (zapis). Zapisy idą po kolei; gdy zapis trwa, kolejny zapisuje tylko najnowszy stan (zapisy się łączą).
**Test:** `VolumeStore-test.ts › preview nie zapisuje`, `› zapisy się łączą, w pliku najnowsza wartość`.

### 5. Ustawienie działa tylko w części aplikacji
**Ryzyko:** suwak zmienia muzykę menu, ale nie muzykę gry albo lektora; albo działa dopiero po ponownym wejściu na ekran.
**Zabezpieczenie:** jedna wspólna instancja `volumeStore`; muzyka menu, muzyka gry i każdy lektor (gra solo i „gorący ziemniak”) subskrybują zmiany i od razu ustawiają `player.volume`. Głośność liczy jedna funkcja (`musicGain`, `voiceGain`). Wyciszenie przyciskiem dalej ma pierwszeństwo.
**Test:** `volume-test.ts`, `volume-integration-test.ts › zmiana głośności od razu zmienia muzykę menu, gry i lektora`.

### 6. Lektor na 0% psuje przebieg gry
**Ryzyko:** gdyby przy 0% lektor nie grał w ogóle, kontroler czekałby na koniec wypowiedzi, który nigdy nie nadejdzie.
**Zabezpieczenie:** głośność zmienia tylko `player.volume`; klip gra dalej (cicho) i kończy się normalnie, więc czas gry jest taki sam.
**Test:** `volume-test.ts › bindVoiceVolume` (0% = głośność 0, odtwarzacz nie jest zatrzymywany); ręcznie na telefonie.

### 7. Muzyka gra chwilę na 100% przy starcie
**Ryzyko:** muzyka menu startuje, zanim plik ustawień się wczyta.
**Zabezpieczenie:** wczytanie startuje w głównym `_layout` przed pierwszym ekranem; odtwarzacze subskrybują zmiany, więc po wczytaniu (kilka ms) głośność od razu się poprawia.
**Test:** `volume-integration-test.ts › po ponownym uruchomieniu głośność z pliku`.

### 8. Gracz nie słyszy, jak zmienia głośność
**Ryzyko:** po wejściu w ustawienia muzyka menu pauzowała (ekran nie był „ekranem menu”), więc suwak „Muzyka” nic nie zmieniał w słyszalny sposób.
**Zabezpieczenie:** ekran ustawień używa `useMenuMusic()`, więc melodia gra dalej i zmiana jest słyszalna od razu w trakcie przesuwania (`preview`).
**Test:** ręcznie na telefonie.
