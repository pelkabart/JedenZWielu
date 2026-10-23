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

### 8. Poprawna odpowiedź w finale zabiera szanse rywalom
- **Ryzyko (po zmianie):** cios wyeliminował rywali, a gracz chciał, żeby finał był jak w „1 z 10”.
- **Zabezpieczenie:** cios usunięty. Poprawna odpowiedź daje punkt i przywraca 1 szansę (max 3); rywale nic nie tracą. Odpadają tylko przez błędy.
- **Test:** `potato-test.ts` › „poprawna odpowiedź: +1 punkt i +1 szansa dla siebie”; „w finale nikt nie traci szans, bo rywal odpowiedział dobrze”; „błędy odpadają w finale”.

### 8a. (dawny opis ciosu — nieaktualny)
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

## Sterownik rund (`src/game/potato/controller/PotatoController.ts`)

### 11. Dwa kroki gry działają naraz (podwójna tura, podwójna odpowiedź)
- **Ryzyko:** timer tury, nakładka i odpowiedź człowieka odpalają się razem; bot odpowiada dwa razy albo tura przeskakuje.
- **Zabezpieczenie:** jeden slot `timer` na kolejny krok gry (`schedule` i `clearMain` go zastępują); odpowiedź najpierw zdejmuje licznik.
- **Test:** `potato/__tests__/controller-test.ts` › „poprawna odpowiedź czeka na wskazanie rywala, potem przechodzi dalej”; „brak odpowiedzi w czasie liczy się jak błąd”.

### 12. Zegar sprintu rozjeżdża się z karami
- **Ryzyko:** czas liczony na zegarze i kary −1 s w silniku dają podwójne odjęcie albo sprint nie kończy się w 0.
- **Zabezpieczenie:** przed każdą odpowiedzią i po upływie zaplanowanego końca zegar wysyła `tick` z czasem od ostatniej synchronizacji; kary odejmuje silnik, zegar liczy tylko upływ czasu.
- **Test:** `controller-test.ts` › „po upływie czasu sprint kończy się i gracze dostają szanse 3/2/1”; „kara za błąd odejmuje czas od zegara na bieżąco”.

### 13. Człowiek zostaje w zawieszeniu po poprawnej odpowiedzi
- **Ryzyko:** gracz odpowiedział poprawnie, a gra czeka na wskazanie bez końca albo wskazanie przechodzi bez kontroli.
- **Zabezpieczenie:** stan `awaitingPick` z osobą wskazującą; `pick` sprawdza, że cel jest aktywny i nie jest sobą (poza finałem). Czekanie bez limitu jest świadomie zostawione do decyzji o UI.
- **Test:** `controller-test.ts` › „nie można wskazać siebie w rundzie 1”.

### 14. Odrzucony ruch psuje stan
- **Ryzyko:** błąd zasad w silniku zostawia częściowo zmieniony stan albo wywala grę.
- **Zabezpieczenie:** silnik zwraca nowy obiekt albo rzuca `PotatoRuleError`; sterownik łapie go, loguje `warn` i nie zmienia widoku.
- **Test:** pokryte przez testy zasad (`potato-test.ts`); w sterowniku błędy są logowane (`ziemniak`).

### 15. Gracz rozpoznawany po id zamiast po fladze
- **Ryzyko:** stała `HUMAN_ID` z solo nie pasuje do gier wieloosobowych i do gracza o innym id.
- **Zabezpieczenie:** sterownik używa `player.isHuman`; nie ma sztywnego id człowieka.
- **Test:** `controller-test.ts` (gracz o id `h`).

### 16. Gracz wskazuje w nieskończoność
- **Ryzyko:** po poprawnej odpowiedzi gra czeka na wybór rywala bez końca.
- **Zabezpieczenie:** 10 s na wybór (`PICK_TIMEOUT_MS`); po upływie `pickAtRandom` losuje spośród legalnych celów (w finale może być sam odpowiadający).
- **Test:** `potato/__tests__/controller-test.ts` › „bez wyboru w 10 s przekazanie idzie do losowego aktywnego rywala”; „wybór przed upływem 10 s anuluje losowanie”.

### 17. Ekran zostaje z działającymi zegarami po wyjściu
- **Ryzyko:** po zamknięciu ekranu zegary nadal odpalają tury i sprint.
- **Zabezpieczenie:** `controller.stop()` zatrzymuje wszystkie zegary (hook zwraca je w sprzątaniu efektu); `start()` po ponownym uruchomieniu wznawia od bieżącego kroku (`resume`).
- **Test:** ręcznie (wyjście i powrót na ekran); sterownik wznawia tury według stanu.

### 18. Odbicie w ciemno na ekranie zostaje włączone po zmianie tury
- **Ryzyko:** tryb „odbicia” pozostaje aktywny, gdy tura się zmieni, i kliknięcie w pulpit wykonuje przypadkowy ruch.
- **Zabezpieczenie:** tryb działa tylko wtedy, gdy odbicie jest dostępne (`blindOn = blindMode && blindAvailable`), bez efektu do resetowania.
- **Test:** ręcznie w przeglądarce (tryb pokazuje się tylko na turze człowieka w rundzie 1).

### 19. Pauza nie zatrzymuje czasu albo gubi resztę licznika
- **Ryzyko:** w czasie pauzy tura gracza albo sprint dalej odliczają, albo po wznowieniu licznik startuje od zera.
- **Zabezpieczenie:** `pause` zamraża krok (`freezeMain`: zapamiętuje resztę czasu i paska) i sprint (synchronizacja przed zatrzymaniem); `unpause` wznawia z tą resztą.
- **Test:** `potato/__tests__/controller-test.ts` › „pauza zamraża licznik tury, a wznowienie daje resztę czasu”; „pauza zamraża sprint”.

### 20. Licznik startuje, zanim gracz usłyszy pytanie
- **Ryzyko:** gracz traci czas na pytanie, którego lektor jeszcze nie przeczytał.
- **Zabezpieczenie:** kroki z licznikiem czekają na ciszę lektora (`setSpeaking`); pasek startuje dopiero po jej zakończeniu.
- **Test:** `controller-test.ts` › „licznik nie rusza, dopóki lektor mówi; startuje po ciszy”; `narration/__tests__/potato-narrator-test.ts` › „licznik czeka, aż lektor skończy czytać pytanie”.

### 21. Błąd syntezy blokuje grę
- **Ryzyko:** wyjątek lub odrzucona obietnica lektora zostawia grę w miejscu czekania na ciszę.
- **Zabezpieczenie:** narrator łapie błąd, loguje go i zwalnia `setSpeaking(false)`.
- **Test:** `potato-narrator-test.ts` › „błąd syntezy nie blokuje gry”.
