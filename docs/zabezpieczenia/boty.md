# Boty

Moduły: `src/game/bots/brain.ts`, `src/game/bots/profiles.ts`
Testy: `src/game/__tests__/bots-test.ts`, `simulate-test.ts`, `integration-test.ts`
Logi: `[sterownik] Bot odpowie` (czas, czy w ogóle odpowie), `[sterownik] Okno zgłoszeń` (najszybszy bot w finale).

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Bezsensowne pomyłki
**Ryzyko:** na pytanie o króla bot odpowiada „1918”.
**Zabezpieczenie:** pole `answerType` i pomyłki w obrębie tego samego rodzaju. Jeśli nic nie pasuje, bot nie odpowiada.
**Test:** `bots-test.ts › na pytanie o osobę, miejsce lub nazwę nigdy nie podaje liczby ani innego rodzaju odpowiedzi`, `gdy nie ma pasującej pomyłki, bot nie odpowiada zamiast podać coś bez sensu`.

### 2. Pomyłka bota jest przypadkiem poprawna
**Ryzyko:** wylosowana „błędna” odpowiedź mogłaby przejść przez sprawdzanie i dać botowi punkt, który nie powinien mu się należeć.
**Zabezpieczenie:** pomyłki są sprawdzane `isCorrectAnswer` przed użyciem.
**Test:** `bots-test.ts › pomyłki nigdy nie są przypadkiem poprawne, a odpowiedzi mieszczą się w czasie`.

### 3. Bot odpowiada po czasie
**Ryzyko:** opóźnienie bota większe niż 15 s rozjechałoby licznik na ekranie.
**Zabezpieczenie:** opóźnienia są przycięte do czasu na odpowiedź, a sterownik i tak odpala ruch najpóźniej po `answerTimeMs`.
**Test:** `bots-test.ts › pomyłki nigdy nie są przypadkiem poprawne, a odpowiedzi mieszczą się w czasie`, `bots-test.ts › zgłasza się tylko w oknie czasowym`.

### 4. Bot zgłasza się w finale „na ślepo”
**Ryzyko:** decyzja o zgłoszeniu i o poprawności losowane osobno, więc bot zgłaszał się, a potem nie wiedział.
**Zabezpieczenie:** poprawność jest losowana w chwili zgłoszenia, a sterownik przechowuje przygotowaną odpowiedź (`prepared`).
**Test:** `bots-test.ts › częściej zgłasza się, gdy zna odpowiedź`.

### 5. Testy statystyczne raz przechodzą, raz nie
**Ryzyko:** właściwości botów (np. ekspert wie więcej) da się sprawdzić tylko na wielu próbach.
**Zabezpieczenie:** stałe ziarna i 2000–3000 prób z tolerancją.
**Test:** `bots-test.ts › ekspert odpowiada poprawnie częściej niż bot na łatwym poziomie`.

### 6. Bot wskazuje niedozwolonego gracza
**Ryzyko:** bot wskazuje siebie, odpadłego gracza albo nie człowieka, gdy reguła limitu tego wymaga. Silnik rzuciłby wtedy wyjątkiem w trakcie gry.
**Zabezpieczenie:** bot wybiera tylko spośród `pickTargets` (tej samej funkcji, której używa silnik).
**Test:** `bots-test.ts › w etapie II nigdy nie wskazuje siebie ani odpadłych`, `integration-test.ts` (brak wpisów `error` w całej grze).
