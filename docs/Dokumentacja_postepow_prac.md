# Jeden z Wielu – dokumentacja postępów prac

Projekt na przedmiot: Dynamiczna analiza oprogramowania
Dokument jest uzupełniany na bieżąco, po każdym większym etapie prac.
Raporty z dynamicznej analizy dla prowadzącego:
- `docs/Jeden_z_Wielu_Analiza_dynamiczna_etap1.docx` – ekran główny, silnik gry i boty,
- `docs/Jeden_z_Wielu_Analiza_dynamiczna_etap2.docx` – ekran rozgrywki.

Zabezpieczenia (co mogło pójść nie tak przy tworzeniu każdej funkcjonalności i jak temu zapobiegliśmy) są w folderze `docs/zabezpieczenia/`, po jednym pliku na funkcjonalność.

Zasada pracy od 18.10.2026: każda nowa funkcjonalność ma logi, testy jednostkowe i testy integracyjne. Plik w `docs/zabezpieczenia/` powstaje przed napisaniem kodu.

Spis treści:

1. Stan projektu
2. Ekran główny
3. Silnik gry w trybie jednoosobowym
4. Boty
5. Ekran rozgrywki
6. Testy i analiza dynamiczna
7. Napotkane problemy i ich rozwiązania
8. Dalsze plany

---

## 1. Stan projektu (23.10.2026)

| Element | Stan |
|---|---|
| Ekran główny (tytuł, 3 przyciski, ustawienia) | zrobione |
| Tryb poziomy aplikacji | zrobione |
| Wybór poziomu trudności przed grą | zrobione |
| Baza pytań (format JSON, 50 pytań przykładowych) | zrobione |
| Silnik gry (etap I, etap II, finał) | zrobione |
| Boty z osobowościami | zrobione |
| Ekran rozgrywki na prostych kształtach (etap 4) | zrobione |
| Teksty prowadzącego | wersja tymczasowa, do rozbudowy w etapie 5 |
| Testy jednostkowe, symulacje, testy z udawanym zegarem | zrobione |
| Logi aplikacji (`src/lib/log.ts`) | zrobione |
| Testy integracyjne (prawdziwa baza, boty, sterownik, logi) | zrobione |
| Pliki zabezpieczeń dla każdej funkcjonalności (`docs/zabezpieczenia/`) | zrobione |
| Lektor: głos prowadzącego i pytań na żywo (Piper + sherpa-onnx) | zrobione, sprawdzone na emulatorze |
| Odpowiadanie na pytania głosem (mikrofon, rozpoznawanie mowy Androida) | zrobione, do sprawdzenia na telefonie |
| Formaty odpowiedzi: ABCD na poziomach Łatwy i Normalny, pisemnie na Ekspercie | zrobione |
| Czas decyzji botów z rozkładu Gaussa (wg PDF „Quiz Frenzy”) | zrobione |
| Silnik rund „Gorący Ziemniak” (runda 1–4, czysty, bez UI) | zrobione, bez podłączenia do ekranu |
| Czas odpowiedzi wg poziomu: Łatwy 7 s, Normalny 5 s, Ekspert 10 s | zrobione |
| Ekran gry w nowych zasadach (rundy 1–4) z limitem 10 s na wybór rywala | zrobione, sprawdzone w przeglądarce |
| Razem testów automatycznych | 294 |
| Pierwsza rozgrywka na telefonie (Expo Go) | zrobione, poprawki wprowadzone |
| Grafiki postaci i pulpitów | czekamy na grafiki |

Technologie: React Native + Expo (SDK 57), TypeScript, Expo Router, react-native-svg, expo-audio, react-native-sherpa-onnx (synteza mowy na telefonie), Jest (jest-expo); Python tylko do przygotowania modelu głosu.

## 2. Ekran główny

Aplikacja uruchamia się w trybie poziomym (`"orientation": "landscape"` w `app.json`). Na ekranie jest tytuł gry, trzy przyciski (Tryb Jednoosobowy, MultiPlayer, Dodatki) i ikona ustawień w prawym górnym rogu.

Na tym etapie nie chcieliśmy używać zewnętrznych grafik, więc tło jest narysowane w kodzie jako SVG: ciemnoniebieski gradient, promienie jak w studiu telewizyjnym, gwiazdki z grubym obrysem i znaki zapytania. Przyciski mają efekt „wciskania” (przesuwają się w dół po naciśnięciu), żeby pasowały do komiksowego stylu.

Przycisk „Tryb Jednoosobowy” prowadzi do wyboru poziomu trudności: Łatwy, Normalny albo Ekspert.

## 3. Silnik gry w trybie jednoosobowym

W grze bierze udział 5 graczy: użytkownik i 4 boty. Każdy ma 3 szanse. Pytania są otwarte, czyli odpowiedź trzeba wpisać.

**Etap I.** Każdy gracz po kolei dostaje jedno pytanie. Zła odpowiedź albo brak odpowiedzi w czasie zabiera szansę.

**Etap II.** Działa jak w „1 z 10”. Pierwszy odpowiada losowo wybrany gracz. Jeśli odpowie dobrze, wskazuje kolejnego gracza (nie może wskazać siebie). Jeśli wskazany gracz się pomyli, ten sam gracz wskazuje jeszcze raz. Etap kończy się, kiedy zostaje 3 graczy. Dodatkowa reguła: jeśli 4 pytania z rzędu padły do innych graczy, bot, który wskazuje, musi wskazać gracza-człowieka (5. pytanie jest dla niego). Gdy gracz dostaje pytanie, licznik się zeruje. Reguła nie ogranicza wyboru człowieka, a limit ustawia się w `rules.ts` (`maxQuestionsWithoutHuman`, 0 wyłącza).

**Finał.** Finaliści dostają z powrotem 3 szanse i zaczynają od 0 punktów. Pula wynosi 50 pytań. Gracze zgłaszają się do pytania, a kto zgłosi się pierwszy, ten odpowiada. Dobra odpowiedź daje 10 punktów i prawo wyboru, kto odpowiada na następne pytanie (można wybrać siebie). Po złej odpowiedzi następne pytanie jest znowu na zgłoszenia. Jeśli zostanie tylko jeden gracz, gra dalej sam, aż straci szanse albo skończą się pytania. Wygrywa gracz z największą liczbą punktów.

Wszystkie liczby (szanse, liczba pytań w finale, punkty, czasy) są w jednym pliku `src/game/rules.ts`, więc można je łatwo zmieniać.

### Budowa silnika

Silnik jest napisany w czystym TypeScripcie i nie zależy od React Native. Najważniejsza jest funkcja `reduce(stan, akcja)`, która dostaje aktualny stan gry i akcję gracza, a zwraca nowy stan. Możliwe akcje:

- `answer` – gracz podaje odpowiedź (albo `null`, gdy skończył się czas),
- `buzz` – gracz zgłasza się w finale,
- `noBuzz` – nikt się nie zgłosił,
- `pick` – gracz wskazuje, kto odpowiada.

W stanie jest pole `pending`, które mówi, na co gra czeka (na odpowiedź, zgłoszenie albo wskazanie). Każde zdarzenie (pytanie, odpowiedź, utrata szansy, odpadnięcie itd.) trafia do listy `events`. Z tej listy później skorzystają animacje i teksty prowadzącego.

### Format bazy pytań

Plik `src/data/questions.json`:

```json
{
  "version": 2,
  "questions": [
    {
      "id": "his-004",
      "category": "Historia",
      "difficulty": 2,
      "answerType": "osoba",
      "question": "Kto był pierwszym koronowanym królem Polski?",
      "answers": ["Bolesław Chrobry", "Bolesław I Chrobry", "Chrobry"],
      "wrongAnswers": ["Mieszko I", "Kazimierz Wielki", "Władysław Łokietek"]
    }
  ]
}
```

- `category` – jedna z: Historia, Geografia, Nauka, Przyroda, Sport, Kultura, Rozmaitości,
- `difficulty` – trudność pytania od 1 do 3,
- `answerType` – rodzaj odpowiedzi: `data` (rok), `liczba`, `osoba`, `miejsce` (miasto, państwo, rzeka, góra…) albo `nazwa` (wszystko inne: zwierzęta, rośliny, pojęcia),
- `answers` – tablica wszystkich poprawnych odpowiedzi, pierwsza jest pokazywana graczowi; dla `data` i `liczba` pierwsza odpowiedź musi być liczbą całkowitą,
- `wrongAnswers` (opcjonalne) – wiarygodne błędne odpowiedzi, z których korzystają boty, gdy się mylą.

Przy uruchomieniu aplikacji baza jest sprawdzana (funkcja `parseQuestionBank`). Jeśli w pytaniu jest błąd, na przykład literówka w kategorii, nieznany typ odpowiedzi, powtórzone id albo „błędna” odpowiedź, która zostałaby uznana za poprawną, od razu widać, które to pytanie.

### Sprawdzanie odpowiedzi

Odpowiedź gracza i poprawne odpowiedzi są najpierw normalizowane: małe litery, bez polskich znaków, bez interpunkcji i podwójnych spacji. Potem liczymy odległość Levenshteina, żeby zaakceptować drobne literówki:

| Długość odpowiedzi | Dopuszczalne literówki |
|---|---|
| do 4 znaków | 0 |
| 5–8 znaków | 1 |
| 9 i więcej | 2 |
| odpowiedź z cyframi | 0 |

## 4. Boty

Mamy 8 postaci botów i do każdej gry losujemy 4. Każdy bot ma profil:

- wiedza bazowa (szansa na dobrą odpowiedź),
- mocne i słabe kategorie (np. Profesor Zenon zna się na historii, ale nie na sporcie),
- czas odpowiadania i czas reakcji w finale,
- jak chętnie zgłasza się w finale i czy czasem blefuje,
- pewność siebie, czyli jak często w finale bierze pytanie na siebie,
- osobowość, od której zależy, kogo wskazuje:
  - drapieżnik – gracza z najmniejszą liczbą szans,
  - taktyk – najgroźniejszego rywala,
  - mściciel – tego, kto ostatnio wskazał jego,
  - chaotyk – losowo.

Szansa bota na dobrą odpowiedź zależy od jego wiedzy, kategorii, trudności pytania i poziomu trudności gry. Na poziomie Łatwym boty wiedzą mniej, są wolniejsze i częściej grają losowo. Na poziomie Ekspert jest odwrotnie.

Kiedy bot się myli, podaje odpowiedź tego samego rodzaju co poprawna (pole `answerType`). Kolejność wyboru:

1. jeśli pytanie ma `wrongAnswers`, bot losuje jedną z nich,
2. przy datach i liczbach podaje liczbę obok poprawnej (rok przesunięty maksymalnie o 40 lat, liczbę o ok. 30%), np. 1381 zamiast 1410,
3. w pozostałych przypadkach bierze poprawną odpowiedź z innego pytania tego samego typu, najpierw z tej samej kategorii,
4. jeśli nic nie pasuje, bot nie odpowiada (jakby nie zdążył), zamiast podać coś bez sensu.

Czasem bot też po prostu nie zdąży odpowiedzieć.

**Czas decyzji bota** losujemy z rozkładu Gaussa, zależnie od formatu odpowiedzi na danym poziomie (z PDF „Quiz Frenzy”):

| Format | Średnia | Odchylenie | Zakres |
|---|---|---|---|
| ABCD (Łatwy, Normalny) | 1,5 s | 0,35 s | 1,0–2,5 s |
| pisemnie (Ekspert) | 3,5 s | 0,8 s | 2,0–5,0 s |

Mnożnik tempa poziomu (`speedFactor`) nadal działa: na Łatwym boty są wolniejsze, na Ekspercie szybsze. Osobowości botów nie zmieniają już czasu odpowiedzi (wcześniej profile miały różne zakresy), zostają w zgłoszeniach w finale i w skuteczności.

## 5. Ekran rozgrywki

**Formaty odpowiedzi.** Na poziomach Łatwy i Normalny gracz wybiera jedną z czterech opcji A–D. Opcje to poprawna odpowiedź i trzy pomyłki tego samego rodzaju, losowane z tej samej puli co pomyłki botów (`src/game/choices.ts`). Losowanie idzie z osobnego generatora zasianego id pytania, więc to samo pytanie zawsze ma te same opcje. Na poziomie Ekspert gracz wpisuje odpowiedź (albo mówi ją, jeśli działa mikrofon). W trybie ABCD mikrofon jest wyciszony, a przycisk mikrofonu ukryty.

Po wybraniu poziomu trudności zaczyna się gra. Na razie wszystko jest narysowane prostymi kształtami. Grafiki postaci i pulpitów podmienimy, kiedy będą gotowe.

Układ ekranu (w poziomie):

- u góry: przycisk przerwania gry, nazwa etapu, numer pytania w finale i poziom trudności,
- z lewej: prowadzący z dymkiem, w którym mówi, co się dzieje („Odpowiada: Ola.”, „Niestety nie. Poprawna odpowiedź: Ottawa.”),
- na środku: karta z pytaniem, kategorią i paskiem czasu,
- niżej: 5 pulpitów ułożonych w łuk; na każdym imię, 3 lampki szans, a w finale punkty; nad pulpitem pojawia się dymek z odpowiedzią gracza (zielony albo czerwony),
- na dole: przyciski zależne od sytuacji („Zgłaszam się!”, „Biorę na siebie”, „Pomiń do wyników”).

Gracz („Ty”) siedzi na losowym miejscu. Przed każdym pytaniem zadawanym z kolei (cały etap I i etap II po złej odpowiedzi) przez ok. 4 s widać zapowiedź „Odpowiada: Wiesiek” albo „Odpowiadasz Ty!”, a dopiero potem pytanie. Pytanie czyta lektor (punkt 5, „Lektor”). Licznik czasu rusza dopiero, gdy lektor skończy czytać. Kiedy przychodzi kolej gracza, scena się chowa, a pytanie i pole na odpowiedź przesuwają się na górę ekranu, bo w poziomie klawiatura zasłania około połowy ekranu. Klawiatura pojawia się dopiero po dotknięciu pola odpowiedzi. Gdy jest otwarta, panel z pytaniem i polem odpowiedzi stoi tuż nad nią, a pasek z nazwą etapu się chowa. Jeśli nad klawiaturą jest mało miejsca, panel przechodzi w tryb kompaktowy (bez nagłówka, mniejsza czcionka pytania). Wskazywanie innego gracza odbywa się przez dotknięcie jego pulpitu.

Między zdarzeniami są krótkie pauzy (wynik odpowiedzi ok. 2 s, „X wskazuje Y” ok. 2 s), żeby było widać, co się stało. Dotknięcie ekranu pomija pauzę. Plansza z zasadami etapu nie znika sama, tylko po dotknięciu, a przez pierwsze 0,7 s ignoruje dotyk, żeby nie zamknąć jej przypadkiem. Gdy gracz odpadnie, może pominąć resztę gry i od razu zobaczyć wyniki. Na końcu jest ranking z przyciskami „Zagraj ponownie” i „Menu”. Wyjście w trakcie gry (przycisk albo systemowy „wstecz”) wymaga potwierdzenia, a na czas pytania gra jest wstrzymana.

### Sterownik gry

Silnik z etapu 3 nie wie nic o czasie. Czasem zajmuje się osobna klasa `SoloController` (`src/game/controller/SoloController.ts`):

- odlicza czas na odpowiedź (12 s) i na zgłoszenie się w finale (6 s),
- wykonuje ruchy botów z opóźnieniem, żeby wyglądało, że „myślą” i piszą,
- w finale rozstrzyga, kto zgłosił się pierwszy (gracz czy któryś bot),
- robi pauzy między zdarzeniami i pozwala je pomijać,
- obsługuje pauzę (np. okno „Przerwać grę?”) z zachowaniem pozostałego czasu.

Zegar jest wstrzykiwany, dzięki czemu w testach można użyć udawanego czasu Jesta. Ekran (React) tylko wyświetla stan sterownika i przekazuje mu ruchy gracza.

### Lektor

Wszystko, co mówi prowadzący (tekst w jego dymku), i każde pytanie jest czytane na żywo polskim głosem z modelu Piper (`voiceModel/voice.onnx`, 22 050 Hz). Nie ma gotowych nagrań: tekst pojawia się na ekranie i w tej samej chwili telefon zamienia go na mowę. Model działa w telefonie przez bibliotekę `react-native-sherpa-onnx` (sherpa-onnx + onnxruntime). Pierwsza wersja lektora odtwarzała nagrania przygotowane wcześniej na komputerze, ale założenie było inne: mowa ma powstawać na żywo (7.37).

Model trzeba raz przygotować na komputerze. Skrypt `scripts/narration/prepare_voice_model.py` dopisuje do modelu metadane, których szuka sherpa-onnx, robi `tokens.txt` z mapy fonemów i pobiera dane `espeak-ng-data` (zamiana tekstu na fonemy). Wtyczka `plugins/withVoiceModel.js` kopiuje gotowy folder do zasobów aplikacji przy `npx expo prebuild`:

```bash
python -m venv scripts/narration/.venv
scripts/narration/.venv/Scripts/python -m pip install -r scripts/narration/requirements.txt
scripts/narration/.venv/Scripts/python scripts/narration/prepare_voice_model.py
```

Model ma 63 MB, więc nie trafia do repozytorium (`.gitignore`). Sherpa-onnx to moduł natywny, którego nie ma w Expo Go: w Expo Go gra działa dalej, ale bez głosu. Lektora słychać w development buildzie albo w APK.

Jak to działa w grze:

- `hostSpeech` (`hostLine.ts`) zwraca kwestię prowadzącego jako listę zdań. W dymku są połączone w jeden tekst.
- `NarrationDirector` słucha zmian w sterowniku i mówi każdą nową kwestię z dymku, a w czasie czytania także pytanie. Ta sama kwestia nie pada dwa razy z rzędu: w czasie czytania i podczas odpowiedzi bota dymek ma ten sam tekst („Ola, Twoje pytanie.”).
- `sherpaVoice` syntezuje zdania po kolei i odtwarza je przez `expo-audio`; następne zdanie liczy się, gdy poprzednie gra. Silnik syntezy wczytuje się raz (ok. 2 s na emulatorze) i zostaje w pamięci.
- Sterownik nie zna z góry długości wypowiedzi. Lektor zgłasza mu początek i koniec mowy (`setSpeaking`). Krok „czytanie pytania” (nakładka `reading`) i pauzy po wyniku, wskazaniu, zgłoszeniu i zapowiedzi trwają co najmniej swój dotychczasowy czas, a potem czekają, aż prowadzący skończy. Najdłużej czekają 20 s, na wypadek gdyby lektor się zawiesił.
- W czasie czytania pytanie już widać, przy kategorii jest ikona głośnika, a licznik i boty czekają. Gracz nie może jeszcze odpowiadać ani się zgłaszać, tak jak w teleturnieju. Dotknięcie ekranu pomija czytanie i każdą pauzę. Pauza (okno „Przerwać grę?”) wstrzymuje też głos. Każde pytanie jest czytane raz: w finale przed zgłoszeniami.
- Cyfry rzymskie po imieniu są czytane jako liczebniki („Mieszko I” → „Mieszko Pierwszy”), bo espeak czytałby je jak literę „i”. Zapowiedzi etapów są słowami („Przechodzimy do drugiego etapu!”).

### Odpowiadanie głosem

Na pytanie można odpowiedzieć na dwa sposoby: wpisać odpowiedź albo ją powiedzieć. Obok pola odpowiedzi jest przycisk z mikrofonem. Włącza on rozpoznawanie mowy Androida (`expo-speech-recognition`, język `pl-PL`). W trakcie mówienia rozpoznany tekst pojawia się w polu, a gdy gracz skończy, odpowiedź jest zatwierdzana tak samo jak wpisana. Drugie dotknięcie mikrofonu kończy mówienie od razu.

- Rozpoznawanie zwraca kilka wersji tego, co usłyszało. Gra bierze pierwszą, którą sprawdzanie uznaje za poprawną, a jeśli żadna nie pasuje, najbardziej prawdopodobną. Liczebniki po imieniu wracają do zapisu z bazy („Mieszko pierwszy” → „Mieszko I”).
- Gdy mikrofon słucha, lektor milczy, bo rozpoznawanie słyszałoby jego głos.
- Cisza albo brak zgody na mikrofon nie kosztują szansy: gracz widzi komunikat i może spróbować jeszcze raz albo wpisać.
- Przycisk pojawia się tylko wtedy, gdy telefon ma rozpoznawanie mowy (nie ma go w Expo Go ani na emulatorze bez usług Google). O zgodę na mikrofon gra pyta dopiero przy pierwszym dotknięciu przycisku.

## 5a. Rundy „Gorący Ziemniak” (silnik, gałąź `nowe_solo`)

Przebieg z dokumentu „Quiz Frenzy” w silniku `src/game/potato/engine.ts`. Silnik nie losuje i nie loguje: losowe decyzje (kto dostaje ziemniak po błędzie, cel bota) podaje wywołujący w akcji.

| Runda | Co się dzieje | Zasady przyjęte przy wdrożeniu |
|---|---|---|
| 1 (5 → 4) | 3 życia; poprawna odpowiedź przekazuje ziemniaka wybranemu rywalowi; błąd lub brak odpowiedzi to −1 życie i reset ziemniaka do wskazanego gracza; odbicie w ciemno raz na gracza, bez utraty życia; pierwsze odpadnięcie kończy rundę | odbicie wykonuje się przed pytaniem, nie po błędzie |
| 2 (4 → 3) | 3 punkty osłony; poprawna odpowiedź podnosi mnożnik ×1→×2→×3 i przekazuje bombę; błąd to wybuch: odejmuje mnożnik od osłony i resetuje go do ×1; 0 osłony odpada | po wybuchu bombę dostaje gracz wskazany przez wywołującego |
| 3 (sprint, 60 s) | wszyscy zachowują awans; +1 punkt za dobrą odpowiedź, −1 s za błąd lub brak; ziemniak rotuje | remis punktów: mniej błędów, potem miejsce przy stole |
| 4 (finał, 3 → mistrz) | nagrody sprintu: 1. miejsce 3 szanse i pierwszy atak, 2. miejsce 2 szanse, 3. miejsce 1 szansa; poprawna odpowiedź: +1 szansa (max 3) dla siebie i −1 każdemu rywalowi; „atak” = przekazanie rywalowi, „na siebie” = kolejne pytanie dla siebie; błąd −1; wygrywa ostatni zostający | po błędzie w finale następny gracz wskazany przez wywołującego |

Czas odpowiedzi gracza zależy od poziomu: Łatwy 7 s, Normalny 5 s, Ekspert 10 s (tabela z PDF). Sterownik rund (`potato/controller/PotatoController.ts`) prowadzi grę na udawanym zegarze: tury człowieka i botów, czas, wskazywanie rywala po poprawnej odpowiedzi (10 s, potem losowo), odbicie w ciemno i sprint na zegarze. Ekran rund (`components/potato/PotatoGame.tsx`) jest podpięty pod trasę `solo/game`, więc gra solo idzie nowymi zasadami. Brakuje pauzy (wyjście przerywa grę od razu, bez pytania) i lektora w nowym ekranie.

## 6. Testy i analiza dynamiczna

Testy uruchamiamy poleceniem `npm test` (Jest z presetem `jest-expo`). Same testy integracyjne: `npm run test:integration`, pokrycie kodu: `npm run test:coverage`. Testy są w folderach `__tests__` obok testowanego kodu.

| Plik | Liczba testów | Co sprawdza |
|---|---|---|
| `answers-test.ts` | 11 | normalizacja tekstu, literówki, liczby, krótkie odpowiedzi |
| `questions-test.ts` | 18 | walidacja bazy pytań i typów odpowiedzi, czy każda zapisana odpowiedź jest akceptowana |
| `engine-test.ts` | 29 | zasady etapów I, II i finału, limit pytań bez człowieka, odrzucanie niedozwolonych ruchów, ranking |
| `bots-test.ts` | 25 | decyzje botów, osobowości, wpływ poziomu trudności, pomyłki tego samego rodzaju |
| `simulate-test.ts` | 20 | pełne gry rozgrywane przez boty |
| `controller-test.ts` | 47 | sterownik gry na udawanym zegarze: plansze, zapowiedzi, czytanie pytania, czekanie na prowadzącego, liczniki, pauzy, ruchy botów, zgłaszanie się |
| `view-test.ts` | 16 | teksty prowadzącego i ich podział na zdania, wybór pytania do wyświetlenia i do czytania, losowe miejsce gracza |
| `components/solo/__tests__/answerLayout-test.ts` | 4 | położenie panelu odpowiedzi nad klawiaturą, tryb kompaktowy |
| `lib/__tests__/log-test.ts` | 15 | logi: poziomy, bufor, wyjście do konsoli, odporność na błędy, czystość silnika |
| `answer-format-test.ts` | 10 | opcje ABCD dla każdego pytania w bazie (4 różne, w tym poprawna), format odpowiedzi na poziomach, czas decyzji botów w przedziałach, średnia rozkładu Gaussa |
| `integration-test.ts` | 9 | testy integracyjne: całe gry na prawdziwej bazie i botach, zgodność logów z przebiegiem gry |
| `narration/__tests__/pronunciation-test.ts` | 3 | wymowa: cyfry rzymskie po imieniu jako liczebniki, zwykły tekst bez zmian |
| `narration/__tests__/NarrationDirector-test.ts` | 15 | sterowanie lektorem: kiedy mówi, przerywanie kwestii, pauza, wznowienie, pominięte czytanie, mikrofon, błąd syntezy, zwolnienie |
| `narration/__tests__/modelAsset-test.ts` | 4 | wybór folderu modelu, który naprawdę jest w APK (nazwa z Metro niezgodna z APK, brak modelu) |
| `plugins/__tests__/withVoiceModel-test.js` | 1 | skrót wersji modelu taki sam na Windowsie i Linuksie (EAS) |
| `narration/__tests__/narration-integration-test.ts` | 9 | testy integracyjne lektora: całe gry na prawdziwej bazie, każde pytanie czytane raz, kwestie nieucinane, pauza, wyjście |
| `speech/__tests__/spokenAnswer-test.ts` | 7 | odpowiedź głosem: zapis jak w bazie (cyfry rzymskie), wybór wersji rozpoznania, cisza |
| `speech/__tests__/VoiceAnswerSession-test.ts` | 10 | mikrofon: zgoda, słuchanie, jedna odpowiedź, cisza, błędy, pauza, zamknięcie panelu |
| `speech/__tests__/voice-answer-integration-test.ts` | 3 | testy integracyjne: cała gra z odpowiedziami głosem i lektorem, odpowiedź po czasie, pauza |
| `potato/__tests__/potato-test.ts` | 23 | rundy 1–4 gry „Gorący Ziemniak”: przekazania, odbicie w ciemno, bomba i mnożnik, sprint z czasem i nagrodami, finał, boty wybierają cel, pełna gra zaskryptowana |
| `potato/__tests__/controller-test.ts` | 11 | sterownik rund na udawanym zegarze: tury człowieka i botów, wskazywanie rywala, czas, odbicie, sprint z zegarem, pełna gra sterowana zegarem |
| `potato/__tests__/controller-test.ts` (dodatkowo 4 testy: limit 10 s, opcje ABCD, koniec sprintu) | 15 | sterownik rund: tury, wskazywanie, limit 10 s z losowym wyborem, czas, odbicie, sprint, opcje ABCD |
| **Razem** | **294** | |

Wszystkie testy przechodzą. Cały zestaw trwa ok. 5–35 sekund, z czego najwięcej zajmują symulacje.

### Testy integracyjne

Testy jednostkowe sprawdzają moduły osobno, często na uproszczonych danych: 12 pytań testowych i bot, który zawsze odpowiada po 4 s. Testy integracyjne (`src/game/__tests__/integration-test.ts`) składają aplikację tak samo jak ekran gry (`useSoloController`): prawdziwą bazę pytań, `createSoloGame` z losowym miejscem gracza, prawdziwe profile botów, sterownik, silnik, symulator i logi. Test prowadzi grę jak gracz na telefonie: zamyka plansze etapów, odpowiada, zgłasza się i wskazuje. Wszystko dzieje się na udawanym zegarze. Sprawdzamy:

- czy pełna gra kończy się poprawnie na każdym poziomie i nie zostają uruchomione liczniki,
- czy gracz, który nie odpowiada, odpada, a „Pomiń do wyników” kończy grę,
- czy to samo ziarno daje identyczny przebieg całej gry,
- czy logi zgadzają się z grą: kolejność etapów, każdy upływ czasu, zignorowane podwójne zatwierdzenie, pauza z pozostałym czasem i brak ostrzeżeń oraz błędów w całej grze.

Lektor ma osobne testy integracyjne (`src/narration/__tests__/narration-integration-test.ts`). Składają to samo co `useSoloController` i `useNarration`: prawdziwą bazę, sterownik z krokiem czytania, boty i `NarrationDirector`. Jedyna atrapa to synteza mowy, która „mówi” 60 ms na znak na udawanym zegarze i kończy wypowiedź obietnicą, jak prawdziwa. Sprawdzamy, że w całej grze (na każdym poziomie) każde zadane pytanie jest czytane dokładnie raz, gracz nigdy nie może odpowiadać, gdy pytanie jest jeszcze czytane, kwestie przy wynikach, wskazaniach i zapowiedziach nie są ucinane, a pauza, wyjście z gry i przewinięcie do wyników wyciszają lektora. W całej grze nie ma ostrzeżeń ani błędów.

### Logi

Moduł `src/lib/log.ts` zapisuje, co aplikacja robi w trakcie działania. Każdy wpis ma poziom (`debug`, `info`, `warn`, `error`), moduł, treść i małe dane. Wpisy trafiają do konsoli (w Expo Go widać je w terminalu z `npx expo start`) i do bufora ostatnich 500 wpisów w pamięci, z którego korzystają testy.

| Moduł | Co logujemy |
|---|---|
| `[gra-solo]` | start gry: ziarno generatora, poziom, gracze; dzięki ziarnu grę z telefonu da się odtworzyć |
| `[sterownik]` | start, pauza i wznowienie z pozostałym czasem, każdy ruch, etapy, odpadnięcia, koniec czasu, decyzje botów, zignorowane ruchy gracza (np. podwójne kliknięcie), błąd silnika |
| `[baza-pytan]` | liczba załadowanych pytań albo błąd walidacji |
| `[klawiatura]` | otwarcie (z wysokością) i schowanie klawiatury |
| `[ekran-gry]` | przerwanie gry przez gracza |
| `[mikrofon]` | początek słuchania, rozpoznana odpowiedź (liczba wersji, czy pusta), brak zgody, anulowanie, błędy rozpoznawania (`error`), brak modułu albo usługi rozpoznawania |
| `[lektor]` | wczytanie modelu (czas, wersja), usunięcie starej wersji modelu, każda wypowiedź (liczba zdań, pytanie, nakładka), synteza zdania (`debug`: czas syntezy i długość mowy), pauza, wznowienie, przerwanie, błędy syntezy i odtwarzacza (`error`) |
| `[symulator]` | przekroczenie limitu kroków |

Silnik gry nic nie loguje, bo jest czystą funkcją. Jego ruchy i zdarzenia loguje sterownik. W testach logi nie trafiają do konsoli, tylko do bufora. W wersji produkcyjnej pomijamy poziom `debug`.

### Testy z udawanym zegarem

Sterownika nie da się sensownie testować w prawdziwym czasie, bo jedna gra trwa kilkanaście minut. Używamy udawanego zegara Jesta (`jest.useFakeTimers()`): test sam przesuwa czas, np. o 14 999 ms, i sprawdza, że gracz jeszcze ma czas, a po kolejnej milisekundzie traci szansę. W ten sposób sprawdzamy m.in. odpowiedź w ostatniej chwili, podwójne kliknięcie „OK”, pauzę i wznowienie oraz wyścig o zgłoszenie w finale. Dwa testy rozgrywają całą grę (z graczem odpowiadającym zawsze dobrze i zawsze źle) w ułamku sekundy.

### Test całej aplikacji w przeglądarce

Aplikację zbudowaliśmy w wersji webowej (`npx expo export --platform web`) i uruchomiliśmy w przeglądarce Edge bez okna, w rozmiarze telefonu w poziomie (844×390). Edge ma opcję „czasu wirtualnego”, który przewija liczniki bez czekania, więc w ok. 1,5 sekundy rozegrała się cała gra na poziomie Ekspert, aż do ekranu wyników. Zrzuty ekranu z różnych momentów gry posłużyły do sprawdzenia układu.

### Pokrycie kodu

`npx jest --coverage` dla `src/game` i `src/lib`: instrukcje 94,8%, gałęzie 87,5%, funkcje 99,3%, linie 97,0%. Moduł logów ma 100% instrukcji. Najsłabiej pokryte są teksty prowadzącego (`hostLine.ts`, ok. 69% instrukcji), które i tak zostaną przepisane w etapie 5. Niepokryte zostały też gałęzie obsługi błędów, do których prawidłowa gra nie dochodzi (błąd bazy pytań, limit kroków symulatora, odrzucony ruch w sterowniku).

### Symulacje gier

Oprócz zwykłych testów jednostkowych napisaliśmy symulator (`src/game/simulate.ts`), który rozgrywa całą grę od początku do końca. Wszyscy gracze są sterowani przez boty, a w miejsce człowieka wstawiamy „przeciętnego gracza” o stałych parametrach. To jest właściwie dynamiczna analiza silnika: zamiast tylko czytać kod, uruchamiamy go setki razy z różnymi danymi i sprawdzamy, czy wynik jest poprawny.

W testach symulujemy 300 gier na każdy poziom trudności (razem 900) i po każdej grze sprawdzamy:

- czy gra się zakończyła i ranking zawiera wszystkich graczy,
- czy do finału weszło dokładnie 3 graczy, a zwycięzca jest jednym z nich,
- czy nikt nie ma ujemnej liczby szans ani więcej niż 3,
- czy w finale nie padło więcej niż 50 pytań,
- czy w etapie I każdy dostał dokładnie jedno pytanie,
- czy w etapie II nikt nie wskazał sam siebie,
- czy bot wskazał człowieka zawsze, gdy ten czekał już 4 pytania,
- czy przeciętny gracz wygrywa tym rzadziej, im wyższy poziom trudności.

Dodatkowo puściliśmy jednorazowo po 1000 gier na poziom, żeby sprawdzić balans. Ostatni pomiar jest po dodaniu limitu pytań bez człowieka (w nawiasie wynik sprzed tej zmiany):

| Poziom | Wygrane przeciętnego gracza | Awans do finału | Średnio pytań w grze |
|---|---|---|---|
| Łatwy | 49,9% (55,2%) | 73,1% (81,7%) | 48,9 |
| Normalny | 8,7% (13,9%) | 37,6% (60,2%) | 67,3 |
| Ekspert | 0,3% (1,0%) | 9,1% (40,9%) | 90,1 |

Limit sprawia, że gracz dostaje w etapie II więcej pytań (średnio 4–8), więc ma więcej okazji do utraty szans. Przy mocniejszych botach przeciętny gracz dużo rzadziej dochodzi do finału. Najdłuższe czekanie gracza na pytanie w etapie II spadło do 5–6 pytań. Ponad 4 zdarza się tylko w 0,05–0,4% przypadków: wtedy, gdy po złej odpowiedzi pytanie przechodzi z kolei na następne miejsce, a nie przez wskazanie bota.

Przy 5 graczach „sprawiedliwy” wynik to 20%, więc poziom Normalny jest trochę za trudny, a Ekspert bardzo trudny. Balans poprawimy, kiedy da się już zagrać na telefonie.

### Testy ręczne

Ekran główny i wybór poziomu sprawdzaliśmy ręcznie w Expo Go na telefonie z Androidem: orientację poziomą, czy przyciski mieszczą się na niskim ekranie, czy ikona ustawień nie wchodzi pod wycięcie aparatu, czy przyciski reagują na dotyk.

Po etapie 4 rozegraliśmy pierwszą pełną grę na telefonie w Expo Go. Wyszły dwie rzeczy, których testy automatyczne nie mogły wykryć, bo dotyczyły odczuć gracza, a nie poprawności: plansza etapu znikała, zanim dało się ją przeczytać, i w etapie II boty potrafiły wskazywać się nawzajem przez wiele pytań, pomijając gracza (punkty 7.26 i 7.27).

## 7. Napotkane problemy i ich rozwiązania

### Etapy 1–3: ekran główny, silnik, boty

**7.1. Losowość utrudniała testowanie**
Gra jest w dużej części losowa: kolejność pytań, decyzje botów, gracz zaczynający etap II. Przez to ten sam test mógł raz przejść, a raz nie. Rozwiązanie: napisaliśmy własny generator liczb pseudolosowych z ziarnem (algorytm mulberry32) i przekazujemy go do każdej funkcji, która losuje. Dla tego samego ziarna gra zawsze przebiega tak samo, więc test, który wykrył błąd, można powtórzyć. Jest też osobny test, który to sprawdza (`jest powtarzalna dla tego samego ziarna`).

**7.2. Polskie znaki przy porównywaniu odpowiedzi**
Chcieliśmy, żeby „Wisla” było uznane tak samo jak „Wisła”. Standardowa metoda (rozkład znaków `normalize('NFD')` i usunięcie akcentów) działa dla ą, ę, ó, ś itd., ale okazało się, że nie działa dla litery ł, bo w Unicode nie jest ona literą l z dodanym znakiem. Rozwiązanie: ł zamieniamy na l ręcznie przed normalizacją. Wykrył to test z odpowiedzią „Wisła”.

**7.3. Literówki a liczby**
Tolerancja literówek była potrzebna (np. „Otawa” zamiast „Ottawa”), ale przy liczbach dawała złe wyniki: „1411” było uznawane za „1410”. Rozwiązanie: jeśli odpowiedź zawiera cyfry, wymagamy dokładnej zgodności. Podobny problem był z krótkimi słowami („Ag” i „Au” różnią się jedną literą), dlatego odpowiedzi do 4 znaków też muszą być dokładne. Osobno trzeba było obsłużyć zapis „42,195”, bo bez tego przecinek był zamieniany na spację i odpowiedź się nie zgadzała.

**7.4. Niejasne zasady etapu II**
W trakcie pisania silnika wyszło, że nie wiadomo, co ma się dziać po złej odpowiedzi gracza, którego ktoś wskazał. Przyjęliśmy, że wskazujący wybiera jeszcze raz. Gdy pomyli się gracz pytany z kolei, pytanie przechodzi na następne miejsce przy stole. Każda z tych zasad ma swój test, więc zmiana któregoś zachowania od razu wyjdzie przy uruchomieniu testów.

**7.5. Ryzyko gry bez końca**
Etap II kończy się dopiero, gdy ktoś odpadnie, a w finale ostatni gracz gra „aż straci szanse”. Teoretycznie gra mogłaby się nie skończyć. W silniku pilnuje tego pula 50 pytań w finale. W symulatorze dodaliśmy limit 10 000 kroków: jeśli gra go przekroczy, symulacja rzuca błąd zamiast się zawiesić. W 900 symulowanych grach limit nigdy nie został przekroczony.

**7.6. Błąd w symulacji balansu**
Pierwsza wersja symulatora stosowała poziom trudności do wszystkich graczy, także do „przeciętnego gracza”, który zastępuje człowieka. Na poziomie Ekspert on też stawał się mądrzejszy, więc wyniki balansu nie miały sensu. Rozwiązanie: poziom trudności wpływa tylko na boty, a zastępca człowieka zawsze gra na tym samym poziomie.

**7.7. Bot w finale „zgłaszał się, nie wiedząc, czy zna odpowiedź”**
Na początku decyzja o zgłoszeniu i decyzja o poprawności odpowiedzi były losowane osobno. Bot mógł się zgłosić, bo „znał” odpowiedź, a potem odpowiedzieć źle. Rozwiązanie: już w momencie zgłoszenia losujemy, czy bot zna odpowiedź, i przygotowujemy jego odpowiedź. Bot zgłasza się więc głównie wtedy, gdy wie, a czasem blefuje. Test `częściej zgłasza się, gdy zna odpowiedź` sprawdza to na 3000 próbach.

**7.8. Testy statystyczne**
Niektóre właściwości botów da się sprawdzić tylko statystycznie, np. że ekspert odpowiada poprawnie częściej niż bot na łatwym poziomie. Żeby takie testy nie wychodziły raz tak, raz inaczej, używamy stałych ziaren i dużej liczby prób (2000–3000), a wynik porównujemy z oczekiwanym prawdopodobieństwem z pewną tolerancją.

**7.9. Konfiguracja Jesta**
- Jest nie rozumiał skrótów ścieżek `@/...` z `tsconfig.json`. Trzeba było dodać `moduleNameMapper` w konfiguracji Jesta w `package.json`.
- Plik z funkcjami pomocniczymi do testów leżał w folderze `__tests__` i Jest próbował go uruchomić jako test, co kończyło się błędem „Your test suite must contain at least one test”. Przenieśliśmy go do `src/game/testing/fixtures.ts`.
- Na Windowsie polecenie `npx expo install ... --dev` dodało paczki testowe do zwykłych zależności zamiast do `devDependencies`. Poprawiliśmy to ręcznie w `package.json`.

**7.10. Typy tras w Expo Router na Windowsie**
Projekt ma włączone typowane trasy (sprawdzanie adresów ekranów przy kompilacji). Po dodaniu nowych plików poza folderem `src/app` działający serwer deweloperski wygenerował błędne typy: pliki silnika gry potraktował jak ekrany (`/../game/types`), a ekran `/solo` zapisał jako `/solo/index`. Przez to `tsc` zgłaszał błąd przy przejściu do wyboru poziomu. Rozwiązanie: ponowne uruchomienie serwera, który przy starcie generuje typy od nowa. Kod gry trzymamy poza `src/app`, bo każdy plik w tym folderze jest ekranem.

**7.11. Za mała baza pytań**
Jedna gra zużywa średnio od 49 do 94 pytań, a w bazie jest ich na razie 50. Żeby gra się nie zatrzymała, talia pytań jest tasowana i po wyczerpaniu zaczyna się od początku, więc pytania się powtarzają. Docelowo baza ma mieć ok. 2000 pytań.

**7.12. Tło na różnych ekranach**
Telefony mają różne proporcje ekranu (16:9, 19,5:9, 20:9). Tło SVG rysujemy w stałym układzie 1600×900 i skalujemy z opcją `preserveAspectRatio="xMidYMid slice"`, czyli wypełnia cały ekran, a nadmiar jest przycinany. Ważne elementy umieściliśmy bliżej środka, żeby nie zostały ucięte.

### Etap 4: ekran rozgrywki

**7.13. Wyścig między odpowiedzią a końcem czasu**
Gracz może nacisnąć „OK” w tej samej chwili, w której kończy się czas, albo nacisnąć dwa razy. Sterownik przyjmuje ruch tylko wtedy, gdy gra faktycznie czeka na ruch gracza, a każdy inny ignoruje bez błędu. Testy: odpowiedź po czasie, podwójne zatwierdzenie, licznik, który nie może odpalić się po odpowiedzi.

**7.14. Pokazywanie złego pytania**
Silnik od razu po odpowiedzi losuje następne pytanie. Gdyby ekran brał pytanie z aktualnego stanu, podczas pokazywania wyniku widać byłoby już kolejne pytanie. Rozwiązanie: sterownik zapamiętuje pytanie razem z wynikiem odpowiedzi. Test w `view-test.ts`.

**7.15. Testy zależne od czasu bota**
Bot odpowiada po różnym czasie: szybciej, gdy zna odpowiedź, wolniej, gdy się myli, a czasem wcale. Testy, które zakładałyby „bot odpowie po 4 sekundach”, nie byłyby pewne. Rozwiązanie: funkcja `advanceUntil`, która przesuwa zegar małymi krokami, aż stanie się oczekiwane zdarzenie, i sprawdza, czy zmieściło się w limicie 15 s.

**7.16. Błędne założenia w testach sterownika**
Przy pierwszym uruchomieniu nie przeszły 2 z 23 nowych testów, ale błąd był w testach, nie w kodzie. Pierwszy test zakładał, że plansza „Etap II” pojawia się od razu po ostatniej odpowiedzi etapu I, a sterownik najpierw (celowo) pokazuje wynik tej odpowiedzi. Drugi zakładał, że po pytaniu bez zgłoszeń z puli ubywa 1 pytanie, a ubywają 2: to, które przepadło, i od razu wylosowane następne. Poprawiliśmy oczekiwania w testach i dopisaliśmy komentarze, dlaczego tak jest.

**7.17. Pauza i podwójne uruchomienie efektów Reacta**
W trybie deweloperskim React potrafi uruchomić efekt dwa razy (start, stop, start). Do tego okno „Przerwać grę?” musi zatrzymać licznik. Rozwiązanie: `start()` i `pause()` można wołać wielokrotnie, a pauza zapamiętuje, ile czasu zostało. Testy: wznowienie z pozostałym czasem co do milisekundy i wielokrotne start/pause.

**7.18. Klawiatura w trybie poziomym**
W poziomie klawiatura zasłania około połowy ekranu, a Android domyślnie otwiera wtedy pełnoekranowe pole edycji, które zakrywa całą grę. Rozwiązanie: na czas odpowiedzi scena się chowa, a pytanie i pole tekstowe są na górze ekranu. Do pola dodaliśmy `disableFullscreenUI`. Układ sprawdziliśmy na zrzucie ekranu w przeglądarce, na telefonie jeszcze nie.

**7.19. Usunięte API w React Native 0.86**
`StyleSheet.absoluteFillObject` nie istnieje już w tej wersji React Native. Wykrył to kompilator TypeScript (`npx tsc --noEmit`). Zamieniliśmy na `StyleSheet.absoluteFill`.

**7.20. Te same wyniki losowania w przeglądarce testowej**
Czas wirtualny w Edge zaczyna się zawsze od tej samej daty, więc gra losowana od `Date.now()` wyglądała przy każdym uruchomieniu tak samo, a gracz nigdy nie odpowiadał pierwszy. Panelu odpowiedzi nie dało się więc zobaczyć. Rozwiązanie: na chwilę zbudowaliśmy wersję, która zawsze pokazuje panel odpowiedzi, zrobiliśmy zrzut i wróciliśmy do normalnego kodu.

**7.21. Problemy widoczne dopiero na zrzutach ekranu**
Długie imiona botów („Kapitan Marek”) były ucinane na pulpicie, a prowadzący mówił „Pytanie do: Wiesiek.”, co brzmi nienaturalnie. Rozwiązanie: tekst imienia zmniejsza się, gdy się nie mieści (`adjustsFontSizeToFit`, działa na telefonie), a prowadzący mówi „Odpowiada: Wiesiek.”.

**7.22. Oglądanie gry po odpadnięciu**
Gdy gracz odpadnie w etapie II, boty grają dalej jeszcze kilkadziesiąt pytań, co jest nudne. Dodaliśmy przycisk „Pomiń do wyników”, który rozgrywa resztę gry natychmiast symulatorem z etapu 3. Test sprawdza, że gra kończy się poprawnie i nie zostają żadne uruchomione liczniki.

**7.23. Bezsensowne pomyłki botów**
Bot, który się mylił, brał odpowiedź z dowolnego innego pytania z tej samej kategorii. Na pytanie „Kto był pierwszym koronowanym królem Polski?” mógł więc odpowiedzieć „1918”. Zauważyliśmy to przy przeglądzie zachowania botów. Rozwiązanie: nowe pole `answerType` w bazie pytań (data, liczba, osoba, miejsce, nazwa) i opcjonalne `wrongAnswers` z wiarygodnymi pomyłkami. Bot myli się teraz w obrębie tego samego rodzaju odpowiedzi (szczegóły w punkcie 4). Testy sprawdzają na całej bazie, że przy osobach, miejscach i nazwach bot nigdy nie podaje liczby ani odpowiedzi innego typu, a przy datach podaje rok odległy maksymalnie o 40 lat. Walidacja bazy odrzuca nieznany typ, datę, która nie jest liczbą, i „błędną” odpowiedź, którą sprawdzanie uznałoby za poprawną.

**7.24. Jest nie sprawdza typów**
Po dodaniu `answerType` jedno pytanie w testach nie miało tego pola. Wszystkie testy przeszły, bo Jest tłumaczy TypeScript na JavaScript bez sprawdzania typów. Błąd wyłapał dopiero `npx tsc --noEmit`. Wniosek: przed zakończeniem zadania zawsze uruchamiamy i testy, i kompilator.

**7.25. Gracz nie wiedział, kto odpowiada**
W etapie I pytanie pojawiało się od razu, a jedyną wskazówką, kto odpowiada, było podświetlenie pulpitu i dymek prowadzącego. Łatwo było się pogubić, szczególnie gdy przychodziła kolej gracza. Do tego klawiatura otwierała się sama i zasłaniała pół ekranu, zanim gracz zdążył przeczytać pytanie. Rozwiązanie: przed pytaniem zadawanym z kolei sterownik pokazuje na ok. 2,5 s zapowiedź „Odpowiada: …” (pytanie jest wtedy ukryte, a licznik jeszcze nie rusza), a klawiatura otwiera się dopiero po dotknięciu pola. Ta zmiana celowo zmieniła zachowanie gry, więc 10 istniejących testów sterownika przestało przechodzić, bo zakładały, że pytanie pojawia się od razu po planszy etapu. Każdy z nich przejrzeliśmy i poprawiliśmy oczekiwania o krok zapowiedzi. Doszły 4 nowe testy: zapowiedź przed pytaniem bota, licznik gracza liczony dopiero od pokazania pytania, pauza w trakcie zapowiedzi i to, że każde pytanie w etapie I jest zapowiadane dokładnie raz, w kolejności miejsc.

**7.26. Plansza etapu znikała, zanim dało się ją przeczytać**
Pierwsza gra na telefonie pokazała, że plansza z zasadami etapu (z napisem „Dotknij, aby kontynuować”) znikała sama po 2,6 s, a zapowiedź „Odpowiada: …” trwała za krótko. Rozwiązanie: plansza znika wyłącznie po dotknięciu. Przez pierwsze 0,7 s dotyk jest ignorowany, bo gracz często szybko klika, żeby pominąć wynik odpowiedzi, i tym samym ruchem zamknąłby nieprzeczytaną planszę. Zapowiedź wydłużyliśmy do 4 s, a „X wskazuje Y” do 2 s. Wszystkie czasy są w jednym miejscu (`DEFAULT_PACING` w sterowniku). Zmiana zachowania wymagała przepisania testów, które czekały, aż plansza sama zniknie. Zamiast stałego czasu używają teraz funkcji `dismissBanner`, która „dotyka” ekranu. Doszły 3 testy: plansza nie znika sama nawet po minucie, dotyk tuż po pokazaniu jest ignorowany, a w trakcie pauzy planszy nie da się zamknąć.

**7.27. Boty wskazywały się nawzajem, pomijając gracza**
W tej samej grze dwa boty przez wiele pytań wskazywały tylko siebie nawzajem i gracz długo nic nie robił. Formalnie było to zgodne z zasadami, ale nudne. Rozwiązanie: nowa reguła silnika. Po 4 pytaniach z rzędu zadanych innym bot musi wskazać człowieka, a silnik odrzuca każde inne wskazanie (wyjątek `GameRuleError`). Regułę zrobiliśmy w silniku, a nie tylko w logice botów, żeby nie dało się jej obejść. Ciekawy efekt uboczny: po dodaniu reguły nie przeszły 4 testy finału. Okazało się, że pomocnicza funkcja testowa `driveToFinal`, która „ręcznie” prowadzi grę do finału, wykonywała ruchy niezgodne z nową regułą, a silnik słusznie je odrzucał. Funkcję poprawiliśmy tak, żeby wybierała tylko dozwolone ruchy (`pickTargets`). Przy pomiarze efektu reguły popełniliśmy też błąd w samym pomiarze: liczyliśmy czekanie gracza także po jego odpadnięciu, przez co wyszło „najdłuższe czekanie: 90 pytań”. Po poprawce wynik to 5–6 pytań. Testy: 4 nowe w silniku (limit działa, złe wskazanie jest odrzucane, człowiek ma swobodny wybór, regułę można wyłączyć) i sprawdzenie reguły w 900 symulowanych grach.

**7.28. Klawiatura zasłaniała pole odpowiedzi**
Przy kolejnej grze na telefonie okazało się, że po otwarciu klawiatury nie widać, co się wpisuje. W Expo SDK 57 aplikacja na Androidzie działa w trybie edge-to-edge, więc okno nie zmniejsza się po otwarciu klawiatury, tylko klawiatura je przykrywa. W poziomie zajmuje ona 60–70% wysokości ekranu, a panel odpowiedzi razem z paskiem etapu był wyższy niż miejsce, które zostawało nad klawiaturą. Na zrzucie ekranu w przeglądarce problemu nie było widać, bo tam nie ma klawiatury ekranowej. Rozwiązanie: aplikacja nasłuchuje zdarzeń klawiatury i zna jej wysokość (`useKeyboardHeight`). Przy otwartej klawiaturze panel ustawia się tuż nad nią, pasek etapu się chowa, a przy małej ilości miejsca panel przechodzi w tryb kompaktowy. Obliczenia układu są w osobnej czystej funkcji `answerLayout`, która ma 4 testy (bez klawiatury, z klawiaturą, mało miejsca, wycięcie ekranu). Panel jest ten sam przy otwartej i zamkniętej klawiaturze, zmienia się tylko styl, dzięki czemu pole nie traci fokusu ani wpisanego tekstu. Układ sprawdziliśmy na zrzucie z tymczasowej wersji, w której wysokość klawiatury była ustawiona na stałe na 230 dp. Ostateczne potwierdzenie wymaga testu na telefonie.

### Formaty odpowiedzi i czas botów

**7.29. Za mało pomyłek do opcji ABCD w pytaniach o datach**
W bazie jest tylko 3 pytania o datach, więc dla większości z nich nie ma skąd wziąć trzech pomyłek tego samego rodzaju. Test całej bazy pokazał to przy pierwszym uruchomieniu: zamiast 4 opcji były 3, a integracyjne testy gier, które nie pozwalają na ostrzeżenia, zgłaszały ostrzeżenie „Za mało opcji ABCD”. Rozwiązanie: dla dat i liczb opcje dopełniamy liczbami obok poprawnej, tak jak robią to boty. Tę logikę przenieśliśmy do `choices.ts`, żeby nie było dwóch kopii. Test `każde pytanie w bazie dostaje 4 różne opcje` pilnuje tego dla całej bazy.

**7.30. Testy czasu botów zakładały stare zakresy**
Po zmianie na rozkład z PDF trzy testy w `controller-test.ts` oczekiwały, że bot odpowie po co najmniej 4 s (stary zakres profilu). To była zamierzona zmiana, więc testy zmieniliśmy: korzystają z tej samej stałej `DECISION_TIME`, co kod, zamiast wpisywanych na sztywno liczb. Pozostałe testy sterownika i gier przeszły bez zmian.

**7.31. Test lektora zależał od długości pytania**
Po zmianie losowania botów w grze lektora trafiło się dłuższe pytanie i czytanie trwało dłużej niż 20 s, którego test oczekiwał. Sprawdziliśmy, że czytanie kończy się samo (test przechodzi z 120 s), i zwiększyliśmy czas oczekiwania w teście. Zmiana nie dotyczy kodu lektora.

**7.32. Błędne oczekiwania w testach rund**
Dwa z pierwszych testów rund były napisane źle: zakładały rundę 2 po odpadnięciu, które w grze przechodzi do sprintu (przy 4 graczach odpadnięcie daje 3), oraz kolejność rankingu bez uwzględnienia dat odpadnięcia. Poprawiliśmy oczekiwania do reguł z dokumentu, a jeden test usunęliśmy, bo opisywał sytuację, której w grze nie ma (runda 2 zaczyna się z 4 graczami).

### Logi i testy integracyjne

**7.29. Gra „skończona” za wcześnie w teście integracyjnym**
Pierwsza wersja testu pełnej gry czekała, aż silnik ustawi etap `finished`, i sprawdzała, że nie zostały żadne uruchomione liczniki. Test nie przeszedł na żadnym poziomie: został 1 licznik. Błąd był w teście. Kiedy silnik kończy grę, na ekranie wciąż przez ok. 2 s widać wynik ostatniej odpowiedzi, a ten licznik właśnie odlicza tę pauzę. Ekran pokazuje wyniki dopiero wtedy, gdy etap to `finished` i nie ma już nakładki (`SoloGame.tsx`). Test czeka teraz na ten sam warunek (`isResultsScreen`).

**7.30. Brak zainstalowanych zależności i niezgodny lockfile**
Przy instalacji zależności od zera `npm ci` odmówiło instalacji, bo `package-lock.json` nie zawierał dwóch opcjonalnych paczek (`@emnapi/core`, `@emnapi/runtime`). Bez zależności `npx tsc` próbowało pobrać zupełnie inną paczkę o nazwie `tsc`. Rozwiązanie: `npm install`, które uzupełniło lockfile. Zmiany w lockfile nie weszły do tego commita, bo zależą od systemu.

### Lektor

Punkty 7.31–7.35 dotyczą pierwszej wersji lektora, z nagraniami przygotowanymi wcześniej. Tę wersję zastąpiła synteza na żywo (7.37).

**7.31. Test „każde pytanie swoim nagraniem” przechodził pozornie**
Test integracyjny lektora porównywał, które nagranie zagrało, po wartości z `require('…mp3')`. Wyszło to dopiero przy innym teście, który sprawdzał czas czytania i nie przeszedł: oczekiwał 2885 ms, a dostał 2165 ms. Okazało się, że w Jeście każdy plik mp3 zamienia się na tę samą liczbę `1`, więc test „właściwego nagrania” przechodziłby nawet przy pomylonych plikach, a test czasu brał długość niewłaściwego nagrania. W aplikacji (Metro) każdy plik ma inny numer. Rozwiązanie: test integracyjny buduje katalog z prawdziwego manifestu Pipera (te same teksty i długości), ale pliki numeruje sam (1, 2, 3…), więc da się odróżnić, które nagranie zagrało. Wniosek: atrapa środowiska (tu zasoby w Jeście) może sprawić, że test sprawdza mniej, niż się wydaje. Warto upewnić się, że test potrafi nie przejść.

**7.32. Brak typów Node w kompilatorze**
Pierwsza wersja testu nagrań sprawdzała pliki na dysku przez moduły `fs` i `path`. Jest to uruchomił, ale `npx tsc --noEmit` zgłosił błąd, bo projekt nie ma `@types/node` (aplikacja działa w React Native, nie w Node). Zamiast dodawać zależność dla jednego testu, skorzystaliśmy z tego, że brak pliku i tak wywraca import mapy nagrań (Metro i Jest rozwiązują każde `require`). Sprawdziliśmy to ręcznie: po usunięciu jednego mp3 test kończy się błędem `Cannot find module`.

**7.33. Polskie znaki w konsoli Windows**
Logi skryptu generującego nagrania wyświetlały się jako „nagra�” zamiast „nagrań”, bo konsola Windows domyślnie nie używa UTF-8. Rozwiązanie: skrypt przełącza wyjście błędów (na które pisze moduł `logging`) na UTF-8.

**7.34. Piper nie jest powtarzalny**
To samo zdanie nagrane dwa razy miało 2531 ms i 2485 ms, bo Piper dodaje do głosu losowy szum (`noise_scale`), żeby brzmiał naturalniej. Dlatego długości czytania nie wyliczamy z tekstu ani nie zapisujemy na sztywno, tylko liczymy z liczby próbek w nagraniu, które naprawdę trafia do aplikacji. Skrypt nie nagrywa ponownie pytań, których tekst się nie zmienił, żeby nagrania (i ich długości) nie zmieniały się bez potrzeby.

**7.35. Brakująca zależność `expo-asset`**
Po instalacji `expo-audio` wszystkie testy przechodziły, a w Expo Go wszystko by działało. `npx expo-doctor` wykazał jednak, że `expo-audio` wymaga zainstalowanego bezpośrednio `expo-asset` i bez niego zbudowana aplikacja może się wywrócić. Doinstalowaliśmy go przez `npx expo install expo-asset`. Przy okazji wyłączyliśmy w `app.json` uprawnienie do mikrofonu i odtwarzanie w tle, które wtyczka `expo-audio` dodaje domyślnie. Paczkę Androida zbudowaliśmy próbnie (`npx expo export --platform android`) i sprawdziliśmy, że zawiera nagrania.

**7.36. APK wywracał się od razu po uruchomieniu na emulatorze**
Pierwsze testowe APK (budowane lokalnie: `npx expo prebuild --platform android`, potem `gradlew assembleRelease`) zbudowaliśmy tylko dla architektury `arm64-v8a`, żeby skrócić czas budowania. Na emulatorze x86_64 aplikacja zamykała się zaraz po starcie. Emulator przyjął instalację, bo potrafi tłumaczyć kod ARM, ale React Native szukał swoich bibliotek dla x86_64 i ich nie znalazł. Log z `adb logcat -b crash`: `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`. Błąd był w sposobie budowania, nie w kodzie gry: wywracało się, zanim ruszył JavaScript. Rozwiązanie: APK uniwersalne dla wszystkich 4 architektur (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`, domyślne ustawienie w `android/gradle.properties`). Na emulatorze sprawdziliśmy przez `adb`: ekran główny, wybór poziomu, start gry, krok czytania z ikoną głośnika, w logach `[lektor] Lektor czyta pytanie` dla kolejnych pytań, brak błędów i awarii.

**7.37. Lektor miał mówić na żywo, a nie z gotowych nagrań**
Pierwsza wersja lektora nagrywała wszystkie pytania i kwestie Piperem na komputerze (247 plików mp3), bo tak gra działała dalej w Expo Go. Założenie było jednak inne: tekst pojawia się w grze i od razu jest czytany. Model działa teraz w telefonie przez sherpa-onnx, a nagrania i skrypt nagrywający usunęliśmy. Wniosek: wybór, który zmienia sposób działania funkcji (tu: Expo Go kontra synteza na telefonie), trzeba uzgodnić przed pisaniem kodu, a nie przyjmować samemu.

**7.38. sherpa-onnx nie czytał mapy fonemów**
Pierwsza próba wczytania przygotowanego modelu (na komputerze, pythonowym `sherpa-onnx`) skończyła się błędem `Error when reading tokens at Line aɪ`. Mapa fonemów tego modelu ma 5 symboli wieloznakowych (dyftongi `aɪ`, `aʊ`, `ɔɪ`, `eɪ`, `oʊ` z domyślnej mapy Pipera), a sherpa-onnx czyta tylko jednoznakowe. Espeak dla polskiego takich sekwencji nie wytwarza, więc skrypt je pomija i zapisuje to w logu. Sprawdzenie modelu na komputerze przed budowaniem APK oszczędziło kilka cykli budowania i instalacji.

**7.39. Aplikacja wywracała się przy pierwszym zdaniu (SIGSEGV)**
Pierwsze APK z lektorem wczytywało model, a przy syntezie pierwszego zdania („Witam w grze „Jeden z Wielu”! Zaczynamy.”) padało w kodzie natywnym (`signal 11 SIGSEGV` w `libsherpa-onnx-jni.so`, `OfflineTts.generate`). Na komputerze to samo zdanie dało czytelny błąd: `Can't read dictionary file: espeak-ng-data/en_dict`. Przyczyna: żeby zmniejszyć APK, skrypt zostawiał w danych espeak tylko słownik polski, a espeak przy niektórych słowach przełącza się na angielski. Test na komputerze tego nie wykrył, bo sprawdzał zdania bez takich słów. Rozwiązanie: pełne `espeak-ng-data` (18 MB zamiast 1,1 MB) i sprawdzanie zdań z cudzysłowami i obcymi nazwami. Takiej awarii nie da się złapać w JavaScripcie, więc nie zastąpią jej testy Jesta: potrzebne było uruchomienie na emulatorze.

**7.40. Po aktualizacji aplikacja używałaby starego modelu**
Po poprawce z 7.39 zainstalowaliśmy nową wersję, ale w plikach aplikacji wciąż leżała stara, przycięta kopia modelu. Kod biblioteki pokazał, że model jest kopiowany z zasobów tylko wtedy, gdy jego folderu jeszcze nie ma. Ten sam problem dotknąłby graczy przy każdej aktualizacji modelu, a przerwane kopiowanie (ok. 80 MB) zostawiłoby niepełny model na zawsze. Rozwiązanie: wtyczka nadaje folderowi nazwę ze skrótem zawartości modelu (`vits-piper-pl-976a80a8`). Aplikacja usuwa starsze wersje, a gdy model się nie wczyta, kasuje kopię i próbuje jeszcze raz. Sprawdzone na emulatorze instalacją nowej wersji na starą.

**7.41. Lektor zaczynał czytać kwestie, które zaraz znikały**
Test integracyjny „kwestie nie są ucinane” wykazał, że po zamknięciu planszy etapu lektor zaczynał mówić „Kapitan Marek, Twoje pytanie.” i natychmiast przerywał na rzecz zapowiedzi. Sterownik w jednym kroku gry zmieniał widok kilka razy: najpierw zdejmował nakładkę, potem pokazywał nową. Lektor reagował na stan pośredni. Na telefonie oznaczałoby to zmarnowaną syntezę, która blokuje kolejkę i opóźnia właściwą kwestię. Rozwiązanie: sterownik grupuje zmiany z jednego kroku (`batch`) i powiadamia tylko o stanie końcowym.

**7.42. Obietnice a udawany zegar w testach**
W pierwszej wersji testu integracyjnego co kwestia sterownik czekał pełne 20 s na prowadzącego („Prowadzący mówi za długo”). Koniec wypowiedzi przychodzi przez obietnicę, a pętla testu przesuwała udawany zegar synchronicznie (`advanceTimersByTime`), więc obietnice nie miały kiedy się wykonać. W aplikacji wykonują się normalnie. Test używa teraz `advanceTimersByTimeAsync`, który między licznikami wykonuje też obietnice. Dopiero wtedy test oddaje zachowanie aplikacji i mógł wykryć problem z 7.41.

**7.43. Rozmiar APK i miejsce na emulatorze**
APK z lektorem na wszystkie 4 architektury procesora ma ok. 320 MB, a tylko dla `x86_64` 149 MB. Najwięcej zajmują model (58 MB po kompresji), onnxruntime (22 MB na architekturę) i dane espeak. Emulator miał 323 MB wolnego, a instalacja potrzebuje mniej więcej dwa razy tyle co APK, więc się nie zmieściła. Do testów budujemy osobne APK na architekturę (`-PreactNativeArchitectures=arm64-v8a` dla telefonów, `x86_64` dla emulatora). Do Google Play trzeba będzie wysłać paczkę AAB, z której sklep sam wybiera biblioteki dla telefonu.

### Odpowiadanie głosem

**7.44. `expo install` wybrał wersję biblioteki dla innego SDK**
`npx expo install expo-speech-recognition` zainstalował wersję 58.0.0, choć projekt jest na Expo SDK 57. Dla paczek spoza Expo `expo install` nie zna zgodności z SDK i bierze najnowszą wersję. Zauważyliśmy to, porównując wersję z tabelą zgodności w README biblioteki. Zainstalowaliśmy ręcznie gałąź `^57` (57.1.1).

**7.45. W development buildzie z EAS katalog modelu był pusty**
Development build zbudowany na EAS uruchamiał się, ale lektor milczał. Logi pokazywały, że katalog `files/models/vits-piper-pl-976a80a8` istnieje, ale nie ma w nim żadnego pliku. Przyczyna: nazwa folderu zawiera skrót zawartości modelu (7.40), liczony z względnych ścieżek plików przez `path.relative`. Na Windowsie te ścieżki mają „”, na Linuksie „/”, więc Metro na komputerze podawało aplikacji `vits-piper-pl-976a80a8`, a prebuild na serwerze EAS zapisał w APK `vits-piper-pl-91b2fede`. Kod `react-native-sherpa-onnx` (0.4.4, `SherpaOnnxAssetHelper.resolveAssetPath`) dla nieistniejącego assetu tworzy pusty katalog i nie zgłasza błędu (`AssetManager.list` zwraca pustą listę), a przy kolejnych uruchomieniach zwraca istniejący katalog bez sprawdzania zawartości. Lokalne APK tego nie pokazywało, bo prebuild i Metro liczyły skrót na tym samym systemie. Rozwiązanie: skrót ze ścieżek z „/”, aplikacja wybiera folder spośród faktycznie obecnych w APK (`listAssetModels`), a niekompletną kopię usuwa przed kopiowaniem. Wniosek: wartość liczona przy budowaniu i przekazywana aplikacji osobną drogą (tu: Metro) musi wychodzić tak samo na każdej maszynie.

## 8. Dalsze plany

- Testy na prawdziwym telefonie (szczególnie klawiatura i wycięcie aparatu w poziomie oraz lektor: wymowa, opóźnienie syntezy na słabszym telefonie).
- Lektor: mniejszy model (kwantyzacja do int8 zmniejszyłaby go ok. 4 razy, kosztem jakości głosu — do odsłuchania), paczka AAB do Google Play, włącznik lektora w ustawieniach.
- Etap 5: prowadzący i jego teksty.
- Etap 6: wstawienie grafik postaci i pulpitów, animacje.
- Etap 7: dźwięki, wibracje, zapis statystyk, rozbudowa ekranu wyników.
- Poprawa balansu poziomów Normalny i Ekspert (po limicie pytań przeciętny gracz rzadko dochodzi do finału na poziomie Ekspert).
- Rozbudowa bazy pytań.
- Testy komponentów ekranu (np. React Native Testing Library) i zapis logów z telefonu do pliku albo ekranu diagnostycznego.
