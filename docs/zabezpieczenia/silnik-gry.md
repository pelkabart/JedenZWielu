# Silnik gry

Moduł: `src/game/engine.ts`, zasady: `src/game/rules.ts`
Testy: `src/game/__tests__/engine-test.ts`, `simulate-test.ts`, `integration-test.ts`
Logi: silnik celowo nic nie loguje (czysta funkcja). Jego ruchy i zdarzenia loguje sterownik (`[sterownik] Ruch`, `Etap`, `Gracz odpadł`, `Koniec gry`).

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Losowość sprawia, że błędy nie dają się powtórzyć
**Ryzyko:** kolejność pytań, gracz zaczynający etap II i decyzje botów są losowe, więc test mógł raz przechodzić, a raz nie.
**Zabezpieczenie:** własny generator z ziarnem (`rng.ts`, mulberry32), wstrzykiwany do każdej funkcji, która losuje. Ziarno każdej gry jest w logach (`[gra-solo] Nowa gra`).
**Test:** `engine-test.ts › jest powtarzalna dla tego samego ziarna`, `integration-test.ts › to samo ziarno daje identyczny przebieg całej gry`.

### 2. Zmiana poprzedniego stanu
**Ryzyko:** gdyby `reduce` zmieniał stary stan, React nie zauważyłby zmiany, a symulacje wpływałyby na siebie nawzajem.
**Zabezpieczenie:** `reduce` kopiuje graczy, kolejkę i zdarzenia przed zmianą.
**Test:** `engine-test.ts › nie modyfikuje poprzedniego stanu`.

### 3. Niedozwolony ruch
**Ryzyko:** odpowiedź gracza, który nie jest pytany, wskazanie siebie w etapie II albo zgłoszenie odpadłego gracza mogłyby zepsuć grę.
**Zabezpieczenie:** każda akcja jest sprawdzana, a niedozwolona kończy się wyjątkiem `GameRuleError`. Sterownik loguje taki wyjątek jako `error`.
**Test:** `engine-test.ts › odrzuca odpowiedź gracza, który nie jest pytany`, `odrzuca akcje niepasujące do etapu`, `nie pozwala wskazać siebie, kogoś odpadłego ani wskazywać za kogoś innego`.

### 4. Gra bez końca
**Ryzyko:** w finale ostatni gracz gra „aż straci szanse”, więc gra teoretycznie mogłaby trwać w nieskończoność.
**Zabezpieczenie:** pula 50 pytań w finale. Symulator ma dodatkowo limit 10 000 kroków.
**Test:** `engine-test.ts › kończy się po wyczerpaniu puli pytań`, `nigdy nie zadaje więcej pytań niż wynosi pula`.

### 5. Niejasne zasady etapu II
**Ryzyko:** nie było ustalone, co się dzieje, gdy wskazany gracz się pomyli.
**Zabezpieczenie:** wskazujący wybiera ponownie. Gdy pomyli się gracz pytany z kolei, pytanie przechodzi na następne miejsce. Każda zasada ma test.
**Test:** `engine-test.ts › gdy wskazany się pomyli, wskazujący wybiera ponownie`, `gdy pomyli się gracz pytany z kolei, pytanie przechodzi na następne miejsce`.

### 6. Boty wskazują się nawzajem, pomijając człowieka
**Ryzyko:** zgodne z zasadami, ale gracz długo nic nie robi.
**Zabezpieczenie:** reguła `maxQuestionsWithoutHuman` jest w silniku, a nie tylko w logice botów, żeby nie dało się jej obejść.
**Test:** `engine-test.ts › etap II – limit pytań bez człowieka` (4 testy), `simulate-test.ts › w etapie II bot wskazuje człowieka, gdy ten czekał już 4 pytania`.

### 7. Ujemna liczba szans
**Ryzyko:** odjęcie szansy graczowi, który ma 0, dałoby wartość ujemną i zepsuło ranking.
**Zabezpieczenie:** `loseLife` używa `Math.max(0, …)`.
**Test:** `simulate-test.ts › nikt nie przekracza limitów szans i pytań`.
