# Poprawki rozgrywki po testach na telefonie

Funkcjonalność: plansza rundy czeka na gracza i można nią przerwać lektora, zegar sprintu rusza dopiero po niej, w finale jest 5 s na decyzję, jest przycisk pauzy, mnożnik jest pokazany na środku z animacją, a pierwsza runda zaczyna się od gracza. Do tego błędy przebiegu gry znalezione przy analizie sterownika.

## Ryzyka

### 1. Plansza rundy zatrzymuje grę na zawsze
- **Ryzyko:** plansza nie ma już automatycznego przejścia, więc błąd w przycisku albo wznowienie po `stop` zostawiłyby grę na planszy.
- **Zabezpieczenie:** `acceptRound` działa w każdej chwili, także gdy lektor mówi, i nie zależy od zegara. Po `stop` i `start` plansza dalej czeka na ten sam przycisk.
- **Test:** `controller-test.ts` › „plansza rundy”; `integration-test.ts` › „gracz bez błędów wygrywa…” (cała gra przez wszystkie plansze).

### 2. Podwójne dotknięcie „Gramy!” uruchamia dwie tury
- **Ryzyko:** drugi `acceptRound` startuje drugą turę albo drugi zegar sprintu.
- **Zabezpieczenie:** `acceptRound` działa tylko wtedy, gdy widać planszę, a pierwsze wywołanie ją zdejmuje.
- **Test:** `controller-test.ts` › „drugie dotknięcie nic nie robi”.

### 3. Przerwany lektor blokuje liczniki albo mówi dalej
- **Ryzyko:** po pominięciu planszy kończy się stara wypowiedź i zgłasza ciszę, choć lektor czyta już pytanie, więc licznik startuje za wcześnie.
- **Zabezpieczenie:** nową kwestię narrator zaczyna od zatrzymania poprzedniej, a koniec starej wypowiedzi jest ignorowany (numer wypowiedzi).
- **Test:** `potato-narrator-test.ts` › „pominięcie planszy przerywa lektora i czyta pytanie”; `narration-integration-test.ts` › „pominięcie planszy”.

### 4. Zegar sprintu rusza przed planszą albo w czasie pauzy
- **Ryzyko:** wejście do sprintu, pauza albo synchronizacja zegara uruchamia odliczanie, zanim gracz zamknie planszę. To się naprawdę zdarzyło (dokumentacja postępów, 7.61).
- **Zabezpieczenie:** znacznik `sprintStarted` ustawia dopiero `acceptRound`. Bez niego `syncSprint`, `unpause` i `start` nie ruszają zegara, a `sprintEndsAt` zostaje `null`.
- **Test:** `controller-test.ts` › „sprint liczy czas dopiero po zamknięciu planszy”, „pauza na planszy sprintu nie uruchamia zegara”.

### 5. Punkt przepada, gdy sprint kończy się w trakcie wskazywania
- **Ryzyko:** gracz odpowiedział dobrze i wskazuje rywala, a w tym czasie mija czas sprintu. Gdyby punkt liczył się dopiero po wskazaniu, by przepadł.
- **Zabezpieczenie:** punkt jest przyznawany razem z wynikiem (`award`), więc koniec sprintu odbiera tylko samo wskazanie.
- **Test:** `controller-test.ts` › „koniec sprintu w czasie wskazywania zalicza punkt”.

### 6. Kara w sprincie nie skraca zegara
- **Ryzyko:** silnik odejmuje 1 s, ale zaplanowany koniec zostaje stary, więc sprint trwa dłużej, niż pokazuje pasek. Wskazanie bez synchronizacji cofa też pasek. To się naprawdę zdarzyło (7.62).
- **Zabezpieczenie:** każda zmiana stanu sprintu planuje koniec od nowa (`setGame`), a `pick` najpierw synchronizuje zegar.
- **Test:** `controller-test.ts` › „kara przesuwa koniec sprintu”.

### 7. Odpowiedź trafia na pytanie z następnej rundy
- **Ryzyko:** synchronizacja zegara w `answerBy` kończy sprint i rozdaje pytanie finału. Gdy dostaje je ten sam gracz, stara odpowiedź jest oceniana na nowym pytaniu. To się naprawdę zdarzyło (7.62).
- **Zabezpieczenie:** `answerBy` wychodzi, gdy synchronizacja zmieniła rundę.
- **Test:** `controller-test.ts` › „odpowiedź spóźniona względem końca sprintu nie liczy się w finale”.

### 8. Czas w finale kończy się bez reakcji, a pytanie bierze sam gracz
- **Ryzyko:** po 10 s bez wyboru losowanie mogło wskazać samego gracza, a na ekranie nie było widać odliczania. Wyglądało to tak, jakby nowe pytanie pojawiało się bez powodu.
- **Zabezpieczenie:** w finale jest 5 s (`DUEL_PICK_TIMEOUT_MS`), duży licznik na ekranie, a po czasie odpowiada zawsze losowy rywal. Sam gracz może wziąć pytanie tylko przyciskiem.
- **Test:** `controller-test.ts` › „finał: 5 s na decyzję, potem losowy rywal”, „finał: »na siebie« nadal działa”; `gameDisplay-test.ts`.

### 9. Pauza nie zatrzymuje całej gry
- **Ryzyko:** pasek czasu animuje się dalej, gracz odpowiada mimo pauzy albo zatrzymana gra czyta pytanie do końca.
- **Zabezpieczenie:** `paused` z widoku trafia do pasków i panelu odpowiedzi, sterownik odrzuca ruchy w pauzie, a narrator wstrzymuje głos.
- **Test:** `controller-test.ts` › „w pauzie sterownik nie przyjmuje ruchów”; `potato-narrator-test.ts` › „pauza wstrzymuje głos…”.

### 10. Pauza jako ściąga
- **Ryzyko:** gracz pauzuje i bez limitu czasu szuka odpowiedzi na widoczne pytanie.
- **Zabezpieczenie:** ekran pauzy jest nieprzezroczysty i zasłania pytanie.
- **Test:** ręcznie na telefonie.

### 11. Telefon wygaszony albo aplikacja w tle
- **Ryzyko:** gra w tle dalej odlicza, a muzyka gra poza aplikacją.
- **Zabezpieczenie:** zmiana `AppState` na inną niż `active` włącza pauzę i zatrzymuje muzykę. Po powrocie gracz widzi ekran pauzy.
- **Test:** ręcznie na telefonie; sama pauza: `controller-test.ts`.

### 12. Pauza po końcu gry
- **Ryzyko:** pauza na ekranie wyników zostawia grę z ekranem pauzy nad wynikami.
- **Zabezpieczenie:** `pause` nic nie robi po zakończeniu gry.
- **Test:** `controller-test.ts` › „po końcu gry pauza nic nie robi”.

### 13. Następne pytanie widać przed czasem
- **Ryzyko:** silnik rozdaje pytanie już przy zatwierdzeniu odpowiedzi, więc w czasie wyniku i planszy było widać kolejne pytanie. Gracz miał dodatkowy czas na namysł, a na planszy czekającej na dotknięcie byłby to czas bez limitu. To się naprawdę zdarzyło (7.63).
- **Zabezpieczenie:** wynik niesie pytanie, na które odpowiadano (`overlay.question`). Ekran pokazuje je w czasie wyniku, a w czasie planszy nie pokazuje żadnego.
- **Test:** `controller-test.ts` › „wynik pokazuje pytanie, na które odpowiadano”; `gameDisplay-test.ts`.

### 14. Lektor mówi przez ułamek sekundy i się urywa
- **Ryzyko:** stan z nowym pytaniem pojawia się przed planszą, lektor zaczyna je czytać i od razu przerywa. To samo przy końcu sprintu.
- **Zabezpieczenie:** stan gry i plansza zmieniają się w jednej aktualizacji widoku.
- **Test:** `potato-narrator-test.ts` › „nowa gra zaczyna od planszy, bez czytania pytania”; `controller-test.ts` › „koniec sprintu od razu pokazuje planszę”.

### 15. Gra czeka, aż lektor dokończy zbędne zdanie
- **Ryzyko:** gracz wskazał rywala od razu, a gra czeka, aż wybrzmi „Komu przekazujesz pytanie?”.
- **Zabezpieczenie:** wskazanie od razu zaczyna następną turę, a nowa kwestia przerywa poprzednią.
- **Test:** `potato-narrator-test.ts` › „wskazanie w trakcie pytania o gracza przerywa lektora”.

### 16. Mikrofon słyszy lektora
- **Ryzyko:** przy odpowiedzi głosem rozpoznawanie mowy łapie czytane pytanie.
- **Zabezpieczenie:** panel odpowiedzi zgłasza słuchanie, a narrator wtedy milknie (`silence`).
- **Test:** `potato-narrator-test.ts` › „silence ucisza lektora i zwalnia licznik”.

### 17. Wznowienie po `stop` gubi planszę rundy
- **Ryzyko:** wynik kończący rundę po `start` nie widzi zmiany rundy, plansza się nie pokazuje, a sprint nigdy nie uruchamia zegara.
- **Zabezpieczenie:** runda sprzed wyniku jest zapamiętana w sterowniku (`revealFrom`).
- **Test:** `controller-test.ts` › „wznowienie w czasie wyniku nadal pokazuje planszę nowej rundy”.

### 18. Tryb odbicia w ciemno przechodzi na kolejną turę
- **Ryzyko:** gracz włącza tryb, mija czas, a przy następnym pytaniu tryb nadal działa i dotknięcie pulpitu odbija pytanie.
- **Zabezpieczenie:** tryb jest związany z numerem pytania (`game.cursor`), więc przy nowym pytaniu sam wygasa.
- **Test:** `gameDisplay-test.ts` › „tryb odbicia dotyczy tylko pytania, przy którym go włączono”.

### 19. Animacja mnożnika przeszkadza w grze
- **Ryzyko:** duża liczba na środku zasłania pytanie albo przechwytuje dotknięcia.
- **Zabezpieczenie:** duży napis znika po chwili i ma `pointerEvents="none"`. Stały znacznik jest w pustym środku górnego paska.
- **Test:** ręcznie na telefonie; kolory i tekst: `gameDisplay-test.ts`.

### 20. Pierwsza runda bez gracza
- **Ryzyko:** gra bez człowieka (np. w testach) nie miałaby kogo wskazać i rzuciłaby błąd.
- **Zabezpieczenie:** gdy nie ma człowieka, startuje losowy gracz, jak dotąd.
- **Test:** `controller-test.ts` › „pierwsza runda zaczyna się od gracza”, „gra bez człowieka nadal startuje”.

### 21. Punkt liczy się dwa razy albo wcale
- **Ryzyko:** po rozdzieleniu nagrody i przekazania pytania punkt albo mnożnik dolicza się przy obu krokach, albo przepada po upływie czasu na wskazanie. Pierwotny błąd: punkty i mnożnik zmieniały się dopiero po wskazaniu (dokumentacja postępów, 7.66).
- **Zabezpieczenie:** nagroda jest w jednej funkcji silnika (`reward`). Akcja `award` ustawia znacznik `awarded`, który blokuje drugą nagrodę i odpowiedź na to samo pytanie, a `pass` niczego nie nagradza.
- **Test:** `potato-test.ts` › „nagroda przed przekazaniem pytania”; `controller-test.ts` › „nagroda od razu po dobrej odpowiedzi”, „koniec sprintu w czasie wskazywania zalicza punkt”.

### 22. Dwie drogi odpowiedzi dają różne wyniki
- **Ryzyko:** bot odpowiada jednym krokiem, a człowiek dwoma, więc zasady mogłyby się rozjechać.
- **Zabezpieczenie:** obie drogi używają `reward` i `hand`.
- **Test:** `potato-test.ts` › „atomowa odpowiedź daje tę samą nagrodę co award i pass”.

### 23. Szybszy lektor w złym miejscu
- **Ryzyko:** zasady sprintu są czytane za szybko albo tempo zostaje podniesione w kolejnych rundach.
- **Zabezpieczenie:** tempo wylicza `speechSpeedFor` przy każdej wypowiedzi: 1,25 tylko w sprincie, poza planszą.
- **Test:** `potato-narrator-test.ts` › „tempo lektora”. Brzmienie: do odsłuchania na telefonie.

### 24. Zła kolejność po dobrej odpowiedzi
- **Ryzyko:** zielony dymek z odpowiedzią pojawiał się dopiero po wskazaniu, a pytanie wisiało na ekranie w trakcie wyboru. To się naprawdę zdarzyło (7.66).
- **Zabezpieczenie:** kolejność to wynik (dymek, pochwała, nagroda), potem wskazywanie bez pytania, potem od razu następna tura. Wskazywanie zaczyna dopiero `afterReveal`, a licznik czeka na ciszę lektora.
- **Test:** `controller-test.ts` › „kolejność: wynik, potem wskazywanie bez wyniku, potem następna tura”, „wynik czeka na lektora…”; `potato-narrator-test.ts` › „po poprawnej odpowiedzi najpierw pochwała, potem wskazanie, bez powtórki”; `gameDisplay-test.ts` › „przy wskazywaniu gracza pytanie znika”.
