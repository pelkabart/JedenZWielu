# Rundy „Gorący Ziemniak” (solo, rundy 1–4)

Funkcjonalność: nowy przebieg rozgrywki z PDF „Quiz Frenzy”. Runda 1 (odsiew 5 → 4, ziemniak, 3 życia), runda 2 (bomba z mnożnikiem, 4 → 3, 3 punkty osłony), runda 3 (sprint 60 s bez eliminacji, nagrody 3/2/1 szanse), runda 4 (finałowy krąg 3 → mistrz).

Silnik jest czysty (`src/game/potato/engine.ts`): nie losuje i nie loguje. Losowe decyzje (startowy posiadacz ziemniaka, pomyłki botów, kto dostaje ziemniak po błędzie) podaje wywołujący w akcji. Tak samo jak w `engine.ts` stare.

## Ryzyka

### 1. Gracz odpada w rundzie 1, a runda 2 startuje z niewłaściwą liczbą graczy
- **Ryzyko:** po pierwszym odpadnięciu (0 życia) gra zostaje w rundzie 1 albo przechodzi do rundy 2 z pominiętym graczem.
- **Zabezpieczenie:** odpadnięcie w rundzie 1 od razu przenosi grę do rundy 2 z wszystkimi aktywnymi graczami i 3 punktami osłony.
- **Test:** `potato-test.ts` › „odpadnięcie w rundzie 1 przechodzi do rundy 2 z 4 graczami”.

### 2. Wskazanie odpadniętego gracza
- **Ryzyko:** ziemniak albo bomba trafia do gracza, który już odpadł, i gra utyka.
- **Zabezpieczenie:** każde przekazanie sprawdza, że cel jest aktywny (`requireActive`); po cięciu w finale, które może wyeliminować rywali, sprawdzenie jest po zmianach.
- **Test:** `potato-test.ts` › „nie można przekazać odpadniętemu”.

### 3. Bez „odbicia w ciemno” ktoś dostaje drugą szansę
- **Ryzyko:** gracz użyje odbicia więcej niż raz albo odbicie kosztuje życie.
- **Zabezpieczenie:** znacznik `blindPassUsed` na gracza; odbicie nie zmienia życia.
- **Test:** `potato-test.ts` › „odbicie w ciemno: raz, bez utraty życia”.

### 4. Mnożnik i wybuch bomby
- **Ryzyko:** wybuch odejmuje za dużo albo za mało punktów osłony, a mnożnik nie wraca do ×1.
- **Zabezpieczenie:** wybuch odejmuje aktualny mnożnik (nie mniej niż 0), mnożnik wraca do ×1, a odpadnięcie następuje przy 0 osłony.
- **Test:** `potato-test.ts` › „wybuch odejmuje mnożnik i resetuje go”; „0 osłony oznacza odpadnięcie i sprint”.

### 5. Sprint kończy się zbyt późno albo zbyt wcześnie
- **Ryzyko:** czas nie liczy się w dół, kara −1 s nie działa albo sprint trwa dalej po 0.
- **Zabezpieczenie:** czas to wejście `tick` (ms) od wywołującego; kara −1 s za błąd lub brak odpowiedzi; przy 0 sprint kończy się natychmiast.
- **Test:** `potato-test.ts` › „sprint: punkt za dobrą odpowiedź, −1 s za złą, koniec przy 0”.

### 6. Nagrody sprintu nie trafiają do rundy 4
- **Ryzyko:** szanse z nagród nie są ustawione albo pierwszy gracz nie ma prawa pierwszego ataku.
- **Zabezpieczenie:** przy zakończeniu sprintu życia ustawiane są na 3/2/1 wg miejsca (`POTATO.awards`), a ziemniak dostaje zwycięzca sprintu.
- **Test:** `potato-test.ts` › „koniec sprintu: 3/2/1 szanse i prawo pierwszego ataku”.

### 7. Remis w sprincie
- **Ryzyko:** ten sam wynik punktowy daje niedeterministyczny ranking.
- **Zabezpieczenie:** przy równych punktach wygrywa mniej błędów, potem miejsce przy stole (`seat`). Zasada zapisana w dokumencie.
- **Test:** `potato-test.ts` › „remis punktów rozstrzyga błędy, potem miejsce”.

### 8. Cios w finale eliminuje za dużo
- **Ryzyko:** poprawna odpowiedź w rundzie 4 zabiera rywalom życia w złej kolejności albo eliminuje też samego odpowiadającego.
- **Zabezpieczenie:** odpowiadający dostaje +1 życie (max 3), każdy rywal −1; eliminacja w kolejności miejsc; odpowiadający nie może odpaść od własnego ciosu.
- **Test:** `potato-test.ts` › „poprawna odpowiedź w finale: +1 dla siebie, −1 dla rywali”.

### 9. Zwycięzca nie zostaje wyłoniony
- **Ryzyko:** gra kończy się bez zwycięzcy albo z dwoma aktywnymi graczami.
- **Zabezpieczenie:** koniec, gdy zostaje jeden aktywny gracz; ranking: zwycięzca, potem odpadający w odwrotnej kolejności.
- **Test:** `potato-test.ts` › „ostatni aktywny gracz wygrywa, ranking zaczyna od zwycięzcy”.

### 10. Boty wybierają cel źle
- **Ryzyko:** bot wskazuje siebie albo odpadniętego, albo zawsze tego samego gracza.
- **Zabezpieczenie:** `pickTarget` losuje wyłącznie z aktywnych innych (lub wszystkich aktywnych przy resecie), priorytet lider 60% / rywal o najmniejszym zasobie 40%, z awaryjnym losowaniem.
- **Test:** `potato-test.ts` › „bot wybiera tylko aktywnych rywali”.
