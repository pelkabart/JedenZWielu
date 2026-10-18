# Symulator gier

Moduł: `src/game/simulate.ts`
Testy: `src/game/__tests__/simulate-test.ts`, `src/game/__tests__/controller-test.ts` (przewijanie)
Logi: `[symulator] Symulacja przekroczyła limit kroków` (`error`). Pojedynczych gier nie logujemy, bo testy rozgrywają ich 900.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Symulacja się zawiesza
**Ryzyko:** błąd w silniku, przez który gra się nie kończy, zawiesiłby testy.
**Zabezpieczenie:** limit 10 000 kroków. Po jego przekroczeniu symulator zapisuje błąd w logach i rzuca wyjątek.
**Test:** w 900 symulowanych grach limit nie został przekroczony (`simulate-test.ts`).

### 2. Zły pomiar balansu
**Ryzyko:** poziom trudności wzmacniał też „przeciętnego gracza” zastępującego człowieka, więc wyniki balansu nie miały sensu.
**Zabezpieczenie:** zastępca człowieka zawsze gra na poziomie `normal`.
**Test:** `simulate-test.ts › przeciętny gracz wygrywa tym rzadziej, im wyższy poziom`.

### 3. Symulacja nie sprawdza niczego poza tym, że gra się kończy
**Ryzyko:** gra może się kończyć, a mimo to łamać zasady.
**Zabezpieczenie:** po każdej grze sprawdzamy własności: ranking, 3 finalistów, limity szans i pytań, jedno pytanie na gracza w etapie I, brak wskazań siebie, regułę limitu.
**Test:** `simulate-test.ts › symulacja pełnych gier (…)` (6 testów na każdy poziom).

### 4. Przewinięcie gry zostawia działające liczniki
**Ryzyko:** po „Pomiń do wyników” stary licznik sterownika odpaliłby ruch w zakończonej grze.
**Zabezpieczenie:** `fastForward` czyści licznik przed uruchomieniem symulatora.
**Test:** `controller-test.ts › po odpadnięciu człowieka można przewinąć grę do końca`, `integration-test.ts › gracz, który nie odpowiada, odpada, a po przewinięciu gra kończy się bez wiszących liczników`.
