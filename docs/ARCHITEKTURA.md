# Jeden z Wielu – architektura aplikacji

Dokument dla architekta projektu. Opisuje, z czego składa się aplikacja, jak płyną dane, jakie zasady obowiązują w kodzie i gdzie są znane luki. Stan na 03.11.2026 (commit `10ab74c`).

Powiązane dokumenty:
- `docs/Dokumentacja_postepow_prac.md` – co i kiedy zrobiono, zasady gry, problemy,
- `docs/zabezpieczenia/` – ryzyka i zabezpieczenia każdej funkcjonalności (jeden plik na funkcję),
- `CLAUDE.md`, `AGENTS.md` – wymagany sposób pracy i polecenia.

---

## 1. Kontekst systemu

Gra quizowa na Androida (orientacja pozioma) w stylu teleturnieju. Gracz gra z 4 botami. Prowadzący mówi polskim głosem syntezowanym **na telefonie**. Gracz może odpowiadać dotykiem (A–D), pisemnie albo głosem. Własne kategorie pytań powstają z plików gracza przez OpenAI albo z importu pliku `.kat`.

```mermaid
flowchart LR
    Gracz((Gracz)) -->|dotyk, klawiatura, mowa| App[Aplikacja Expo / React Native]
    App -->|synteza mowy offline| Sherpa[sherpa-onnx + model Piper<br/>w zasobach APK]
    App -->|rozpoznawanie mowy pl-PL| ASR[Usługa rozpoznawania mowy Androida]
    App -->|pliki gracza, base64| OpenAI[OpenAI Responses API]
    App -->|JSON w dokumentach aplikacji| FS[(Pamięć telefonu)]
    App -->|klucz API| SS[(SecureStore / Android Keystore)]
```

Nie ma własnego backendu. Jedyna usługa sieciowa to OpenAI, wywoływane z telefonu kluczem gracza (albo programisty z `.env.local`). Supabase + PostgreSQL to plan na multiplayer i pośrednika do OpenAI.

## 2. Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Platforma | Expo SDK 57, React Native 0.86, React 19.2, nowa architektura RN, React Compiler |
| Język | TypeScript (strict), aliasy `@/*` → `src/*`, `@/assets/*` → `assets/*` |
| Nawigacja | Expo Router (pliki w `src/app/`, typowane trasy) |
| Grafika | `react-native-svg` (tło i kształty rysowane w kodzie), Reanimated |
| Dźwięk | `expo-audio` (muzyka, odtwarzanie syntezy) |
| Synteza mowy | `react-native-sherpa-onnx` + model Piper (VITS, 22 050 Hz) – moduł natywny |
| Rozpoznawanie mowy | `expo-speech-recognition` (`pl-PL`) – moduł natywny |
| Pliki | `expo-document-picker`, `expo-file-system`, `@dr.pogodin/react-native-fs` |
| Sekrety | `expo-secure-store` |
| AI | OpenAI Responses API, Structured Outputs (`strict: true`) |
| Testy | Jest + `jest-expo`, fałszywe zegary Jesta |
| Budowanie | EAS Build (`eas.json`: development / preview / production), CNG – `android/` generowany |
| Narzędzia offline | Python (`scripts/narration/`) – tylko przygotowanie modelu głosu |

Moduły natywne (sherpa-onnx, rozpoznawanie mowy) nie działają w Expo Go. Gra działa tam dalej, ale bez głosu i bez mikrofonu. Pełna aplikacja wymaga development builda albo APK.

## 3. Warstwy i zasada zależności

Najważniejsza decyzja architektoniczna: **logika gry jest czystym TypeScriptem niezależnym od React Native**, a wszystko, co dotyka telefonu, jest za interfejsem wstrzykiwanym z zewnątrz. Dzięki temu prawie cała gra jest testowalna w Jest bez emulatora.

```mermaid
flowchart TB
    subgraph UI["Warstwa UI (React)"]
        Routes["src/app/ – ekrany (Expo Router)"]
        Comp["src/components/ – komponenty"]
        Hooks["src/hooks/ – klej React ↔ logika"]
    end
    subgraph App["Warstwa aplikacji (czysty TS, stan + czas)"]
        Ctrl["Sterowniki: SoloController, PotatoController"]
        Narr["Lektor: NarrationDirector, PotatoNarrator"]
        Voice["VoiceAnswerSession"]
        Stores["Magazyny: QuestionSetStore, ApiKeyStore, VolumeStore"]
        CatFlow["createQuestionSet, transferQuestionSet, openaiGenerator"]
    end
    subgraph Domain["Domena (czyste funkcje, bez czasu, bez I/O)"]
        Engine["engine.ts / potato/engine.ts – reduce(stan, akcja)"]
        Rules["rules.ts, types.ts"]
        Bots["bots/ – profile i decyzje"]
        Ans["answers.ts, choices.ts, questions.ts, rng.ts"]
    end
    subgraph Device["Adaptery urządzenia (moduły natywne)"]
        Sherpa["narration/sherpaVoice.ts"]
        Rec["speech/expoRecognizer.ts"]
        Files["categories/device/*"]
        Secure["settings/device/secureKeyStorage.ts"]
        Audio["audio/*"]
    end
    UI --> App
    UI --> Domain
    App --> Domain
    Hooks --> Device
    App -. interfejsy: Clock, Voice, Recognizer, TextStorage, SecretStorage, FetchLike .-> Device
```

Reguły:
1. **Domena** (`src/game/` bez `controller/`) nie zna czasu, React, logów ani urządzenia. `reduce` jest czystą funkcją: zwraca nowy stan, nie modyfikuje starego, nie loguje. Losowość przychodzi z zewnątrz (`Rng` z ziarnem albo – w silniku „Gorący Ziemniak” – gotowe decyzje w akcji).
2. **Warstwa aplikacji** dokłada czas i reżyserię. Zależności od świata przychodzą przez interfejsy: `Clock`, `Voice`, `Recognizer`, `TextStorage`, `SecretStorage`, `FetchLike`. W testach podstawiane są atrapy z folderów `testing/`.
3. **Adaptery urządzenia** są cienkie i jako jedyne importują moduły natywne. Tworzone są w hookach albo w plikach-singletonach (`questionSets.ts`, `apiKey.ts`, `volume.ts`).
4. **UI** tylko wyświetla „widok” sterownika i przekazuje mu ruchy gracza. Nie zawiera reguł gry.

## 4. Struktura katalogów

```
src/
  app/                    ekrany (każdy plik = trasa)
    _layout.tsx           Stack bez nagłówków; wczytuje głośność na starcie
    index.tsx             menu główne (Solo, MultiPlayer, Dodatki, Kategorie, zębatka)
    settings.tsx          klucz API OpenAI, suwaki głośności
    categories/index.tsx  lista kategorii, import/eksport .kat, usuwanie
    categories/new.tsx    nowa kategoria z plików przez OpenAI
    solo/categories.tsx   wybór kategorii przed grą (gdy jest więcej niż domyślna)
    solo/index.tsx        wybór poziomu trudności
    solo/game.tsx         rozgrywka
  components/             home/, solo/, potato/, categories/, settings/
  hooks/                  useSoloController, usePotatoController, useNarration,
                          useVoiceAnswer, useQuestionSets, useApiKey, useMenuMusic, useKeyboardHeight
  game/                   domena + sterowniki
    types.ts rules.ts engine.ts solo.ts answers.ts choices.ts questions.ts rng.ts simulate.ts
    bots/                 profiles.ts (8 postaci), brain.ts (decyzje)
    controller/           SoloController.ts (czas, boty, pauzy), hostLine.ts (teksty prowadzącego)
    potato/               engine.ts, solo.ts, bots.ts, texts.ts, controller/PotatoController.ts
    testing/              wspólne fikstury testów
  narration/              NarrationDirector, PotatoNarrator, sherpaVoice, pronunciation,
                          questionIntonation, modelAsset; testing/FakeVoice
  speech/                 VoiceAnswerSession, spokenAnswer, expoRecognizer; testing/FakeRecognizer
  categories/             QuestionSetStore, createQuestionSet, openaiGenerator, generatedQuestions,
                          categoryFile, transferQuestionSet, sourceFiles, errors, types; device/
  settings/               ApiKeyStore, VolumeStore, configApiKey; device/secureKeyStorage
  audio/                  menuMusic, gameMusic, musicMute, volume (czysta funkcja wzmocnienia)
  lib/log.ts              logowanie
  data/questions.json     domyślna baza pytań (wersja 2, 50 pytań)
  constants/theme.ts      kolory
plugins/withVoiceModel.js wtyczka konfiguracyjna: kopiuje model głosu do zasobów Androida
scripts/narration/        przygotowanie modelu Piper dla sherpa-onnx (Python)
voiceModel/               voice.onnx (źródło); vits-piper-pl/ generowany, w .gitignore
.githooks/pre-commit      blokada commitu kluczy API i plików .env
```

## 5. Nawigacja

```mermaid
flowchart LR
    Home["/ (menu)"] -->|Solo| Entry{{"soloEntryRoute():<br/>czy są własne kategorie?"}}
    Entry -->|tak| SoloCat["/solo/categories"]
    Entry -->|nie| Diff["/solo?set=default"]
    SoloCat --> Diff2["/solo?set=&lt;id&gt;"]
    Diff --> Game["/solo/game?difficulty&set"]
    Diff2 --> Game
    Home -->|Kategorie| Cats["/categories"] --> New["/categories/new"]
    Home -->|zębatka| Settings["/settings"]
    New -->|brak klucza| Settings
```

Parametry przechodzą przez URL (`difficulty`, `set`). Stan współdzielony między ekranami (kategorie, klucz, głośność) jest w singletonach-magazynach czytanych przez `useSyncExternalStore`, a nie w kontekście React. „MultiPlayer” i „Dodatki” nie mają jeszcze ekranów.

## 6. Domena gry

### 6.1. Dwa silniki

W kodzie są dwa niezależne zestawy zasad. Oba mają ten sam kształt: czysty `stan + akcja → nowy stan`.

| | Klasyczny („1 z 10”) | „Gorący Ziemniak” (PDF „Quiz Frenzy”) |
|---|---|---|
| Silnik | `game/engine.ts` – `createGame`, `reduce` | `game/potato/engine.ts` – `createPotatoGame`, `reducePotato` |
| Fazy | `stage1` → `stage2` → `final` → `finished` | `round1` (ziemniak, 3 życia) → `round2` (bomba z mnożnikiem, osłona) → `sprint` (60 s) → `duel` (finał) → `finished` |
| Akcje | `answer`, `buzz`, `noBuzz`, `pick` | `start`, `answer` (z polem `next`), `blindPass`, `tick` |
| Losowość | `Rng` przekazany przy tworzeniu (tasowanie, miejsce startowe) | żadnej – decyzje losowe podaje sterownik w akcji |
| Stan oczekiwania | `pending` (`answer` / `buzz` / `pick` / `none`) | `holderId` + `question` |
| Zdarzenia | lista `events` (pod animacje i lektora) | brak listy; sterownik porównuje stany |
| Sterownik | `SoloController` | `PotatoController` |
| Lektor | `NarrationDirector` + `hostLine.ts` | `PotatoNarrator` + `potato/texts.ts` |
| Ekran | `components/solo/SoloGame.tsx` | `components/potato/PotatoGame.tsx` |
| Podpięty do trasy | **nie** (patrz rozdz. 13) | **tak** – `solo/game.tsx` |

Wspólne elementy obu silników: `types.ts` (`Question`, `Difficulty`), `answers.ts`, `choices.ts`, `bots/`, `rules.ts` (`DIFFICULTY_PRESETS`), `HUMAN_ID` z `solo.ts`. Komponenty `Podium`, `QuestionCard`, `AnswerPanel`, `Host`, `TimerBar` z `components/solo/` są używane przez oba ekrany; `PotatoGame` mapuje swojego gracza na `PlayerState` (`toPodium`).

### 6.2. Parametry

Wszystkie liczby klasycznych zasad są w `game/rules.ts` (`DEFAULT_RULES`: szanse, pula finału, punkty, czasy, `maxQuestionsWithoutHuman`). Poziomy trudności (`DIFFICULTY_PRESETS`) zmieniają wiedzę i szybkość botów, ich „strategiczność”, format odpowiedzi gracza (`choice` dla Łatwy/Normalny, `text` dla Ekspert) i czas na odpowiedź. Zasady „Gorącego Ziemniaka” są w stałej `POTATO` w `potato/engine.ts`.

### 6.3. Pytania i odpowiedzi

- **Format:** `Question { id, category, question, answers[], answerType, wrongAnswers?, difficulty }`. `answers[0]` jest pokazywana graczowi. `category` to dziedzina (Historia, Sport…), **nie** kategoria z menu – ta w kodzie nazywa się `QuestionSet`.
- **Walidacja:** `parseQuestion` / `parseQuestionBank` (`questions.ts`). Ta sama funkcja sprawdza bazę domyślną przy starcie, pytania z OpenAI i pytania z importu `.kat`. To jedna brama wejściowa dla danych.
- **Sprawdzanie:** `isCorrectAnswer` (`answers.ts`) – normalizacja (małe litery, bez polskich znaków i interpunkcji) + odległość Levenshteina z limitem zależnym od długości (0/1/2 literówki, 0 dla liczb).
- **Opcje A–D:** `buildChoices` (`choices.ts`) – poprawna + pomyłki z `wrongAnswers`, liczby obok poprawnej albo odpowiedzi z innych pytań tego samego typu.
- **Odpowiedź głosowa:** `chooseSpokenAnswer` (`speech/spokenAnswer.ts`) – wybiera z kilku transkrypcji pierwszą poprawną albo najbardziej prawdopodobną, cofa liczebniki („Mieszko pierwszy” → „Mieszko I”).

### 6.4. Boty

`bots/profiles.ts` – 8 postaci z wiedzą bazową, mocnymi/słabymi dziedzinami, czasami reakcji, skłonnością do zgłaszania się i osobowością (drapieżnik, taktyk, mściciel, chaotyk). `bots/brain.ts` – czyste decyzje: szansa trafienia (`correctChance`), pomyłka tego samego typu (`wrongAnswer`), zgłoszenie, opóźnienie, wybór celu (`decideTarget`). `potato/bots.ts` – prostszy wybór celu dla „Gorącego Ziemniaka”. Boty nie są w silniku; wywołuje je sterownik.

### 6.5. Symulator

`game/simulate.ts` rozgrywa całą klasyczną grę bez czasu (boty + „przeciętny gracz” jako człowiek). Używany w testach balansu (tysiące gier z ziarnami) oraz przez `SoloController` do „Pomiń do wyników”.

## 7. Sterowniki (czas rzeczywisty)

Sterownik to obiekt z zewnętrznym magazynem stanu („widokiem”), zgodny z `useSyncExternalStore`:

```
subscribe(listener) / getView()   → React renderuje widok
start() / pause()                 → cykl życia (Potato: także unpause(), stop())
submitAnswer(text) / pick(id)     → ruchy gracza
  Solo: buzz(), skip(), fastForward() („Pomiń do wyników”), setListening(bool)
  Potato: blindPass(id) („odbicie w ciemno”)
setSpeaking(bool)                 → lektor zgłasza początek/koniec mowy
```

Widok (`SoloView`, `PotatoView`) zawiera stan silnika i stan reżyserii: `overlay` (plansza etapu, wynik, zapowiedź „Odpowiada…”, czytanie pytania), `deadline`/`timerMs`, `thinkingId` (który bot „myśli”), `choices` (A–D), `paused`, `speaking`/`listening`. Pochodne pytania UI liczą czyste funkcje (`visibleQuestion`, `narratedQuestion`, `humanTurn`).

Zasady sterownika:
- **Wstrzykiwany zegar** (`Clock`: `now`, `setTimeout`, `clearTimeout`; produkcyjnie `realClock`). Testy używają fałszywych zegarów Jesta.
- **Wszystkie zmiany stanu gry idą przez `reduce`.** Sterownik tylko decyduje, *kiedy* i *jaką* akcję wysłać (ruch bota po opóźnieniu, `answer(null)` po upływie czasu).
- **Pauza zachowuje pozostały czas** zaplanowanych kroków (`Scheduled.dueAt`, `MainStep.armedAt`).
- **Czekanie na lektora:** pauzy i czytanie pytania trwają co najmniej swój minimalny czas (`Pacing`), potem czekają na `setSpeaking(false)`, najdłużej `MAX_SPEECH_WAIT_MS` (20 s), żeby zawieszony głos nie zablokował gry.
- **Dotknięcie pomija pauzę** (`skip`), plansza etapu ma blokadę 0,7 s przed przypadkowym zamknięciem.

Hooki `useSoloController` / `usePotatoController` tworzą grę z ziarnem `Date.now()` (logowanym, żeby odtworzyć błąd), sterownik i lektora; przy odmontowaniu zatrzymują zegary i zwalniają odtwarzacz.

## 8. Lektor (synteza mowy na żywo)

```mermaid
sequenceDiagram
    participant C as Sterownik
    participant N as NarrationDirector / PotatoNarrator
    participant V as sherpaVoice (Voice)
    participant S as sherpa-onnx (natywny)
    participant A as expo-audio
    C->>N: zmiana widoku (subscribe)
    N->>N: nowa kwestia? (bez powtórzeń)
    N->>C: setSpeaking(true)
    N->>V: say([zdania])
    loop każde zdanie
        V->>S: synteza (model w pamięci)
        V->>V: riseQuestionEnding() dla "?"
        V->>A: odtwórz; w tym czasie synteza następnego
    end
    V-->>N: koniec
    N->>C: setSpeaking(false)
```

- Teksty prowadzącego: `hostLine.ts` (`hostSpeech` – lista zdań) i `potato/texts.ts`.
- `Voice` to interfejs (`say`, `pause`, `resume`, `stop`, `dispose`). Implementacja `sherpaVoice.ts`, atrapa `testing/FakeVoice.ts`.
- `pronunciation.ts` – cyfry rzymskie po imieniu → liczebniki. `questionIntonation.ts` – sztuczne podniesienie tonu na końcu pytania (przyspieszenie ostatnich 450 ms).
- Lektor milczy, gdy mikrofon słucha (`listening`). Muzyka gry cichnie, gdy lektor mówi (`setGameMusicDucked`).
- Głośność lektora pochodzi z `VolumeStore`.
- **Model głosu w buildzie:** `voiceModel/voice.onnx` → `scripts/narration/prepare_voice_model.py` → `voiceModel/vits-piper-pl/` (model + `tokens.txt` + `espeak-ng-data`) → `plugins/withVoiceModel.js` przy `npx expo prebuild` kopiuje go do zasobów Androida pod nazwą folderu ze skrótem SHA-1 zawartości (sherpa-onnx nie odświeża raz skopiowanego modelu). `modelAsset.ts` wybiera folder modelu, który naprawdę jest w APK (nazwa z konfiguracji Expo może nie pasować w development buildzie). Prebuild bez przygotowanego modelu kończy się błędem z instrukcją.

## 9. Odpowiadanie głosem

`AnswerPanel` → `useVoiceAnswer` → `VoiceAnswerSession` (czysta logika sesji: start, wyniki częściowe, koniec, błędy, komunikaty) → `Recognizer` (interfejs) → `expoRecognizer.ts` (`expo-speech-recognition`, `pl-PL`). Przycisk pojawia się tylko, gdy urządzenie ma rozpoznawanie. Zgoda na mikrofon – przy pierwszym użyciu. Cisza lub brak zgody nie kosztuje szansy. W trybie A–D mikrofon jest wyłączony.

## 10. Kategorie (własne zestawy pytań)

```mermaid
flowchart LR
    Files[Pliki gracza<br/>PDF, DOCX, TXT…] --> Src["sourceFiles.ts<br/>limity: 1–9 plików, 10/30 MB"]
    Src --> Gen["openaiGenerator.ts<br/>Responses API, input_file base64,<br/>schemat JSON strict"]
    Gen --> Val["generatedQuestions.ts →<br/>parseQuestion (ta sama brama co baza)"]
    Kat[Plik .kat] --> CF["categoryFile.ts<br/>format jeden-z-wielu/kategoria v1"] --> Val
    Val -->|≥ 20 poprawnych| Store["QuestionSetStore<br/>question-sets.json"]
    Store --> UI[Ekrany kategorii i wybór przed grą]
    Store -->|eksport| CF
```

- `createQuestionSet.ts` – przebieg „z plików” (kroki `reading` → `generating` → `saving`), z wstrzykiwanymi zależnościami. Wszystko, co da się sprawdzić offline (nazwa, limit 3 kategorii, pliki, klucz), sprawdzane jest **przed** płatnym zapytaniem.
- `transferQuestionSet.ts` – import/eksport `.kat` z wstrzykiwanym odczytem i zapisem. Import przyjmuje tylko rozszerzenie `.kat`, do 5 MB; zajęta nazwa dostaje sufiks „(2)”.
- `QuestionSetStore` – jeden plik JSON z wersją (`STORAGE_VERSION`), zestaw „Domyślna” (wbudowany, nieusuwalny) + do 3 własnych. Udostępnia `subscribe`/`getSets` dla `useQuestionSets`.
- Błędy dla gracza – `CategoryError` (`errors.ts`) z polskimi komunikatami.
- `device/` – wybór plików, zapis przez systemowy wybór folderu (`Directory.pickDirectoryAsync`).

## 11. Ustawienia, sekrety, dźwięk

- **Klucz API:** `ApiKeyStore` (walidacja `sk-…`, maskowanie `sk-…abcd`, subskrypcja) na `SecretStorage` → `expo-secure-store` (Android Keystore, wyłączony z kopii zapasowej). Pierwszeństwo ma klucz zapisany na telefonie, potem `EXPO_PUBLIC_OPENAI_API_KEY` z `.env.local` (`configApiKey.ts`). Klucz z `.env.local` trafia do APK jawnym tekstem – APK dla innych budujemy bez niego. Hak `.githooks/pre-commit` (włączany skryptem `prepare`) blokuje commit plików `.env*` i tekstów wyglądających na klucz.
- **Głośność:** `VolumeStore` (muzyka i głos 0–100, plik `volume.json`), wczytywany w `_layout.tsx` przed pierwszym ekranem.
- **Muzyka:** `audio/menuMusic.ts` – jeden odtwarzacz dla wszystkich ekranów menu z licznikiem referencji (`acquire`/`release`, `useMenuMusic`) i zwłoką 400 ms, żeby melodia nie przerywała się przy przejściach. `audio/gameMusic.ts` – muzyka rozgrywki z wyciszaniem pod lektora. `musicMute.ts` – globalny przełącznik. `volume.ts` – czysta funkcja `musicGain`.

## 12. Przekrojowe zasady

### 12.1. Logowanie
`createLogger('<moduł>')` z `src/lib/log.ts`. Poziomy `debug`/`info` dla zwykłego przebiegu, `warn`/`error` widać na ekranie w Expo Go. Logujemy tylko małe wartości (id, liczby), nigdy cały `GameState`. Bufor wpisów i wymienne „sinki” pozwalają testom sprawdzać logi. Silniki nie logują.

### 12.2. Wstrzykiwanie zależności
Każda klasa z efektami ubocznymi dostaje je w konstruktorze (zegar, głos, rozpoznawanie, magazyn, `fetch`, `now`). Produkcyjne instancje składane są w jednym miejscu: hooki gry oraz singletony `categories/questionSets.ts`, `settings/apiKey.ts`, `settings/volume.ts`.

### 12.3. Odporność
Brak modułu natywnego (Expo Go) nie przerywa gry: lektor w `try/catch` przy tworzeniu, mikrofon ukryty. Zawieszony głos – limit 20 s. Błędne dane z sieci i plików są odrzucane pojedynczo przez wspólną walidację.

### 12.4. Testy
- Testy w folderach `__tests__` obok kodu (każdy plik tam jest testem), atrapy w `testing/`.
- Rodzaje: jednostkowe (silniki, boty, odpowiedzi, magazyny), symulacje (balans na wielu ziarnach), testy sterowników na fałszywym zegarze, testy integracyjne (`*integration-test.ts` – te same moduły co aplikacja, tylko adaptery urządzenia podmienione), test wtyczki `withVoiceModel`.
- Ok. 430 przypadków `it`/`test` w kodzie (582 wykonania wg dokumentacji postępów, z parametryzacją).
- Przed zakończeniem pracy: `npm test`, `npx tsc --noEmit`, `npx expo lint`.

### 12.5. Proces dla nowej funkcji
1. `docs/zabezpieczenia/<funkcja>.md` przed kodem (ryzyko → zabezpieczenie → test).
2. Logi przez `createLogger`.
3. Testy jednostkowe i integracyjne.
4. Aktualizacja `docs/Dokumentacja_postepow_prac.md`.
5. `npm test`, `npx tsc --noEmit`, `npx expo lint`.

## 13. Znane luki i dług techniczny

Rzeczy znalezione przy przeglądzie kodu, do decyzji architekta:

1. **Dwa tryby gry, jeden podpięty.** `src/app/solo/game.tsx` renderuje tylko `PotatoGame`. Klasyczny tryb (`SoloGame`, `useSoloController`, `NarrationDirector`) jest w pełni przetestowany, ale nieosiągalny z UI. Trzeba zdecydować: usunąć, zostawić jako drugi tryb (np. w „Dodatki”) czy połączyć wspólne części.
2. **Wybrana kategoria jest ignorowana w grze.** Trasa dostaje parametr `set`, ale `usePotatoController` zawsze używa `QUESTION_BANK` (baza domyślna). Kategorie z OpenAI i z importu działają tylko w nieużywanym `SoloGame`.
3. **„Gorący Ziemniak” nie jest opisany w `Dokumentacja_postepow_prac.md`** (jest tylko `docs/zabezpieczenia/rundy-goracy-ziemniak.md`).
4. **Duplikacja silników.** Dwa modele gracza (`PlayerState` i `PotatoPlayer`), dwa sterowniki i dwa lektory z podobną logiką czasu i pauz. `PotatoController` importuje `realClock` z `SoloController` – warto wydzielić wspólny moduł (zegar, harmonogram kroków, czekanie na lektora).
5. **Klucz OpenAI na telefonie.** Gracz potrzebuje własnego klucza; klucz programisty w APK jest jawny. Docelowo pośrednik po stronie serwera (np. funkcja Supabase).
6. **Brak backendu i multiplayera.** Silniki są deterministyczne i oparte na akcjach, co dobrze pasuje do multiplayera z autorytatywnym serwerem (ten sam `reduce` po stronie serwera), ale nic z tego jeszcze nie istnieje.
7. **Rozmiar modelu głosu** (63 MB) w APK. Rozważana kwantyzacja int8; AAB dla Google Play.
8. **Brak testów komponentów** (np. React Native Testing Library) – UI sprawdzany ręcznie.
9. **Martwy skrypt:** `reset-project` w `package.json` wskazuje nieistniejący `scripts/reset-project.js`.
10. **Mała baza pytań:** 50 pytań wobec docelowych ~2000.

## 14. Kierunki rozwoju (z perspektywy architektury)

- **Multiplayer:** przenieść czysty silnik do wspólnego pakietu, serwer wykonuje `reduce`, klient wysyła akcje i odbiera widok. Sterownik klienta zostaje warstwą reżyserii (czas, lektor), ale bez decyzji o stanie.
- **Wspólne „jądro rozgrywki”:** jeden harmonogram kroków z pauzą i czekaniem na lektora, używany przez oba sterowniki.
- **Pośrednik AI:** `openaiGenerator` ma już wstrzykiwany `FetchLike` i adres – wystarczy podmienić cel na własny endpoint.
- **Baza pytań:** przy ~2000 pytań rozważyć ładowanie z serwera lub z pliku per dziedzina zamiast jednego JSON w bundlu; walidacja `parseQuestion` zostaje bramą.
