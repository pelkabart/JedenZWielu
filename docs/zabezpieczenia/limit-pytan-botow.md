# Limit pytań bez udziału gracza

Funkcjonalność: najwyżej 2 pytania z rzędu mogą trafić do botów, a następne wskazanie bota musi paść na gracza. Silnik liczy serię (`PotatoState.questionsWithoutHuman`, zmieniane w `hand()`), a decyzję podejmuje bot (`pickTarget` w `src/game/potato/bots.ts`, stała `MAX_QUESTIONS_WITHOUT_HUMAN`).

## Ryzyka

### 1. Któraś droga przekazania pomija licznik
- **Ryzyko:** licznik zmieniany osobno przy każdej akcji łatwo pominąć, np. przy odbiciu w ciemno albo zmianie rundy, i seria byłaby liczona źle.
- **Zabezpieczenie:** licznik zmienia się tylko w `hand()`, przez który przechodzi każde rozdanie pytania.
- **Test:** `potato-test.ts` › „licznik pytań bez gracza”.

### 2. Bot po błędzie omija limit
- **Ryzyko:** po błędzie bota ziemniak trafia do dowolnego aktywnego gracza (`fromId = null`), także do tego samego bota, więc seria mogłaby rosnąć dalej.
- **Zabezpieczenie:** wymuszenie jest w `pickTarget`, przez który przechodzą oba przypadki w `chooseNext`.
- **Test:** `potato-test.ts` › „przy limicie zawsze wskazuje gracza”; `controller-test.ts` › „trzecie pytanie trafia do gracza po błędzie bota”.

### 3. Zmiana rundy kasuje serię
- **Ryzyko:** po przejściu do nowej rundy boty dostają kolejne 2 pytania, choć gracz i tak długo czekał.
- **Zabezpieczenie:** zmiana rundy nie zeruje licznika.
- **Test:** `potato-test.ts` › „licznik pytań bez gracza” (zmiana rundy nie zeruje).

### 4. Wymuszenie wskazuje gracza, który odpadł
- **Ryzyko:** silnik odrzuca ruch na odpadniętego gracza i gra się zacina.
- **Zabezpieczenie:** człowieka szukamy wśród `candidates`, czyli aktywnych. Gdy go tam nie ma, działa zwykły wybór 60/40.
- **Test:** `potato-test.ts` › „bez aktywnego gracza limit nie blokuje wyboru”.

### 5. Koniec sprintu przekracza limit
- **Ryzyko:** `finishSprint` daje pierwsze pytanie finału zwycięzcy sprintu z pominięciem `pickTarget`. Jeśli wygra bot przy serii 2, to 3. pytanie bez gracza.
- **Zabezpieczenie:** świadomy wyjątek: prawo pierwszego ataku zostaje, a licznika nie zerujemy, więc ten bot musi potem wskazać gracza. Maksimum to 3 pytania i tylko w tym momencie.
- **Test:** `potato-test.ts` › „koniec sprintu nie zeruje serii”; `integration-test.ts` › „boty nie grają między sobą dłużej niż pozwala limit”.

### 6. Limit działa w teście na jednym przebiegu, a w prawdziwej grze nie
- **Ryzyko:** pojedyncze scenariusze nie pokażą rzadkiego układu, np. odpadnięcia bota tuż przy limicie.
- **Zabezpieczenie:** test integracyjny śledzi każde rozdane pytanie w całych grach na prawdziwej bazie i botach, dla wielu ziaren i poziomów.
- **Test:** `integration-test.ts` › „boty nie grają między sobą dłużej niż pozwala limit”.
