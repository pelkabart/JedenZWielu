# Lektor – głos prowadzącego na żywo (Piper + sherpa-onnx)

Moduły: `src/narration/` (`NarrationDirector.ts`, `sherpaVoice.ts`, `pronunciation.ts`), `src/hooks/useNarration.ts`, `hostSpeech` w `src/game/controller/hostLine.ts`, krok „czytanie pytania” i czekanie na prowadzącego w `src/game/controller/SoloController.ts`, przygotowanie modelu `scripts/narration/prepare_voice_model.py`, wtyczka `plugins/withVoiceModel.js`
Testy: `src/narration/__tests__/NarrationDirector-test.ts`, `src/narration/__tests__/pronunciation-test.ts`, `src/game/__tests__/controller-test.ts` (bloki „czytanie pytania” i „głos prowadzącego”), `src/narration/__tests__/narration-integration-test.ts`

Wszystko, co mówi prowadzący (tekst w jego dymku), i każde pytanie jest czytane na żywo głosem z modelu Piper (`voiceModel/voice.onnx`, polski, 22 050 Hz). Nie ma gotowych nagrań: tekst pojawia się na ekranie i w tej samej chwili telefon zamienia go na mowę.

Model działa w telefonie przez `react-native-sherpa-onnx` (sherpa-onnx + onnxruntime). Skrypt `prepare_voice_model.py` układa model tak, jak oczekuje go sherpa-onnx: dopisuje metadane, robi `tokens.txt` i dokłada `espeak-ng-data` (zamiana tekstu na fonemy). Wtyczka `withVoiceModel` kopiuje gotowy folder do zasobów aplikacji przy `npx expo prebuild`. `sherpaVoice` syntezuje zdanie po zdaniu (następne liczy się, gdy poprzednie gra) i odtwarza je przez `expo-audio`.

Sterownik nie zna z góry długości wypowiedzi, więc czeka na sygnał końca: `NarrationDirector` woła `controller.setSpeaking(true/false)`. Krok `reading` (pytanie widoczne, licznik stoi) i pauzy po wyniku, wskazaniu, zgłoszeniu i zapowiedzi trwają, dopóki prowadzący nie skończy mówić.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Czytanie zjada czas na odpowiedź
**Ryzyko:** gdyby licznik startował razem z lektorem, gracz traciłby 2–6 s z 15 s na odpowiedź (w finale z 6 s okna zgłoszeń). Boty nie słuchają, więc człowiek byłby w gorszej sytuacji niż boty.
**Zabezpieczenie:** sterownik najpierw pokazuje nakładkę `reading` i czeka, aż prowadzący skończy mówić. Licznik i ruchy botów startują dopiero potem. W czasie czytania człowiek nie może odpowiedzieć ani się zgłosić (`humanTurn` zwraca `null`), tak jak w teleturnieju.
**Test:** `controller-test.ts › czytanie pytania › licznik startuje dopiero po przeczytaniu, z pełnym czasem`, `› w czasie czytania nie można odpowiedzieć ani się zgłosić`, `› bot zaczyna myśleć dopiero po przeczytaniu`, `narration-integration-test.ts › gdy gracz może odpowiadać, pytanie już nie jest czytane`.

### 2. Kwestia ucięta, bo gra poszła dalej
**Ryzyko:** wynik odpowiedzi widać 2,2 s, a „Niestety, Kapitan Marek odpada. Poprawna odpowiedź: Maria Skłodowska-Curie.” trwa ok. 5 s. Następna kwestia przerwałaby poprzednią w połowie.
**Zabezpieczenie:** każda pauza (wynik, brak zgłoszeń, wskazanie, zgłoszenie, zapowiedź, czytanie) trwa co najmniej swój dotychczasowy czas, a potem czeka na koniec wypowiedzi.
**Test:** `controller-test.ts › głos prowadzącego › wynik odpowiedzi trwa, dopóki prowadzący nie skończy mówić`, `› krótka kwestia nie skraca pauzy poniżej domyślnej`, `› wskazanie, zgłoszenie i zapowiedź też czekają na prowadzącego`, `narration-integration-test.ts › kwestie przy wynikach, wskazaniach i zapowiedziach nie są ucinane`.

### 3. Gra stoi, bo lektor nie zgłosił końca
**Ryzyko:** gdyby synteza albo odtwarzacz zawiesiły się i nie zgłosiły końca wypowiedzi, sterownik czekałby w nieskończoność.
**Zabezpieczenie:** sterownik czeka najwyżej 20 s (`MAX_SPEECH_WAIT_MS`), potem loguje ostrzeżenie i gra idzie dalej. Błąd syntezy albo odtwarzacza dyrektor traktuje jak koniec wypowiedzi.
**Test:** `controller-test.ts › głos prowadzącego › gdy lektor nie zgłosi końca, gra po 20 s idzie dalej`, `NarrationDirector-test.ts › błąd lektora kończy wypowiedź i trafia do logów`.

### 4. Model nie wczyta się na telefonie
**Ryzyko:** brak modelu w APK, błąd sherpa-onnx albo za mało pamięci. Gra nie może się na tym zatrzymać ani wywrócić.
**Zabezpieczenie:** gdy model się nie wczyta, aplikacja kasuje jego kopię w plikach aplikacji i próbuje jeszcze raz. Jeśli i to się nie uda, błąd jest logowany raz, a kolejne wypowiedzi kończą się od razu. Gra toczy się bez głosu i z domyślnymi pauzami. Bez dyrektora (np. w testach) krok czytania trwa 0 ms.
**Test:** `NarrationDirector-test.ts › błąd lektora kończy wypowiedź i trafia do logów`, `controller-test.ts › czytanie pytania › bez lektora gra działa jak dotąd`; ręcznie: start gry na emulatorze i `adb logcat`.

### 5. Lektor gra dalej podczas pauzy albo po wyjściu z gry
**Ryzyko:** gracz wstrzymuje grę (okno „Przerwać grę?”) albo z niej wychodzi, a głos dalej mówi. Albo po wznowieniu sterownik rusza dalej, zanim prowadzący skończy.
**Zabezpieczenie:** dyrektor gra tylko wtedy, gdy gra nie jest wstrzymana: pauza wstrzymuje głos, a wznowienie gra dalej od tego samego miejsca. Sterownik na czas pauzy wstrzymuje też czekanie na prowadzącego. Odmontowanie ekranu zatrzymuje głos i zwalnia odtwarzacz.
**Test:** `NarrationDirector-test.ts › pauza wstrzymuje, wznowienie gra dalej`, `› wypowiedź zaczęta w czasie pauzy rusza dopiero po wznowieniu`, `› dispose zatrzymuje głos i przestaje słuchać`, `controller-test.ts › czytanie pytania › pauza w czasie czytania nie przepuszcza gry dalej`, `narration-integration-test.ts › pauza w czasie czytania wycisza lektora; po wznowieniu gra dalej`, `› wyjście z gry w trakcie mówienia ucisza lektora`.

### 6. Gracz pomija pauzę, a głos dalej mówi
**Ryzyko:** dotknięcie ekranu pomija czytanie albo pauzę po wyniku. Wtedy licznik już biegnie, a lektor nadal mówi.
**Zabezpieczenie:** dotknięcie pomija też czekanie na prowadzącego. Koniec nakładki `reading` ucisza pytanie, a nowa kwestia przerywa poprzednią.
**Test:** `controller-test.ts › czytanie pytania › dotknięcie pomija czytanie i uruchamia licznik`, `NarrationDirector-test.ts › pominięcie czytania zatrzymuje pytanie`, `› nowa kwestia przerywa poprzednią`.

### 7. To samo pytanie czytane dwa razy
**Ryzyko:** w finale pytanie pada najpierw do wszystkich (okno zgłoszeń), a potem odpowiada ten, kto się zgłosił. W etapie II przed pytaniem jest wskazanie. Lektor nie może czytać tego samego pytania po raz drugi.
**Zabezpieczenie:** sterownik zapamiętuje, które pytanie (wg kursora talii) zostało już przeczytane, tak samo jak zapowiedź „Odpowiada: …”.
**Test:** `controller-test.ts › czytanie pytania › w finale pytanie jest czytane raz, przed zgłoszeniami`, `› w całej grze żadne pytanie nie jest czytane dwa razy`, `narration-integration-test.ts › każde zadane pytanie jest czytane dokładnie raz`.

### 8. Prowadzący się powtarza
**Ryzyko:** dymek prowadzącego zmienia się przy każdym kroku gry. Gdyby lektor czytał każdy krok, gracz słyszałby np. „Pytanie dla: Ola.”, pytanie i zaraz „Odpowiada: Ola.”.
**Zabezpieczenie:** lektor mówi tylko wtedy, gdy zmienia się tekst w dymku. W czasie czytania i podczas odpowiedzi bota dymek ma ten sam tekst („Ola, Twoje pytanie.”), więc nie pada drugi raz.
**Test:** `NarrationDirector-test.ts › mówi tylko wtedy, gdy zmienia się kwestia`, `› po przeczytaniu pytania prowadzący nie powtarza kwestii przy odpowiedzi bota`.

### 9. Opóźnienie syntezy
**Ryzyko:** na słabszym telefonie synteza zdania może trwać ułamek sekundy albo dłużej. Dłuższe kwestie (pytanie + zdanie prowadzącego) zaczynałyby się z wyraźną przerwą.
**Zabezpieczenie:** wypowiedź jest dzielona na zdania (`hostSpeech` + pytanie), a następne zdanie syntezuje się, gdy poprzednie gra. Silnik syntezy jest wczytywany raz, przy pierwszej grze, i zostaje w pamięci. Model wczytuje się dwoma wątkami.
**Test:** ręcznie na emulatorze: czas od pojawienia się kwestii do początku mowy w `adb logcat` (wpisy `[lektor]`).

### 10. Zła wymowa
**Ryzyko:** espeak czyta cyfry rzymskie jak litery („Mieszko I” jako „Mieszko i”), a „Przechodzimy do etapu: Etap II!” brzmi źle i na ekranie, i z głośnika.
**Zabezpieczenie:** przed syntezą `toSpeakable` zamienia cyfry rzymskie po imieniu na liczebniki („Mieszko Pierwszy”). Na ekranie zostaje oryginalny tekst. Zapowiedzi etapów są słowami („Przechodzimy do drugiego etapu!”).
**Test:** `pronunciation-test.ts`; wymowę trzeba sprawdzić uchem na telefonie.

### 11. Model w formacie, którego sherpa-onnx nie czyta
**Ryzyko:** model z Pipera nie ma metadanych, których szuka sherpa-onnx, a jego mapa fonemów ma symbole wieloznakowe (dyftongi „aɪ”, „oʊ”), na których sherpa-onnx przerywa wczytywanie `tokens.txt`.
**Zabezpieczenie:** `prepare_voice_model.py` dopisuje metadane wg skryptu konwersji sherpa-onnx i pomija symbole wieloznakowe (espeak dla polskiego ich nie wytwarza; Piper skleja je tylko z gotowych sekwencji samogłosek).
**Test:** sprawdzone na komputerze pythonowym `sherpa-onnx`: przekonwertowany model wczytuje się i mówi po polsku (dokumentacja postępów, 7.38), potem na emulatorze Androida.

### 12. Duże APK
**Ryzyko:** model ma 61 MB (58 MB po kompresji w APK), dane espeak 18 MB, a sherpa-onnx z onnxruntime to ok. 35 MB bibliotek na każdą architekturę procesora. APK na wszystkie 4 architektury ma ok. 320 MB i nie mieści się na małym emulatorze.
**Zabezpieczenie:** do testów budujemy osobne APK na architekturę (`-PreactNativeArchitectures=arm64-v8a` dla telefonów, `x86_64` dla emulatora). Do Google Play trzeba będzie wysyłać paczkę AAB, z której sklep wybiera biblioteki dla danego telefonu. Przycinanie `espeak-ng-data` okazało się groźne (punkt 16).
**Test:** ręcznie: rozmiary APK w dokumentacji postępów (7.43).

### 13. Model głosu w repozytorium
**Ryzyko:** `voice.onnx` ma 63 MB. GitHub ostrzega przy plikach ponad 50 MB i odrzuca ponad 100 MB, a każda wersja modelu zostaje w historii na zawsze. Bez modelu w repozytorium nikt poza autorem nie zbuduje aplikacji z głosem.
**Zabezpieczenie:** w repozytorium jest tylko źródłowy `voiceModel/voice.onnx` (63 MB, poniżej limitu GitHuba) z `voice.onnx.json`, zwykłym commitem, bez Git LFS (jeden plik, bez dodatkowej instalacji i limitów transferu LFS). Przygotowany folder `voiceModel/vits-piper-pl/` (kolejne 77 MB) jest w `.gitignore`, bo `prepare_voice_model.py` robi go z `voice.onnx` w kilka sekund. Model wymieniamy rzadko, bo każda wersja to 63 MB więcej w historii. Wtyczka `withVoiceModel` przerywa `expo prebuild` z instrukcją, gdy przygotowanego modelu brakuje, zamiast po cichu budować aplikację bez głosu.
**Test:** `git ls-files voiceModel`; ręcznie: prebuild bez przygotowanego modelu kończy się czytelnym błędem.

### 14. Gra nie działa w Expo Go
**Ryzyko:** sherpa-onnx to moduł natywny, którego nie ma w Expo Go. Import przy starcie wywróciłby aplikację w Expo Go.
**Zabezpieczenie:** moduł natywny jest ładowany dopiero przy tworzeniu lektora, w `try/catch`. Gdy go nie ma, gra działa bez głosu. Do testów z głosem potrzebny jest development build (`npx expo run:android`) albo APK.
**Test:** ręcznie; testy Jesta nie importują `sherpaVoice`.

### 15. Aplikacja prosi o mikrofon, choć tylko odtwarza
**Ryzyko:** wtyczka `expo-audio` domyślnie dodaje na Androidzie uprawnienie `RECORD_AUDIO` i usługę odtwarzania w tle.
**Zabezpieczenie:** w `app.json` wtyczka ma `recordAudioAndroid: false` i `enableBackgroundPlayback: false`. Mikrofon włącza dopiero funkcja odpowiadania głosem (osobny plik `odpowiedzi-glosem.md`).
**Test:** przegląd `app.json`.

### 16. Brakujący słownik espeak wywraca aplikację
**Ryzyko:** espeak przy niektórych słowach przełącza się na inny język (np. angielski przy cudzysłowach i nazwach). Gdy słownika tego języka nie ma, synteza na Androidzie kończy się twardą awarią (SIGSEGV w `libsherpa-onnx-jni.so`), której nie da się złapać w JavaScripcie.
**Zabezpieczenie:** `prepare_voice_model.py` zostawia pełne `espeak-ng-data` i sprawdza, że są w nim słowniki `pl_dict` i `en_dict`. Pierwsza wersja skryptu przycinała słowniki do polskiego i to właśnie wywróciło aplikację (dokumentacja postępów, 7.39).
**Test:** na komputerze pythonowym `sherpa-onnx`: zdania z cudzysłowami i obcymi nazwami („Witam w grze „Jeden z Wielu”!”, „Leonardo da Vinci”, „Rio de Janeiro”); na emulatorze: pełna rozgrywka bez awarii.

### 17. Po aktualizacji aplikacji zostaje stary albo niepełny model
**Ryzyko:** sherpa-onnx kopiuje model z zasobów do plików aplikacji tylko raz: jeśli folder już istnieje, nie sprawdza jego zawartości. Po aktualizacji z poprawionym modelem telefon używałby starej kopii, a kopiowanie przerwane w połowie (ok. 80 MB) zostawiłoby niepełny model na zawsze.
**Zabezpieczenie:** wtyczka nadaje folderowi nazwę ze skrótem zawartości modelu (`vits-piper-pl-976a80a8`) i przekazuje ją aplikacji przez `extra.voiceModelAsset`. Nowy model to nowa nazwa, więc kopiuje się od nowa. Aplikacja usuwa kopie starszych wersji, a gdy model się nie wczyta, kasuje kopię i próbuje jeszcze raz.
**Test:** na emulatorze: instalacja nowej wersji na starą (`adb install -r`). W logach jest „Usuwam starą wersję modelu głosu”, potem „Model głosu wczytany”, a gra mówi dalej.

### 18. Lektor czyta stany pośrednie
**Ryzyko:** sterownik w jednym kroku gry zmienia widok kilka razy, np. przy zamknięciu planszy najpierw zdejmuje nakładkę, a dopiero potem pokazuje zapowiedź. Lektor zaczynał czytać kwestię z tego chwilowego stanu i od razu ją przerywał. W telefonie to zmarnowana synteza, która blokuje kolejkę i opóźnia właściwą kwestię.
**Zabezpieczenie:** sterownik grupuje zmiany z jednego kroku (`batch`) i wysyła słuchaczom tylko stan końcowy.
**Test:** `narration-integration-test.ts › kwestie przy wynikach, wskazaniach i zapowiedziach nie są ucinane` (ten test wykrył problem, dokumentacja postępów 7.41).
