# Tabela wyników, punkty w finale i limit mnożnika

Funkcjonalność: na końcu gry zamiast jednej linijki z imionami jest tabela wyników (miejsca, postacie, błędy, punkty, animowane odsłanianie). Dobra odpowiedź w finale daje 10 punktów zamiast 1. Mnożnik w rundzie 2 rośnie najwyżej do ×3.

## Ryzyka

### 1. Mnożnik przekracza ×3
- **Ryzyko:** silnik ma dwie drogi nagrody (`answer` botów i `award` gracza). Limit tylko na jednej zostawiłby mnożnik bez ograniczenia na drugiej.
- **Zabezpieczenie:** obie drogi przechodzą przez `reward`, a limit to jedna stała `POTATO.maxMultiplier`.
- **Test:** `potato-test.ts` › „mnożnik zatrzymuje się na ×3 przy obu drogach nagrody”; `integration-test.ts` › „mnożnik nigdy nie przekracza limitu”.

### 2. Mnożnik na limicie psuje wybuch
- **Ryzyko:** po dobrej odpowiedzi przy ×3 mnożnik się nie zmienia, więc mógłby się nie zresetować po błędzie albo odjąć zbyt dużo osłony.
- **Zabezpieczenie:** wybuch dalej odejmuje aktualny mnożnik i wraca do ×1. Napis na środku ekranu reaguje tylko na zmianę, więc przy ×3 nie miga bez powodu.
- **Test:** `potato-test.ts` › „wybuch przy ×3 zabiera całą osłonę i wraca do ×1”.

### 3. Finał i sprint liczą punkty tak samo
- **Ryzyko:** zmiana wartości punktu w `reward` podniosłaby też punkty sprintu, a od nich zależą szanse w finale.
- **Zabezpieczenie:** osobne wartości `POTATO.sprintPoints` (1) i `POTATO.duelPoints` (10).
- **Test:** `potato-test.ts` › „dobra odpowiedź daje punkt i rotuje ziemniak”, „poprawna odpowiedź w finale daje 10 punktów, bez odzyskiwania szans”.

### 4. Punkty przyznane podwójnie przy wskazywaniu
- **Ryzyko:** `award` i późniejszy `pass` naliczyłyby 20 punktów zamiast 10.
- **Zabezpieczenie:** punkty nalicza tylko `reward`, a `pass` go nie wywołuje.
- **Test:** `potato-test.ts` › „przekazanie nie nagradza drugi raz”; `controller-test.ts` › „punkt razem z wynikiem, a wskazanie go nie zmienia”.

### 5. Tabela sortowana po punktach pokazuje innego zwycięzcę
- **Ryzyko:** finał wygrywa ostatni gracz w grze, a nie ten z największą liczbą punktów. Tabela sortowana po punktach pokazałaby na 1. miejscu kogoś innego, niż ogłosił lektor.
- **Zabezpieczenie:** kolejność bierzemy z `game.ranking`. Gdy gracz niżej ma więcej punktów niż gracz nad nim, tabela dopisuje wyjaśnienie.
- **Test:** `scoreboardData-test.ts` › „kolejność idzie za rankingiem, a nie za punktami”, „wyjaśnia, gdy zwycięzca ma mniej punktów”; `integration-test.ts` › „tabela zgadza się z rankingiem”.

### 6. Tabela ogłasza zwycięzcę, choć gra skończyła się wcześniej
- **Ryzyko:** gdy odpada człowiek, zostaje kilku aktywnych botów i nikt nie wygrał, więc „Wygrywa…” byłoby nieprawdą.
- **Zabezpieczenie:** `scoreboardHeadline` sprawdza `endedEarly`. Wtedy pokazuje postać gracza, „Odpadasz!” i jego miejsce, a w wierszach nie ma zwycięzcy.
- **Test:** `scoreboardData-test.ts` › „gra przerwana: bez zwycięzcy”; `integration-test.ts` › „tabela zgadza się z rankingiem po odpadnięciu gracza”.

### 7. Tabela nie mieści się na niskim ekranie
- **Ryzyko:** gra działa w poziomie, a przy wysokości ok. 360 pięć wierszy i przyciski mogłyby wyjść poza ekran i zasłonić „Zagraj ponownie”.
- **Zabezpieczenie:** wysokość wiersza wynika z wysokości ekranu (`scoreboardRowHeight`).
- **Test:** `scoreboardData-test.ts` › „wiersze mieszczą się na niskim ekranie”; zrzuty z tymczasowej wersji webowej (844×390 i 640×360).

### 8. Brak skórki albo nieznany gracz w rankingu wywraca ekran
- **Ryzyko:** `skins` może nie mieć postaci (`null`), a id z rankingu mogłoby nie pasować do gracza.
- **Zabezpieczenie:** bez skórki rysujemy kółko z inicjałem w kolorze miejsca przy stole. Nieznane id jest pomijane, a miejsca liczone po filtrowaniu.
- **Test:** `scoreboardData-test.ts` › „pomija nieznane id i numeruje miejsca bez dziur”.

### 9. Ekran wyników zapisuje za dużo w logach
- **Ryzyko:** efekt uruchamiany przy każdym renderze powtarzałby wpis albo logował cały stan.
- **Zabezpieczenie:** jeden wpis `info` przy pokazaniu tabeli, tylko id i liczby.
- **Test:** przegląd kodu (`Scoreboard.tsx`); logi całej gry sprawdza `integration-test.ts` › „logi nie zawierają całego stanu gry”.
