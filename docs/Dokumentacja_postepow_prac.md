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

## 1. Stan projektu (05.11.2026)

| Element | Stan |
|---|---|
| Ekran główny (tytuł, 4 przyciski, ustawienia) | zrobione |
| Tryb poziomy aplikacji | zrobione |
| Wybór poziomu trudności przed grą | zrobione |
| Baza pytań (format JSON, 50 pytań przykładowych) | zrobione |
| Silnik gry „Gorący Ziemniak” (rundy 1–2, sprint, finał) – jedyny tryb gry | zrobione |
| Klasyczny silnik „1 z 10”, jego sterownik, lektor i symulator | usunięte 03.11.2026 |
| Boty (wiedza, dziedziny, wybór celu) | zrobione |
| Limit pytań bez gracza (najwyżej 2 z rzędu dla botów) | zrobione |
| Plansza rundy czeka na gracza, przycisk pomija lektora; sprint liczy czas dopiero po jej zamknięciu | zrobione, testy automatyczne; do sprawdzenia na telefonie |
| Finał: 5 s na decyzję z licznikiem, potem odpowiada losowy rywal | zrobione, testy automatyczne; do sprawdzenia na telefonie |
| Pauza z przycisku i przy przejściu aplikacji w tło, ekran pauzy zasłania pytanie | zrobione, testy automatyczne; do sprawdzenia na telefonie |
| Mnożnik w rundzie 2 na środku ekranu, z animacją; bez panelu z zasadami w rogu | zrobione; animację trzeba obejrzeć na telefonie |
| Pierwsza runda zaczyna się od gracza | zrobione |
| Tabela wyników na końcu gry (miejsca, postacie, błędy, punkty, odsłanianie od ostatniego miejsca) | zrobione, testy automatyczne, zrzuty z wersji webowej; animację trzeba obejrzeć na telefonie |
| Finał: 10 punktów za dobrą odpowiedź; mnożnik w rundzie 2 najwyżej ×3 | zrobione, testy automatyczne |
| Punkty i mnożnik naliczane od razu po dobrej odpowiedzi, przed wskazaniem | zrobione, testy automatyczne; do sprawdzenia na telefonie |
| Lektor czyta w sprincie szybciej (tempo 1,25, plansza normalnie) | zrobione, testy automatyczne; do odsłuchania na telefonie |
| Ekran rozgrywki na prostych kształtach (etap 4) | zrobione |
| Teksty prowadzącego | wersja tymczasowa, do rozbudowy w etapie 5 |
| Testy jednostkowe i testy z udawanym zegarem | zrobione |
| Logi aplikacji (`src/lib/log.ts`) | zrobione |
| Testy integracyjne (prawdziwa baza, boty, sterownik, logi) | zrobione |
| Pliki zabezpieczeń dla każdej funkcjonalności (`docs/zabezpieczenia/`) | zrobione |
| Lektor: głos prowadzącego i pytań na żywo (Piper + sherpa-onnx) | zrobione, sprawdzone na emulatorze |
| Lektor: intonacja pytająca (ton rośnie na końcu pytania) | zrobione, sprawdzone na próbkach z komputera, do odsłuchania na telefonie |
| Odpowiadanie na pytania głosem (mikrofon, rozpoznawanie mowy Androida) | zrobione, do sprawdzenia na telefonie |
| Kategorie: własne zestawy pytań generowane przez OpenAI z plików (do 3), wybór kategorii przed grą (naprawione: gra używa wybranej kategorii) | zrobione, do sprawdzenia na telefonie z kluczem API |
| Kategorie: import i eksport do plików `.kat` (JSON), zaimportowana kategoria działa jak z OpenAI | zrobione, testy automatyczne; do sprawdzenia na telefonie (wybór folderu) |
| Klucz API OpenAI tylko z `.env.local`; ekran i zapis na telefonie usunięte 03.11.2026 | zrobione, testy automatyczne; do sprawdzenia na telefonie |
| Hak pre-commit blokuje commit klucza (`.env.local` w `.gitignore`) | zrobione, testy automatyczne + ręczny test haka |
| Muzyka menu na wszystkich ekranach poza rozgrywką, bez przycisku wyciszania | zrobione, testy automatyczne; do odsłuchania na telefonie |
| Ustawienia: głośność muzyki i lektora (dwa suwaki 0–100%, zapis na telefonie, działa w menu, grze i lektorze) | zrobione, testy automatyczne; do odsłuchania na telefonie |
| Skórki postaci: gracz, boty i prowadzący z mimiką, wybór skórki w menu | zrobione, sprawdzone w przeglądarce, do sprawdzenia na telefonie |
| Serwer testowy na Azure Container Apps (`server/`: `/health`, WebSocket ping-pong, Docker) i przycisk „Sprawdź połączenie” w Ustawieniach; instrukcja `docs/backend-azure-instrukcja.md` | zrobione, testy automatyczne i test lokalny; wdrożenie na Azure do wykonania wg instrukcji |
| Razem testów automatycznych | 674 (+ 19 w `server/`) |
| Pierwsza rozgrywka na telefonie (Expo Go) | zrobione, poprawki wprowadzone |
| Grafiki pulpitów | czekamy na grafiki |

Technologie: React Native + Expo (SDK 57), TypeScript, Expo Router, react-native-svg, expo-image (skórki), expo-audio, react-native-sherpa-onnx (synteza mowy na telefonie), expo-document-picker, expo-file-system i expo-secure-store (kategorie), OpenAI Responses API, Jest (jest-expo); Python tylko do przygotowania modelu głosu.

## 2. Ekran główny

Aplikacja uruchamia się w trybie poziomym (`"orientation": "landscape"` w `app.json`). Na ekranie jest tytuł gry, cztery przyciski (Tryb Jednoosobowy, MultiPlayer, Dodatki, Kategorie) i ikona ustawień w prawym górnym rogu. Zębatka otwiera ekran „Ustawienia”, na razie z kluczem API OpenAI (rozdział 5, „Kategorie pytań”). Na niskich ekranach (telefon w poziomie, poniżej 400 punktów wysokości) tytuł i odstępy są mniejsze, żeby zmieściły się wszystkie przyciski.

Na tym etapie nie chcieliśmy używać zewnętrznych grafik, więc tło jest narysowane w kodzie jako SVG: ciemnoniebieski gradient, promienie jak w studiu telewizyjnym, gwiazdki z grubym obrysem i znaki zapytania. Przyciski mają efekt „wciskania” (przesuwają się w dół po naciśnięciu), żeby pasowały do komiksowego stylu.

Przycisk „Tryb Jednoosobowy” prowadzi do wyboru poziomu trudności: Łatwy, Normalny albo Ekspert. Jeśli gracz ma własne kategorie pytań, najpierw wybiera kategorię (rozdział 5, „Kategorie pytań”).

## 3. Silnik gry w trybie jednoosobowym

> Rozdziały 3–5 w częściach o etapach, zgłaszaniu się, osobowościach botów i `SoloController` opisują klasyczny silnik „1 z 10”, usunięty 03.11.2026 (powód w sekcji 7.55). Zostają jako zapis prac.

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

Najwyżej 2 pytania z rzędu mogą trafić do botów. Silnik liczy tę serię (`questionsWithoutHuman`), a `pickTarget` po jej wyczerpaniu wskazuje gracza, także po błędzie bota i przy zmianie rundy. Jedyny wyjątek to pierwsze pytanie finału: należy do zwycięzcy sprintu, więc seria może wtedy wynieść 3, a ten bot musi potem wskazać gracza.

## 5. Ekran rozgrywki

Po wybraniu poziomu trudności zaczyna się gra. Postacie to skórki z `assets/skins` (patrz „Skórki postaci”), a pulpity są na razie narysowane prostymi kształtami i podmienimy je, kiedy będą gotowe grafiki.

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

- odlicza czas na odpowiedź (15 s) i na zgłoszenie się w finale (6 s),
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
- Intonacja pytająca: model czytał pytania płasko, z tonem opadającym na końcu, bo uczył się na spokojnym monologu (200 nagrań, tylko 10 pytań). Po syntezie zdania zakończonego „?” `riseQuestionEnding` (`questionIntonation.ts`) odtwarza ostatnie 450 ms mowy coraz szybciej, jak przyspieszaną taśmę. Ton płynnie rośnie do 4 półtonów na ostatniej sylabie, a cisza po mowie zostaje bez zmian. Wariant wybraliśmy z próbek wygenerowanych na komputerze (sherpa-onnx 1.12.35, ta sama wersja co w telefonie) i pomiaru wysokości głosu: koniec pytania „Czy Wisła jest najdłuższą rzeką w Polsce?” idzie z ok. 145 Hz do ok. 170 Hz. Same parametry modelu (`noiseScale`, `noiseScaleW`) nie pomagały (7.46).

### Odpowiadanie głosem

Na pytanie można odpowiedzieć na dwa sposoby: wpisać odpowiedź albo ją powiedzieć. Obok pola odpowiedzi jest przycisk z mikrofonem. Włącza on rozpoznawanie mowy Androida (`expo-speech-recognition`, język `pl-PL`). W trakcie mówienia rozpoznany tekst pojawia się w polu, a gdy gracz skończy, odpowiedź jest zatwierdzana tak samo jak wpisana. Drugie dotknięcie mikrofonu kończy mówienie od razu.

- Rozpoznawanie zwraca kilka wersji tego, co usłyszało. Gra bierze pierwszą, którą sprawdzanie uznaje za poprawną, a jeśli żadna nie pasuje, najbardziej prawdopodobną. Liczebniki po imieniu wracają do zapisu z bazy („Mieszko pierwszy” → „Mieszko I”).
- Gdy mikrofon słucha, lektor milczy, bo rozpoznawanie słyszałoby jego głos.
- Cisza albo brak zgody na mikrofon nie kosztują szansy: gracz widzi komunikat i może spróbować jeszcze raz albo wpisać.
- Przycisk pojawia się tylko wtedy, gdy telefon ma rozpoznawanie mowy (nie ma go w Expo Go ani na emulatorze bez usług Google). O zgodę na mikrofon gra pyta dopiero przy pierwszym dotknięciu przycisku.

### Kategorie pytań (OpenAI)

Przycisk „Kategorie” na dole menu otwiera listę zestawów pytań. Pierwsza jest zawsze „Domyślna” – 50 pytań z `src/data/questions.json`. Ma kłódkę zamiast kosza, bo nie da się jej usunąć. Pod listą jest przycisk „Dodaj kategorię”. Własne kategorie mogą być najwyżej trzy; przy trzech przycisk jest wyłączony, a gra podpowiada, żeby usunąć którąś.

Nowa kategoria powstaje z plików gracza:

1. Gracz podaje nazwę (do 30 znaków, inną niż istniejące), wybiera od 1 do 9 plików (PDF, DOCX, TXT, MD, PPTX, XLSX, CSV, ODT, RTF; do 10 MB na plik i 30 MB razem) (Stan od 03.11.2026: klucz API OpenAI pochodzi tylko z `.env.local`; ekran ustawień do jego wpisywania usunięto, patrz sekcja 7.59.) Wcześniej klucz API OpenAI był brany z ustawień; gdy go brakowało, przycisk „Utwórz kategorię” był wyłączony, a ekran pokazywał przycisk „Ustawienia”.
2. Gra sprawdza wszystko, co da się sprawdzić bez internetu (nazwa, limit kategorii, pliki), zanim cokolwiek wyśle – zapytanie do OpenAI kosztuje.
3. Pliki idą do OpenAI Responses API jako `input_file` (base64), razem z opisem formatu teleturnieju: odpowiedzi otwarte, krótkie, z kilkoma akceptowanymi zapisami, daty i liczby cyframi, pomyłki dla botów. Model musi odpowiedzieć zgodnie ze schematem JSON (Structured Outputs, `strict: true`), w którym dziedziny i typy odpowiedzi to dokładnie wartości z gry.
4. Każde pytanie przechodzi przez tę samą walidację co baza domyślna (`parseQuestion`, wydzielone z `parseQuestionBank`). Złe pytania są odrzucane pojedynczo, powtórzenia pomijane. Prosimy o 60 pytań; poniżej 20 poprawnych kategoria nie powstaje.
5. Zestaw jest zapisywany w pliku JSON w pamięci telefonu (`expo-file-system`), a klucz API w szyfrowanym magazynie systemu (`expo-secure-store`). Klucza nie ma w kodzie ani w APK.

Klucz API wpisuje się raz, na ekranie „Ustawienia” (zębatka na ekranie głównym). Gra sprawdza go przed zapisem (bez spacji, zaczyna się od `sk-`, rozsądna długość), więc wklejony fragment albo spacja na końcu wychodzi od razu, a nie po kilku minutach generowania. Na Androidzie `expo-secure-store` trzyma klucz w `SharedPreferences` zaszyfrowanych kluczem z Android Keystore; wtyczka w `app.json` wyłącza ten magazyn z kopii zapasowej. Klucz zostaje po zamknięciu gry i po aktualizacji APK (ta sama nazwa wpisu co wcześniej). Ekran pokazuje go tylko zamaskowany (`sk-…abcd`) i pozwala go zmienić albo usunąć. Logika jest w `src/settings/ApiKeyStore.ts` (magazyn wstrzykiwany, w testach w pamięci), a ekrany czytają klucz przez `useSyncExternalStore` (`useApiKey`), więc po powrocie z ustawień ekran „Nowa kategoria” od razu go widzi.

Programista może zamiast tego wpisać klucz raz w pliku `.env.local` (`EXPO_PUBLIC_OPENAI_API_KEY=sk-…`, wzór w `.env.example`). Expo CLI wstawia go do kodu (`src/settings/configApiKey.ts`); klucz zapisany na telefonie ma pierwszeństwo, a ekran ustawień pokazuje „Z pliku .env.local: sk-…abcd”. Plik jest w `.gitignore`, a hak `.githooks/pre-commit` (włączany przez `npm install`, skrypt `prepare`) odrzuca commit z plikiem `.env*` albo z tekstem wyglądającym na klucz `sk-…` poza testami. Uwaga: taki klucz jest w zbudowanym APK jawnym tekstem, więc APK dla innych budujemy bez niego.

Gdy oprócz domyślnej jest choć jedna własna kategoria, „Tryb Jednoosobowy” pokazuje najpierw listę kategorii. Pytania w grze są losowane tylko z wybranej; z niej biorą też pomyłki boty. Bez własnych kategorii gra od razu przechodzi do wyboru poziomu.

**Import i eksport.** Przy każdej własnej kategorii jest przycisk eksportu (strzałka obok kosza), a pod listą obok „Dodaj kategorię” przycisk „Importuj”. Eksport pyta o folder (systemowy wybór folderu Androida) i zapisuje tam plik `<nazwa kategorii>.kat`; znaki niedozwolone w nazwach plików zamieniane są na `_`. W środku jest zwykły JSON: `format` (`jeden-z-wielu/kategoria`), `version` (1), `name`, `exportedAt`, `sourceFiles` i `questions` w formacie bazy pytań (bez wewnętrznych id). Import przyjmuje tylko pliki z rozszerzeniem `.kat` (sprawdzane przed czytaniem, bo Android nie zna typu MIME `.kat` i nie da się ich odfiltrować w wybieraku), do 5 MB. Pytania z pliku przechodzą tę samą walidację co pytania z OpenAI; poniżej 20 poprawnych import jest odrzucany. Zaimportowana kategoria trafia do tego samego magazynu co kategoria z OpenAI: dostaje nowe id, liczy się do limitu 3, można ją wybrać przed grą, wyeksportować i usunąć. Jeśli nazwa jest zajęta (np. ten sam plik zaimportowany drugi raz), gra nadaje „Nazwa (2)”. Domyślnej kategorii nie da się eksportować. Kod: `categoryFile.ts` (format), `transferQuestionSet.ts` (przebieg, z wstrzykiwanym odczytem i zapisem), `device/categoryFiles.ts` (wybierak, zapis przez `Directory.pickDirectoryAsync` z typem `application/octet-stream`, żeby Android nie dopisał `.json`).

Moduły: `src/categories/` (logika bez zależności od telefonu, z atrapami w testach) i `src/categories/device/` (wybór plików, zapis), klucz API w `src/settings/`. W kodzie kategoria to „zestaw pytań” (`QuestionSet`), żeby nie mylić jej z polem `category` pytania (dziedzina: Historia, Sport…).

Tę funkcjonalność pisaliśmy metodą TDD: najpierw plik zabezpieczeń i testy (commit z testami, które jeszcze nie przechodziły), potem kod.

### Skórki postaci

Skórki leżą w `assets/skins/<male|female|player>/<id>/<id>-<normal|smile|closed-eyes>.png`, prowadzący w `assets/skins/host/`. Lista powstaje przy budowaniu paczki (`require.context`), więc nowy folder działa bez zmian w kodzie. Na ekranie głównym obok menu stoi postać gracza, a wieszak pod nią otwiera ekran wyboru (`src/app/skins.tsx`). Wybór zostaje na telefonie.

Boty mają w profilu płeć i dostają skórkę ze swojej puli, każdą najwyżej raz w grze. Losowanie botów ma limit płci równy liczbie skórek. Skórki losuje osobny generator, więc gry z tego samego ziarna i symulacje działają jak wcześniej.

Mimika: dobra odpowiedź to uśmiech, pomyłka to zamknięte oczy, a w spoczynku postać mruga co 2,5–6 s. Prowadzący uśmiecha się przy dobrej odpowiedzi i na koniec gry. Postać, która odpadła, ma otwarte oczy i jest przyciemniona (pod obrazkiem leży jej ciemna sylwetka).

## 6. Testy i analiza dynamiczna

Testy uruchamiamy poleceniem `npm test` (Jest z presetem `jest-expo`). Same testy integracyjne: `npm run test:integration`, pokrycie kodu: `npm run test:coverage`. Testy są w folderach `__tests__` obok testowanego kodu.

| Plik | Liczba testów | Co sprawdza |
|---|---|---|
| `answers-test.ts` | 11 | normalizacja tekstu, literówki, liczby, krótkie odpowiedzi |
| `questions-test.ts` | 18 | walidacja bazy pytań i typów odpowiedzi, czy każda zapisana odpowiedź jest akceptowana |
| `potato/__tests__/potato-test.ts` | 47 | zasady rund „Gorący Ziemniak”, limit mnożnika, odrzucanie niedozwolonych ruchów, ranking, licznik i limit pytań bez gracza, nagroda przed przekazaniem pytania |
| `bots-test.ts` | 20 | decyzje botów, wpływ poziomu trudności, pomyłki tego samego rodzaju, limit płci przy losowaniu |
| `potato/__tests__/controller-test.ts` | 72 | sterownik na udawanym zegarze: tury, kolejność wynik → wskazanie → tura, nagroda od razu, wskazania, limit pytań bez gracza, plansza rundy, start od gracza, sprint (start po planszy, kary, koniec w czasie wskazywania), 5 s w finale, pauza, czekanie na lektora, pasek czasu, odpadający gracz, koniec gry po odpadnięciu człowieka |
| `components/potato/__tests__/gameDisplay-test.ts` | 20 | co widać na ekranie: pytanie w czasie wyniku i planszy, podświetlenie, tryb odbicia, licznik wskazywania, kolor i napis mnożnika |
| `components/potato/__tests__/scoreboardData-test.ts` | 10 | tabela wyników: kolejność z rankingu, zwycięzca tylko po pełnej grze, nagłówek, wyjaśnienie kolejności, wysokość wierszy |
| `components/solo/__tests__/answerLayout-test.ts` | 4 | położenie panelu odpowiedzi nad klawiaturą, tryb kompaktowy |
| `lib/__tests__/log-test.ts` | 15 | logi: poziomy, bufor, wyjście do konsoli, odporność na błędy, czystość silnika |
| `integration-test.ts` | 63 | testy integracyjne: całe gry na prawdziwej bazie i botach, tabela wyników zgodna z rankingiem, limit mnożnika i 10 punktów w finale, tasowanie talii, zgodność logów z przebiegiem gry, limit pytań bez gracza (10 ziaren na każdy poziom), plansze rund, pauza w trakcie całej gry, brak decyzji w finale |
| `narration/__tests__/questionIntonation-test.ts` | 10 | intonacja pytająca: rozpoznanie pytań, koniec mowy przed ciszą, wzrost tonu w końcówce, początek i cisza bez zmian, krótki dźwięk, cisza |
| `narration/__tests__/pronunciation-test.ts` | 3 | wymowa: cyfry rzymskie po imieniu jako liczebniki, zwykły tekst bez zmian |
| `narration/__tests__/potato-narrator-test.ts` | 24 | lektor: kiedy mówi, tempo w sprincie, przerywanie kwestii, pominięcie planszy, uciszanie, pauza, błędy syntezy, pasek po odbiciu w ciemno, zwolnienie |
| `narration/__tests__/narration-integration-test.ts` | 11 | testy integracyjne lektora: całe gry na prawdziwej bazie, intonacja pytająca, brak paska w czasie mówienia, pominięcie planszy, pauza, wyjście |
| `speech/__tests__/spokenAnswer-test.ts` | 7 | odpowiedź głosem: zapis jak w bazie (cyfry rzymskie), wybór wersji rozpoznania, cisza |
| `speech/__tests__/VoiceAnswerSession-test.ts` | 10 | mikrofon: zgoda, słuchanie, jedna odpowiedź, cisza, błędy, pauza, zamknięcie panelu |
| `speech/__tests__/voice-answer-integration-test.ts` | 3 | testy integracyjne: cała gra z odpowiedziami głosem i lektorem, odpowiedź po czasie, pauza |
| `categories/__tests__/sourceFiles-test.ts` | 26 | kategorie: obsługiwane formaty, limity liczby i rozmiaru plików, komunikaty |
| `categories/__tests__/generatedQuestions-test.ts` | 18 | kategorie: czyszczenie pytań z OpenAI, odrzucanie złych pojedynczo, powtórzenia |
| `categories/__tests__/openaiGenerator-test.ts` | 24 | kategorie: zapytanie do Responses API (pliki, schemat), błędy HTTP, sieć, odmowa, ucięta odpowiedź, limit czasu, klucz poza logami |
| `categories/__tests__/QuestionSetStore-test.ts` | 34 | kategorie: domyślna nieusuwalna, limit 3, jednoczesne dodania, zapis i uszkodzony zapis, nazwy |
| `categories/__tests__/soloEntry-test.ts` | 4 | kategorie: kiedy pokazać listę kategorii przed grą |
| `categories/__tests__/categoryFile-test.ts` | 34 | import/eksport: rozszerzenie `.kat`, bezpieczna nazwa pliku, zapis i odczyt JSON, zły format i wersja, złe pytania, za mało pytań, wolna nazwa |
| `categories/__tests__/transferQuestionSet-test.ts` | 13 | import/eksport: zapis jak kategoria z OpenAI, rozszerzenie, rozmiar i limit sprawdzane przed czytaniem, zajęta nazwa, błędy odczytu i zapisu, anulowanie, domyślna nieeksportowalna |
| `categories/__tests__/categories-integration-test.ts` | 21 | testy integracyjne: od plików przez OpenAI (atrapa) do całej gry na wygenerowanej kategorii, zabezpieczenia przed wysłaniem plików (także brak klucza), eksport → import na innym telefonie → gra, limit przy imporcie |
| `settings/__tests__/configApiKey-test.ts` | 8 | klucz z `.env.local`: format, brak klucza, klucz poza logami |
| `settings/__tests__/VolumeStore-test.ts` | 36 | głośność: przycinanie do 0–100, odczyt uszkodzonego pliku, wczytanie, zapis, łączenie zapisów, zmiana przed wczytaniem, błędy pliku |
| `audio/__tests__/menuMusicRoutes-test.ts` | 1 | muzyka menu gra na każdym ekranie z `src/app` poza rozgrywką |
| `audio/__tests__/volume-test.ts` | 7 | głośność odtwarzaczy: skalowanie poziomu muzyki, lektor, podpięcie lektora do ustawień |
| `components/settings/__tests__/sliderValue-test.ts` | 9 | suwak: wartość z położenia palca, poza torem, tor bez rozmiaru, krok czytnika ekranu |
| `settings/__tests__/volume-integration-test.ts` | 5 | testy integracyjne: zmiana głośności od razu w muzyce menu, gry (także przyciszonej przy lektorze) i lektorze, muzyka wg ekranu, głośność po ponownym uruchomieniu, nieudany zapis |
| `skins/__tests__/catalog-test.ts` | 7 | skórki: układanie katalogu ze ścieżek, nowy folder, brakujące klatki, nieznane pliki |
| `skins/__tests__/assignSkins-test.ts` | 7 | skórki: zgodność płci, brak powtórek, wybór gracza, użycie wszystkich skórek, brak skórki |
| `skins/__tests__/IdleFace-test.ts` | 10 | mimika: mruganie, uśmiech, kasowanie zegarów, mimika w reakcji na odpowiedź |
| `skins/__tests__/SkinSelectionStore-test.ts` | 12 | wybór skórki: zapis, uszkodzony zapis, usunięta skórka, błędy magazynu, kolejność zapisów |
| `skins/__tests__/real-assets-test.ts` | 4 | prawdziwy folder skórek: komplet klatek, kanał alfa, liczba skórek, nazwy zasobów Androida |
| `skins/__tests__/skins-integration-test.ts` | 5 | testy integracyjne: prawdziwe skórki w całej grze, nowa skórka w losowaniu, wybór gracza |
| `backend/__tests__/serverHealth-test.ts` | 24 | połączenie z serwerem: adres z `.env.local` (spacje, ukośnik, protokół), odpowiedź `/health`, błędy HTTP, nie-JSON, inny kształt, brak sieci, limit czasu, logi |
| `backend/__tests__/serverHealth-integration-test.ts` | 2 | testy integracyjne: zimny start kontenera na Azure (pierwsza próba po czasie, druga udana), logi `[backend]` |
| **Razem** (cały `npm test`, łącznie z plikami spoza tabeli) | **674** | |
| `server/src/__tests__/app.test.ts` (osobno: `cd server && npm test`) | 19 | serwer: `/health`, 404, WebSocket ping-pong, zły JSON i nieznany typ bez zamykania, za duża wiadomość zamyka tylko jedno połączenie, zła ścieżka, zamknięcie kodem 1001 |

Wszystkie testy przechodzą. Cały zestaw trwa ok. 40 sekund.

### Testy integracyjne

Testy jednostkowe sprawdzają moduły osobno, często na uproszczonych danych. Testy integracyjne (`src/game/__tests__/integration-test.ts`) składają aplikację tak samo jak ekran gry (`usePotatoController`): prawdziwą bazę pytań, `createPotatoSoloGame` z losowym miejscem gracza, prawdziwe profile botów, sterownik, silnik i logi. Test prowadzi grę jak gracz na telefonie, na udawanym zegarze. Sprawdzamy:

- czy pełna gra kończy się poprawnie na każdym poziomie i nie zostają uruchomione liczniki,
- czy gracz, który nie odpowiada, odpada i od razu widzi wyniki,
- czy to samo ziarno daje identyczny przebieg całej gry, a różne ziarna inną kolejność pytań,
- czy logi zgadzają się z grą: kolejność rund, brak ostrzeżeń i błędów w całej grze,
- podwójne zatwierdzenie, odbicie w ciemno oraz pauzę z pozostałym czasem.

Kategorie mają osobne testy integracyjne (`src/categories/__tests__/categories-integration-test.ts`). Składają to samo co ekrany: prawdziwy magazyn kategorii (zapis w pamięci zamiast pliku), prawdziwy generator i walidację plików, `soloEntryRoute` oraz całą grę (silnik, boty, sterownik) na udawanym zegarze. Jedyna atrapa to `fetch` udający OpenAI (a przy imporcie i eksporcie – dysk w pamięci). Sprawdzamy, że kategoria wyeksportowana na jednym telefonie i zaimportowana na drugim działa w całej grze i przeżywa ponowne uruchomienie, że cała gra na wygenerowanej kategorii zadaje tylko jej pytania, kategoria przeżywa ponowne uruchomienie, po usunięciu ostatniej własnej kategorii znika lista wyboru, a przy limicie, złej nazwie, złych plikach albo braku klucza API gra nie czyta plików i nie wysyła zapytania. Te same testy sprawdzają, że klucz z konfiguracji trafia do zapytania, ale do żadnego logu, a przy złym formacie klucza nic nie jest czytane ani wysyłane.

Lektor ma osobne testy integracyjne (`src/narration/__tests__/narration-integration-test.ts`). Składają to samo co `usePotatoController`: prawdziwą bazę, sterownik, boty i `PotatoNarrator`. Jedyna atrapa to synteza mowy, która „mówi” 60 ms na znak na udawanym zegarze i kończy wypowiedź obietnicą, jak prawdziwa. Sprawdzamy, że w całej grze (na każdym poziomie) żadne pytanie nie jest czytane dwa razy z rzędu, w czasie mówienia nie biegnie żaden pasek czasu (także po odbiciu w ciemno), a pauza i wyjście z gry wyciszają lektora.

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
| `[ustawienia]` | wczytanie ustawień i zapis albo usunięcie klucza API – tylko czy klucz jest, nigdy jaki; błędy magazynu (`warn`/`error`); wczytanie i zmiana głośności (liczby 0–100), uszkodzony plik głośności (`warn`), błąd zapisu (`error`) |
| `[symulator]` | przekroczenie limitu kroków |

Silnik gry nic nie loguje, bo jest czystą funkcją. Jego ruchy i zdarzenia loguje sterownik. W testach logi nie trafiają do konsoli, tylko do bufora. W wersji produkcyjnej pomijamy poziom `debug`.

### Testy z udawanym zegarem

Sterownika nie da się sensownie testować w prawdziwym czasie, bo jedna gra trwa kilkanaście minut. Używamy udawanego zegara Jesta (`jest.useFakeTimers()`): test sam przesuwa czas, np. o 14 999 ms, i sprawdza, że gracz jeszcze ma czas, a po kolejnej milisekundzie traci szansę. W ten sposób sprawdzamy m.in. odpowiedź w ostatniej chwili, podwójne kliknięcie „OK”, pauzę i wznowienie oraz wyścig o zgłoszenie w finale. Dwa testy rozgrywają całą grę (z graczem odpowiadającym zawsze dobrze i zawsze źle) w ułamku sekundy.

### Test całej aplikacji w przeglądarce

Aplikację zbudowaliśmy w wersji webowej (`npx expo export --platform web`) i uruchomiliśmy w przeglądarce Edge bez okna, w rozmiarze telefonu w poziomie (844×390). Edge ma opcję „czasu wirtualnego”, który przewija liczniki bez czekania, więc w ok. 1,5 sekundy rozegrała się cała gra na poziomie Ekspert, aż do ekranu wyników. Zrzuty ekranu z różnych momentów gry posłużyły do sprawdzenia układu.

### Pokrycie kodu

`npx jest --coverage` dla `src/game` i `src/lib`: instrukcje 94,8%, gałęzie 87,5%, funkcje 99,3%, linie 97,0%. Moduł logów ma 100% instrukcji. Najsłabiej pokryte są teksty prowadzącego (`hostLine.ts`, ok. 69% instrukcji), które i tak zostaną przepisane w etapie 5. Niepokryte zostały też gałęzie obsługi błędów, do których prawidłowa gra nie dochodzi (błąd bazy pytań, limit kroków symulatora, odrzucony ruch w sterowniku).

### Symulacje gier

> Symulator działał na klasycznym silniku i został usunięty 03.11.2026 razem z nim. Opis i wyniki poniżej to zapis analizy tamtego silnika. Dla zasad „Gorący Ziemniak” nie ma jeszcze symulacji balansu.

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

### Kategorie pytań

**7.45. `Buffer` w teście przechodził w Jest, ale nie w TypeScript**
Test integracyjny kategorii kodował treść udawanego pliku przez `Buffer.from(...).toString('base64')`. Jest działa w Node, więc test przechodził, ale `npx tsc --noEmit` zgłosił „Cannot find name 'Buffer'”: projekt ma typy dla React Native, a nie dla Node, i dobrze, bo w aplikacji `Buffer` nie istnieje. Zamieniliśmy go na `btoa`, które jest i w Node, i w React Native.

### Lektor: intonacja pytająca

**7.46. Pytania czytane płasko; same parametry modelu nie pomagały**
Lektor czytał pytania tak samo jak zwykłe zdania. Przyczyna leży w danych treningowych głosu: 200 nagrań monologu o finansach, w tym tylko 10 pytań i ani jednego wykrzyknika. Najpierw sprawdziliśmy parametry syntezy (`noiseScale` 0.667–0.95, `noiseScaleW` 0.8–1.2, `lengthScale`). Na próbkach z komputera pytanie „Czy…?” we wszystkich wariantach kończyło się spadkiem tonu o 2–4 półtony, bo te parametry dodają tylko losowe wahania. Pierwsza próba obróbki dźwięku (zmiana wysokości „ziarnami” po 40 ms) rozmywała głos i pomiar tonu gubił ostatnią sylabę. Zadziałała dopiero „przyspieszana taśma” na końcówce. Po drodze: pakiet `piper-tts` na macOS szuka danych espeak pod ścieżką z maszyny, na której go zbudowano, a `sherpa-onnx` 2.x w Pythonie nie zamienia już tekstu na fonemy dla tego modelu, więc próbki robiliśmy w wersji 1.12.35, tej samej co w aplikacji. Wniosek: przy syntezie mowy oceniać zmiany pomiarem (tu wysokość tonu), a nie tylko nazwą parametru.

### Ustawienia: głośność
- **Problem:** pierwsza wersja suwaka używała `PanResponder` tworzonego raz, który czytał bieżącą szerokość toru i funkcje z `useRef` aktualizowanego w trakcie renderu. `npx expo lint` (reguły React Compiler `react-hooks/refs`) zgłosił to jako błąd: odczyt refa w renderze może dać nieaktualne wartości po optymalizacji kompilatora.
- **Rozwiązanie:** suwak korzysta bezpośrednio z propsów systemu dotyku (`onResponderGrant`, `onResponderMove`, `onResponderRelease`); ref przechowuje tylko początek dotyku i jest zmieniany wyłącznie w obsłudze dotyku. Matematyka suwaka jest w czystej funkcji `sliderValue` z testami.

### Kategorie: import i eksport
- **Problem:** przy sprawdzaniu zmian `npx tsc --noEmit` zgłaszał 5 błędów typów tras (np. `"/categories/new"` nie pasuje do typu `router.push`), także na czystym `main`, a `npx expo lint` – „Unable to resolve path to module 'expo-document-picker'”. Przyczyna: `node_modules` nie zgadzał się z `package-lock.json` (brakowało m.in. `expo-document-picker`, `expo-secure-store`, `expo-speech-recognition`), więc wygenerowany plik `.expo/types/router.d.ts` był stary, a ESLint trzymał w pamięci podręcznej stare wyniki.
- **Rozwiązanie:** `npm install`, krótkie uruchomienie `npx expo start` (generuje typy tras na nowo) i `npx expo lint --no-cache`. Wniosek: po `git pull` z nowymi zależnościami zawsze `npm install`, a dziwne błędy typów tras to najpierw sygnał nieaktualnych `.expo/types`.

### Skórki postaci

**7.47. Trzy skórki miały czarne tło zamiast przezroczystości**
Pliki `male/002`, `male/003` i `player/201` były zapisane w trybie RGB, więc na scenie byłyby czarnym kwadratem. Napisaliśmy `scripts/skins/remove_background.py`, który wycina tło wypełnieniem od rogów. Przy wyższym progu wypełnienie wchodziło w czarny sweter skórki `201`, dlatego próg to 12. Test `real-assets-test.ts` sprawdza teraz kanał alfa każdego pliku.

**7.48. Test ostrzeżeń sprawdzał pole, którego nie ma**
Testy filtrowały wpisy logów po `entry.module`, a pole nazywa się `tag`. Filtr zawsze zwracał pustą listę, więc test „brak ostrzeżeń” dla prawdziwych skórek przechodził bez sprawdzania czegokolwiek. Wyszło to na testach, które oczekiwały ostrzeżenia. Używamy teraz `getLogEntries({ tag, minLevel })`.

**7.49. Prowadzący ze skórką wchodził pod kartę pytania, a pulpity sięgały krawędzi**
Na ekranie o wysokości 360 pierwsza wersja prowadzącego (do pasa) wypychała jego dymek pod kartę pytania, a wyższe popiersie graczy dosuwało pulpity do dołu ekranu. Prowadzący jest teraz popiersiem, a wzór na szerokość pulpitu uwzględnia wyższą postać. Sprawdzone na zrzutach ekranu 800×360, 915×412 i 1280×720.

**7.50. Przezroczystość to nie przyciemnienie**
Postać, która odpadła, miała `opacity` 0,35, ale na jasnym tle wyglądała na wyblakłą i prześwitywało przez nią tło. Pod obrazkiem leży teraz ciemna sylwetka tej samej postaci (`tintColor` w `expo-image`).

**7.51. Wersja webowa nie uruchamia się od czasu dodania kategorii (nienaprawione)**
`fileStorage` tworzy `new File(Paths.document, ...)` już przy imporcie, a `expo-file-system` nie działa na webie, więc serwer zwraca błąd 500 („this.validatePath is not a function”). `questionSets` używa go na ekranie głównym także bez skórek. Ekrany skórek oglądaliśmy z tymczasową wersją `fileStorage.web.ts`, której nie ma w repozytorium.

### Poprawki gry w rundach (03.11.2026)

**7.52. Wybrana kategoria nie działała w grze**
Po wyborze kategorii padały pytania z domyślnej bazy. Commit `0ad0eb8` zamienił `SoloGame` (dostawał pytania) na `PotatoGame`, a `usePotatoController` miał na stałe `QUESTION_BANK`, więc parametr `set` nikt już nie czytał. Testy tego nie wykryły, bo `categories-integration-test.ts` grał dalej na starym `SoloController`. Ekran `solo/game.tsx` czyta teraz `set`, a pytania są wymaganym parametrem `PotatoGame` i hooka. Test integracyjny gra już na `PotatoController`.

**7.53. Po odbiciu pytania rywal miał najpierw resztę czasu gracza**
Odbicie w ciemno kasowało zegar, ale nie `deadline` w widoku. Lektor zaczynał czytać pytanie, nowy licznik czekał na ciszę, a w tym czasie pasek animował stary czas gracza. Po ciszy pojawiał się pełny czas rywala. To samo działo się po poprawnej odpowiedzi, przy „Komu przekazujesz pytanie?”. Sam czas bota był poprawny, błąd dotyczył tylko paska. `clearMain` zeruje teraz `deadline` i `timerMs`. Testy najpierw odtworzyły błąd (`deadline` = 5000 zamiast `null`).

**7.54. Odpadający gracz dostawał drugie podejście do pytania**
Po błędzie ostatnią szansą `chooseNext` mógł wylosować tego samego gracza. Silnik odrzucał ruch („już odpadł”), a sterownik zadawał pytanie jeszcze raz, więc gracz mógł uniknąć odpadnięcia. Wyszło to dopiero po przeniesieniu testów integracyjnych, które sprawdzają brak ostrzeżeń w całej grze, na nowy silnik. `chooseNext` pomija teraz gracza, którego błąd eliminuje (`errorEliminates`).

**7.55. Usunięcie klasycznego silnika**
Klasyczny tryb „1 z 10” (`engine.ts`, `SoloController`, `NarrationDirector`, `simulate.ts`, `SoloGame`) nie był dostępny z żadnego ekranu, a testy przechodziły na nim dalej, chociaż gra działała na czymś innym. Przez to nie wykryły 7.52 i 7.54. Usunęliśmy go, a testy integracyjne (gra, lektor, odpowiedzi głosem, kategorie, skórki) przenieśliśmy na `PotatoController`. Liczba testów spadła z 659 do 533, bo zniknęły testy usuniętego kodu. Przy przenoszeniu wyszły dwie luki nowego sterownika: brak limitu czasu na zawieszonego lektora i brak wyciszania lektora, gdy słucha mikrofon. Opis jest w `docs/ARCHITEKTURA.md`, rozdział 13. Talia jest też teraz tasowana (wcześniej każda gra szła po pytaniach w tej samej kolejności).

**7.56. Prowadzący najpierw kazał wskazywać, a dopiero potem chwalił**
Po poprawnej odpowiedzi padało „Komu przekazujesz pytanie?”, a „Brawo, dobrze!” dopiero po wskazaniu. Teraz obie kwestie padają w tej kolejności przed wskazaniem, a po nim lektor milczy. Przy okazji wyszło, że `commit` zmieniał stan gry przed nałożeniem wyniku, przez co lektor na chwilę zaczynał kwestię od nowa. Stan i wynik zmieniają się teraz w jednej aktualizacji widoku.

**7.57. Gra toczyła się dalej po odpadnięciu gracza**
Gracz, który odpadł, musiał oglądać, jak boty grają dalej (zgłoszone z trzeciego etapu). Po pokazaniu wyniku gra kończy się od razu (akcja `endEarly`) i pojawiają się wyniki. Pozostałe boty nie grają już między sobą, więc nie ma zwycięzcy: są układane wg stanu gry, a ekran i lektor mówią „Odpadasz”.

**7.58. Muzyka grała tylko na części ekranów**
Każdy ekran sam włączał muzykę, a robiły to tylko menu główne, wybór poziomu i ustawienia. Kategorie i skórki grały w ciszy. Muzyka jest teraz włączana w głównym układzie i zależy od trasy: gra wszędzie poza `/solo/game`. Test czyta trasy z folderu `src/app`. Przyciski wyciszania usunęliśmy razem z ich mechanizmem, bo muzyką steruje suwak w Ustawieniach.

**7.59. Klucz API tylko ze zmiennej środowiskowej**
Usunęliśmy ekran wpisywania klucza, zapis w `expo-secure-store` i tę zależność, więc potrzebny jest nowy build. Oznacza to odejście od wcześniejszej zasady „klucza nie ma w APK”: klucz z `.env.local` jest teraz w paczce jawnym tekstem, a build EAS bez zmiennych środowiskowych nie ma klucza wcale. Klucz zapisany wcześniej na telefonie zostaje w magazynie do odinstalowania aplikacji albo wyczyszczenia jej danych.

**7.60. Boty grały między sobą, a gracz tylko patrzył**
`pickTarget` wybierał lidera albo najsłabszego i nie sprawdzał, kiedy gracz ostatnio dostał pytanie, więc seria pytań dla botów nie miała górnej granicy. Teraz po 2 pytaniach z rzędu bot musi wskazać gracza (zob. `docs/zabezpieczenia/limit-pytan-botow.md`). Pierwsza wersja testu sterownika nie przeszła, bo przy równych życiach gracz był liderem albo najsłabszym i dostawał pytanie bez udziału limitu. Wyszło też, że `chooseNext` wybiera cel przed odjęciem życia, czyli na stanie sprzed odpowiedzi. Test ustawia teraz życia tak, żeby bez limitu gracz nie dostał tych pytań.

**7.61. Czas sprintu leciał, zanim można było grać**
Sterownik włączał zegar sprintu w chwili zmiany rundy, czyli już przy wyniku odpowiedzi kończącej rundę 2. Czas biegł więc przez wynik, planszę i czytanie zasad (zgłoszone z telefonu). Zegar rusza teraz dopiero po zamknięciu planszy. Plansza nie znika już sama: czeka na przycisk, który w trakcie mówienia pomija lektora. Pauza też nie uruchamia zegara przed planszą.

**7.62. Zegar sprintu rozjeżdżał się z karami i wskazywaniem**
Analiza przebiegu pokazała trzy błędy. Kara odejmowała sekundę w silniku, ale zaplanowany koniec zostawał stary, więc sprint trwał dłużej, niż pokazywał pasek. Wskazanie rywala nie synchronizowało zegara, więc pasek odskakiwał do tyłu. Dobra odpowiedź czekająca na wskazanie przepadała, gdy w tym czasie mijał czas sprintu. Do tego odpowiedź, która pierwsza zauważyła koniec sprintu, mogła zostać oceniona na pytaniu z finału, jeśli zwycięzcą sprintu był ten sam gracz.

**7.63. Następne pytanie było widać przed czasem**
Silnik rozdaje kolejne pytanie już przy zatwierdzeniu odpowiedzi, a ekran pokazywał pytanie ze stanu gry. W czasie wyniku i planszy gracz mógł więc czytać swoje następne pytanie, zanim ruszył jego czas, a lektor mówił wtedy o poprzednim. Wynik niesie teraz pytanie, na które odpowiadano, a na planszy pytania nie widać. Przy planszy czekającej na dotknięcie byłby to czas na namysł bez limitu.

**7.64. Finał: nowe pytanie „znikąd”**
Bez decyzji przez 10 s losowanie mogło wskazać samego gracza, a licznika nie było widać poza cienkim paskiem. Wyglądało to jak nowe pytanie bez powodu (zgłoszone z telefonu). W finale jest teraz 5 s, duży licznik, a po czasie odpowiada zawsze losowy rywal. Test skórek wskazywał pierwszego aktywnego gracza, czyli czasem siebie, i przy graczu bez błędów grał w nieskończoność; teraz wskazuje rywala.

**7.65. Pozostałe poprawki przebiegu gry**
Przycisk pauzy i pauza przy przejściu aplikacji w tło (sterownik miał pauzę, ale tylko okno wyjścia z niej korzystało; paski dostawały na stałe `paused={false}`). Pierwsze pytanie gry i pytanie finału nie są już zaczynane przez lektora tuż przed planszą. Wskazanie rywala przerywa „Komu przekazujesz pytanie?”, zamiast czekać na koniec zdania. Mikrofon ucisza lektora. Tryb odbicia w ciemno nie przechodzi na kolejne pytanie. Podświetlony jest ten, kto właśnie odpowiedział, a nie ten, kto dostanie następne pytanie.

**7.66. Punkty i mnożnik dopiero po wskazaniu gracza**
Sterownik odkładał całą poprawną odpowiedź człowieka do chwili wskazania następnego gracza, bo silnik miał jedną akcję `answer`, która nagradzała i przekazywała pytanie naraz. Prowadzący mówił „Brawo, dobrze!”, a punkt w sprincie i finale oraz mnożnik w rundzie 2 zmieniały się kilka sekund później (zgłoszone z telefonu). Silnik ma teraz akcje `award` (nagroda od razu) i `pass` (samo przekazanie). Boty nadal odpowiadają jedną akcją, bo nic nie wskazują po czasie, a test pilnuje, że obie drogi dają ten sam stan. Zmieniła się też kolejność na ekranie, bo zielony dymek również czekał na wskazanie: najpierw wynik z dymkiem i pochwałą, potem pytanie znika i gracz wskazuje następnego, a po wskazaniu od razu idzie kolejna tura, bez drugiego wyniku. Czas na wskazanie startuje po pytaniu lektora o gracza, a w sprincie czas biegnie także w trakcie wyniku.

**7.67. Pliki różniące się tylko wielkością liter**
Pierwsza wersja tabeli miała komponent `Scoreboard.tsx` i dane `scoreboard.ts`. Na Windowsie to ta sama nazwa bez rozszerzenia, więc import `Scoreboard` trafiał w plik z danymi i `tsc` zgłaszał błąd TS1149. Dane są teraz w `scoreboardData.ts`. Po zmianie nazwy `npx expo lint` dalej zgłaszał ten sam błąd, bo czytał wynik z własnej pamięci podręcznej. Zwykłe `npx eslint` przechodziło, a po zmianie daty pliku (`touch`) przeszło też `expo lint`.

**7.68. Wersja webowa przestała się budować**
`npx expo export --platform web` kończy się błędem `this.validatePath is not a function`, bo przy budowaniu statycznym ładują się wszystkie trasy, a `expo-file-system` nie działa w przeglądarce. Tabelę sprawdziliśmy na tymczasowej, osobnej trasie zbudowanej w trybie `single`; po zrobieniu zrzutów (844×390 i 640×360) trasa została usunięta. Samej wersji webowej nie naprawialiśmy, bo celem projektu jest Android.

## 8. Dalsze plany

- Testy na prawdziwym telefonie (szczególnie klawiatura i wycięcie aparatu w poziomie oraz lektor: wymowa, opóźnienie syntezy na słabszym telefonie).
- Lektor: intonację pytającą odsłuchać na telefonie; jeśli to za mało, nagrać zdania w stylu prowadzącego (pytania, okrzyki) i dotrenować model.
- Lektor: mniejszy model (kwantyzacja do int8 zmniejszyłaby go ok. 4 razy, kosztem jakości głosu — do odsłuchania), paczka AAB do Google Play, włącznik lektora w ustawieniach.
- Etap 5: prowadzący i jego teksty.
- Etap 6: wstawienie grafik postaci i pulpitów, animacje.
- Etap 7: dźwięki, wibracje, zapis statystyk.
- Sprawdzenie balansu zasad „Gorący Ziemniak” (nowy symulator albo testy z graczami).
- Lektor: limit czasu na zawieszony głos.
- Rozbudowa bazy pytań.
- Kategorie: sprawdzenie na telefonie z prawdziwym kluczem (czas generowania, jakość pytań z różnych formatów plików). Docelowo zapytania do OpenAI przez własny serwer (np. funkcja Supabase), żeby gracz nie musiał mieć własnego klucza.
- Testy komponentów ekranu (np. React Native Testing Library) i zapis logów z telefonu do pliku albo ekranu diagnostycznego.
