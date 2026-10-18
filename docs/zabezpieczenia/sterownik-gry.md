# Sterownik gry

Moduł: `src/game/controller/SoloController.ts`
Testy: `src/game/__tests__/controller-test.ts`, `view-test.ts`, `integration-test.ts`
Logi: `[sterownik]` – start, pauza i wznowienie (z pozostałym czasem), każdy ruch i zdarzenie silnika, koniec czasu, decyzje botów, zignorowane ruchy gracza.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Wyścig: odpowiedź w chwili końca czasu albo podwójne „OK”
**Ryzyko:** dwie odpowiedzi na jedno pytanie albo odpowiedź po czasie w następnym pytaniu.
**Zabezpieczenie:** ruch gracza jest przyjmowany tylko wtedy, gdy gra na niego czeka. Inne ruchy są ignorowane i zapisywane w logach (`Zignorowano ruch gracza`).
**Test:** `controller-test.ts › odpowiedź po czasie jest ignorowana (wyścig z licznikiem)`, `podwójne zatwierdzenie liczy się tylko raz`, `licznik nie odpala się po odpowiedzi`, `integration-test.ts › podwójne zatwierdzenie odpowiedzi liczy się raz i jest zapisane jako zignorowane`.

### 2. Testy w prawdziwym czasie trwałyby kilkanaście minut
**Ryzyko:** bez kontroli nad czasem sterownika nie da się sensownie testować.
**Zabezpieczenie:** zegar jest wstrzykiwany (`Clock`), więc testy używają udawanego zegara Jesta.
**Test:** cały `controller-test.ts` i `integration-test.ts`.

### 3. Pokazywanie następnego pytania zamiast tego, na które odpowiedziano
**Ryzyko:** silnik od razu losuje kolejne pytanie, więc wynik wyświetlałby się przy złym pytaniu.
**Zabezpieczenie:** nakładka `reveal` przechowuje pytanie, na które padła odpowiedź.
**Test:** `view-test.ts › po odpowiedzi pokazuje pytanie, na które odpowiadano, a nie następne`.

### 4. Pauza gubi albo dokłada czas
**Ryzyko:** okno „Przerwać grę?” i podwójne efekty Reacta (StrictMode) wołają `start`/`pause` wielokrotnie.
**Zabezpieczenie:** `start` i `pause` są idempotentne, a pauza zapamiętuje pozostały czas. Oba zdarzenia są logowane z pozostałym czasem.
**Test:** `controller-test.ts › zatrzymuje licznik i wznawia go z pozostałym czasem`, `wielokrotne start/pause (React StrictMode) nie psuje gry`, `integration-test.ts › pauza i wznowienie są zapisane z pozostałym czasem`.

### 5. Plansza etapu zamknięta przypadkiem
**Ryzyko:** szybkie tapnięcie, które pomija wynik, zamyka też nową planszę z zasadami, zanim gracz ją przeczyta.
**Zabezpieczenie:** przez 0,7 s od pokazania dotyk jest ignorowany (i logowany).
**Test:** `controller-test.ts › dotknięcie tuż po pokazaniu planszy jest ignorowane (żeby nie zamknąć jej przypadkiem)`, `plansza etapu nie znika sama, tylko po dotknięciu`.

### 6. Sterownik wysyła do silnika niedozwolony ruch
**Ryzyko:** błąd w sterowniku albo w botach, który kończy się wyjątkiem w środku gry. Na telefonie nie byłoby wiadomo, co go spowodowało.
**Zabezpieczenie:** `apply` łapie wyjątek silnika, zapisuje w logach akcję i komunikat (`Silnik odrzucił ruch`), po czym rzuca go dalej.
**Test:** `integration-test.ts` – w pełnych grach na wszystkich poziomach nie ma wpisów `error`.

### 7. Wiszące liczniki po zakończeniu gry
**Ryzyko:** licznik odpala ruch w grze, która się skończyła.
**Zabezpieczenie:** każdy nowy licznik czyści poprzedni (`schedule` → `clearTimer`). Ruch jest wykonywany tylko wtedy, gdy stan gry na niego czeka.
**Test:** `integration-test.ts › pełna gra kończy się poprawnie na poziomie …` (`jest.getTimerCount() === 0`).
