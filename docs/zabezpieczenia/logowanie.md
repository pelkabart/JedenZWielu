# Logowanie

Moduł: `src/lib/log.ts`
Testy: `src/lib/__tests__/log-test.ts`, `src/game/__tests__/integration-test.ts`

Logi pokazują, co aplikacja robi w trakcie działania: kto odpowiada, kiedy mija czas, kiedy gra jest wstrzymana, które ruchy gracza zostały zignorowane. Na telefonie (Expo Go) widać je w terminalu z `npx expo start`. Ostatnie wpisy są też trzymane w pamięci (`getLogEntries()`), dzięki czemu testy mogą sprawdzać, co zostało zalogowane.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Logi w silniku zepsują czystą funkcję `reduce`
**Ryzyko:** silnik jest czystą funkcją, a test `engine-test.ts › nie modyfikuje poprzedniego stanu` i symulacje polegają na tym, że nie ma skutków ubocznych. Logowanie w `reduce` byłoby takim skutkiem ubocznym. Do tego 900 symulowanych gier oznacza setki tysięcy wpisów.
**Zabezpieczenie:** silnik nic nie loguje. Akcje i zdarzenia silnika loguje sterownik (`SoloController.apply`), który i tak zajmuje się czasem i skutkami ubocznymi. Symulator loguje tylko błąd (przekroczony limit kroków).
**Test:** `engine-test.ts › nie modyfikuje poprzedniego stanu` (bez zmian), `log-test.ts › symulacja pełnej gry nie zapisuje żadnego wpisu`.

### 2. Nieograniczona pamięć logów
**Ryzyko:** gra trwa kilkanaście minut i generuje setki wpisów. Lista bez limitu rosłaby przez cały czas działania aplikacji.
**Zabezpieczenie:** bufor cykliczny o stałym rozmiarze (domyślnie 500). Najstarsze wpisy są nadpisywane, a kolejność się zachowuje.
**Test:** `log-test.ts › bufor trzyma tylko ostatnie wpisy, w kolejności`.

### 3. Logi trzymają w pamięci cały stan gry
**Ryzyko:** gdyby do logu trafiał obiekt `GameState`, bufor przechowywałby 500 kopii stanu (talia pytań, lista zdarzeń).
**Zabezpieczenie:** do logu przekazujemy tylko małe dane: id graczy, etap, czasy, liczby. Wpis kopiuje dane płytko.
**Test:** przegląd kodu. Wywołania `log.*` w `SoloController` przekazują tylko wartości proste.

### 4. Błąd w logowaniu wywraca grę
**Ryzyko:** `console` albo własne wyjście logów rzuci wyjątek, np. przy obiekcie z cyklem w `JSON.stringify`. Wtedy wyjątek z logowania przerwałby ruch gracza.
**Zabezpieczenie:** wywołanie wyjścia jest w `try/catch`, a formatowanie danych ma zabezpieczenie przed cyklami.
**Test:** `log-test.ts › błąd w wyjściu logów nie przerywa programu`, `log-test.ts › dane z cyklem da się sformatować`.

### 5. Za dużo logów w konsoli i w testach
**Ryzyko:** logi `debug` z każdej akcji zaśmiecą wyjście Jesta i konsolę Metro. W wersji produkcyjnej niepotrzebnie spowolnią aplikację.
**Zabezpieczenie:** w testach (`NODE_ENV=test`) logi nie trafiają do konsoli, tylko do bufora. W wersji deweloperskiej minimalny poziom to `debug`, w produkcyjnej `info`. Poziom i wyjście można zmienić przez `configureLog`.
**Test:** `log-test.ts › wpisy poniżej minimalnego poziomu są pomijane`, ręcznie: `npm test` nie wypisuje logów.

### 6. `console.warn` / `console.error` zasłonią ekran w Expo Go
**Ryzyko:** w trybie deweloperskim React Native pokazuje ostrzeżenia i błędy z konsoli na ekranie (LogBox). Zwykłe zdarzenia gry, takie jak zignorowane podwójne kliknięcie, zasłaniałyby wtedy grę.
**Zabezpieczenie:** zdarzenia normalnej rozgrywki logujemy na poziomie `debug`/`info`. `warn` i `error` są tylko dla sytuacji, które nie powinny się zdarzyć, np. silnik odrzucił ruch wygenerowany przez sterownik.
**Test:** `integration-test.ts` – w całej grze nie ma wpisów `warn` ani `error`.

### 7. Nie da się odtworzyć gry z telefonu
**Ryzyko:** gra jest losowa, więc błąd zauważony na telefonie trudno powtórzyć.
**Zabezpieczenie:** przy starcie gry logujemy ziarno generatora (`seed`), poziom trudności i skład graczy. Ta sama wartość ziarna daje identyczną grę (7.1 w dokumentacji postępów).
**Test:** `integration-test.ts › to samo ziarno daje identyczny przebieg całej gry`.
