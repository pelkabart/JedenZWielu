# Lektor – czytanie pytań głosem (Piper)

Moduły: `scripts/narration/generate_question_audio.py`, `src/narration/`, `src/hooks/useQuestionNarration.ts`, krok „czytanie pytania” w `src/game/controller/SoloController.ts`
Testy: `src/narration/__tests__/questionAudio-test.ts`, `src/narration/__tests__/NarrationDirector-test.ts`, `src/game/__tests__/controller-test.ts` (blok „czytanie pytania”), `src/narration/__tests__/narration-integration-test.ts`

Gdy pada pytanie, lektor czyta je głosem z modelu Piper (`voiceModel/voice.onnx`, polski głos espeak `pl`, 22 050 Hz).

Nagrania powstają wcześniej, na komputerze. Skrypt `generate_question_audio.py` czyta każde pytanie z `src/data/questions.json` i zapisuje plik MP3 do `assets/audio/questions/`. Obok zapisuje `manifest.json` z tekstem i długością każdego nagrania. Aplikacja odtwarza gotowe pliki przez `expo-audio`, który jest w Expo Go, więc nie potrzeba development builda ani 63 MB modelu w telefonie.

Sterownik gry ma nowy krok `reading`. Pytanie jest już widoczne, lektor je czyta, a licznik czasu startuje dopiero po przeczytaniu.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Czytanie zjada czas na odpowiedź
**Ryzyko:** gdyby licznik startował razem z lektorem, gracz traciłby 2–6 s z 15 s na odpowiedź (w finale z 6 s okna zgłoszeń). Boty nie słuchają, więc człowiek byłby w gorszej sytuacji niż boty.
**Zabezpieczenie:** sterownik najpierw pokazuje nakładkę `reading` na czas trwania nagrania (plus krótki margines). Licznik i ruchy botów startują dopiero po niej. W czasie czytania człowiek nie może jeszcze odpowiedzieć ani się zgłosić (`humanTurn` zwraca `null`), tak jak w teleturnieju.
**Test:** `controller-test.ts › czytanie pytania › licznik startuje dopiero po przeczytaniu, z pełnym czasem`, `› w czasie czytania nie można odpowiedzieć ani się zgłosić`, `› bot zaczyna myśleć dopiero po przeczytaniu`, `narration-integration-test.ts › gracz może odpowiadać dopiero, gdy lektor skończy`.

### 2. Nagranie nie pasuje do pytania (ktoś poprawił treść w bazie)
**Ryzyko:** po zmianie treści pytania w `questions.json` lektor czytałby starą wersję, a na ekranie byłaby nowa.
**Zabezpieczenie:** `manifest.json` zapisuje dokładny tekst, z którego powstało nagranie. Skrypt generuje ponownie tylko pytania, których tekst się zmienił, i usuwa nagrania pytań, których już nie ma w bazie.
Aplikacja też porównuje tekst: nagranie ze starej treści nie jest odtwarzane (patrz punkt 3). Skrypt ma tryb `--check`, który bez modelu sprawdza, czy nagrania są aktualne.
**Test:** `questionAudio-test.ts › każde pytanie z bazy ma nagranie zrobione z aktualnej treści` (test nie przejdzie, dopóki ktoś nie uruchomi skryptu), `› w katalogu nie ma nagrań usuniętych pytań`, `› nagranie ze starej treści nie jest używane`.

### 3. Brak nagrania dla pytania
**Ryzyko:** nowe pytanie bez nagrania. Gra nie może się na tym zatrzymać ani wywrócić.
**Zabezpieczenie:** `narrationMs` zwraca 0, gdy pytanie nie ma nagrania. Wtedy sterownik pomija krok czytania i gra działa jak wcześniej. W logach pojawia się jedno ostrzeżenie na pytanie (nie przy każdym losowaniu).
**Test:** `questionAudio-test.ts › pytanie bez nagrania: 0 ms i jedno ostrzeżenie`, `› pomija wpis bez pliku albo z błędną długością`, `NarrationDirector-test.ts › pytanie bez nagrania jest pomijane po cichu`, `controller-test.ts › czytanie pytania › bez nagrania gra działa jak dotąd`.

### 4. Lektor gra dalej podczas pauzy albo po wyjściu z gry
**Ryzyko:** gracz wstrzymuje grę (okno „Przerwać grę?”) albo z niej wychodzi, a głos dalej czyta pytanie. Albo po wznowieniu czytanie zaczyna się od nowa, a licznik startuje w złym momencie.
**Zabezpieczenie:** odtwarzaniem steruje `NarrationDirector`, który wylicza z widoku sterownika, co ma grać: pytanie z nakładki `reading` i tylko wtedy, gdy gra nie jest wstrzymana. Pauza wstrzymuje dźwięk, wznowienie gra dalej od tego samego miejsca. Sterownik zapamiętuje, ile zostało z czasu czytania. Odmontowanie ekranu zatrzymuje dźwięk i zwalnia odtwarzacz (`remove()`).
**Test:** `NarrationDirector-test.ts › pauza wstrzymuje, wznowienie gra dalej (bez wczytywania od nowa)`, `› czytanie zaczęte w czasie pauzy rusza dopiero po wznowieniu`, `› dispose zatrzymuje dźwięk, zwalnia odtwarzacz i przestaje słuchać`, `controller-test.ts › czytanie pytania › pauza w czasie czytania zachowuje pozostały czas`, `narration-integration-test.ts › pauza w czasie czytania wycisza lektora…`, `› wyjście z gry w trakcie czytania ucisza i zwalnia odtwarzacz`, `› po przewinięciu gry do wyników lektor milknie`.

### 5. Gracz pomija czytanie, a głos dalej mówi
**Ryzyko:** dotknięcie ekranu pomija czytanie (jak inne pauzy). Wtedy licznik już biegnie, a lektor nadal czyta.
**Zabezpieczenie:** po zejściu nakładki `reading` dyrektor zatrzymuje dźwięk, bo dźwięk zawsze wynika z bieżącego widoku.
**Test:** `controller-test.ts › czytanie pytania › dotknięcie pomija czytanie i uruchamia licznik`, `NarrationDirector-test.ts › koniec czytania zatrzymuje dźwięk (także gdy gracz pominął czytanie)`.

### 6. To samo pytanie czytane dwa razy
**Ryzyko:** w finale pytanie pada najpierw do wszystkich (okno zgłoszeń), a potem odpowiada ten, kto się zgłosił. W etapie II przed pytaniem jest wskazanie. Lektor nie może czytać tego samego pytania po raz drugi.
**Zabezpieczenie:** sterownik zapamiętuje, które pytanie (wg kursora talii) zostało już przeczytane, tak samo jak zapowiedź „Odpowiada: …”.
**Test:** `controller-test.ts › czytanie pytania › w finale pytanie jest czytane raz, przed zgłoszeniami`, `› w całej grze żadne pytanie nie jest czytane dwa razy`, `narration-integration-test.ts › każde zadane pytanie jest czytane dokładnie raz, jego własnym nagraniem`.

### 7. Błąd odtwarzacza wywraca grę
**Ryzyko:** `expo-audio` rzuci wyjątek, np. przy uszkodzonym pliku albo gdy system zabierze dźwięk innej aplikacji. Wyjątek z dźwięku nie może przerwać ruchu w grze.
**Zabezpieczenie:** wszystkie wywołania odtwarzacza są w `try/catch` i błąd trafia do logów (`error`). Gra toczy się dalej, bo czas czytania liczy sterownik, a nie odtwarzacz.
**Test:** `NarrationDirector-test.ts › błąd odtwarzacza nie przerywa gry i trafia do logów`.

### 8. Nagrania puchną wraz z bazą pytań
**Ryzyko:** WAV z Pipera to ok. 44 KB na sekundę. Przy docelowych 2000 pytań to kilkaset MB w aplikacji.
**Zabezpieczenie:** skrypt koduje nagrania do MP3 mono 32 kb/s (ok. 4 KB na sekundę, ok. 10× mniej). Przy pełnej bazie warto przenieść nagrania na serwer (Supabase Storage). Format katalogu (id → plik, długość, tekst) na to pozwala.
**Test:** ręcznie: rozmiar `assets/audio/questions/` po wygenerowaniu (opisany w dokumentacji postępów).

### 9. Model głosu w repozytorium
**Ryzyko:** `voice.onnx` ma 63 MB. GitHub ostrzega przy plikach ponad 50 MB i odrzuca ponad 100 MB, a każda wersja modelu zostaje w historii na zawsze.
**Zabezpieczenie:** `voiceModel/*.onnx` jest w `.gitignore`. Do repozytorium trafia tylko konfiguracja `voice.onnx.json` i gotowe nagrania. Model jest potrzebny tylko do generowania nagrań, nie do uruchomienia gry.
**Test:** `git status` nie pokazuje `voice.onnx`.

### 10. Głos za szybki, za cichy albo urwany
**Ryzyko:** odtwarzacz na telefonie startuje z małym opóźnieniem. Gdyby licznik ruszał dokładnie po długości nagrania, ostatnie słowo nakładałoby się z licznikiem.
**Zabezpieczenie:** czas czytania to długość nagrania plus 400 ms marginesu (`NARRATION_TAIL_MS`). Długość jest liczona przez skrypt z liczby próbek, a nie zgadywana z długości tekstu.
**Test:** `questionAudio-test.ts › czas czytania = długość nagrania + margines`, `› długości nagrań są realne (ani cisza, ani urwane, ani dłuższe niż czas na odpowiedź)`, `narration-integration-test.ts › lektor gra tyle, ile trwa nagranie (+ margines), a potem rusza licznik` (co do milisekundy, dla każdego pytania w pełnej grze).

### 11. Aplikacja prosi o mikrofon, choć tylko odtwarza
**Ryzyko:** wtyczka `expo-audio` domyślnie dodaje na Androidzie uprawnienie `RECORD_AUDIO` i usługę odtwarzania w tle. Gra prosiłaby o mikrofon bez powodu, a Google Play wymaga uzasadnienia takich uprawnień.
**Zabezpieczenie:** w `app.json` wtyczka ma `recordAudioAndroid: false` i `enableBackgroundPlayback: false`. Gdy powstanie tryb Premium z odpowiedziami głosem, mikrofon włączymy świadomie.
**Test:** przegląd `app.json`, dokumentacja wtyczki dla SDK 57.

### 12. Aplikacja działa w Expo Go, a wywraca się po zbudowaniu
**Ryzyko:** `expo-audio` wymaga zainstalowanego bezpośrednio `expo-asset` (zależność równorzędna). W Expo Go to nie przeszkadza, bo Expo Go ma ją wbudowaną, ale w zbudowanej aplikacji mogłaby się wywrócić.
**Zabezpieczenie:** `expo-asset` zainstalowany przez `npx expo install`.
**Test:** `npx expo-doctor` (sprawdzenie zależności równorzędnych przechodzi). `npx expo export --platform android` dołącza wszystkie pliki mp3 do paczki.

### 13. Nagranie brakuje na dysku, a gra o tym nie wie
**Ryzyko:** wpis w manifeście jest, a pliku mp3 nie ma (np. ktoś nie dodał go do commita).
**Zabezpieczenie:** mapa plików `questionAudioSources.ts` jest generowana z dosłownymi `require`. Brak pliku przerywa budowanie w Metro i import w Jeście, więc nie da się tego przeoczyć.
**Test:** sprawdzone ręcznie: po usunięciu `his-001.mp3` cały `questionAudio-test.ts` kończy się błędem `Cannot find module '../../assets/audio/questions/his-001.mp3'`.
