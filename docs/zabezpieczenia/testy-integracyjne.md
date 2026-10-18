# Testy integracyjne

Plik: `src/game/__tests__/integration-test.ts`
Uruchomienie: `npm run test:integration` (wszystkie testy: `npm test`)

Testy jednostkowe sprawdzają moduły osobno i często na uproszczonych danych: 12 pytań testowych i bot o stałym czasie odpowiedzi. Testy integracyjne łączą to, czego używa prawdziwa aplikacja (`useSoloController`): prawdziwą bazę pytań z `questions.json`, `createSoloGame` z losowym miejscem gracza, prawdziwe profile botów, `SoloController`, silnik, symulator i logi. Gra toczy się na udawanym zegarze Jesta.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Moduły działają osobno, ale nie razem
**Ryzyko:** testy sterownika używają bota o stałym czasie i małej bazy. Prawdziwe boty mają losowe czasy, czasem nie odpowiadają, a prawdziwa baza ma inne typy odpowiedzi. Takie połączenie mogłoby się zawiesić albo rzucić wyjątkiem.
**Zabezpieczenie:** test rozgrywa całe gry na wszystkich trzech poziomach z dokładnie tymi modułami, które tworzy `useSoloController`.
**Test:** `integration-test.ts › pełna gra kończy się poprawnie na poziomie …` (3 poziomy).

### 2. Test całej gry nigdy się nie kończy
**Ryzyko:** jeśli gra utknie (np. czeka na ruch, którego nikt nie wykona), pętla w teście kręciłaby się bez końca.
**Zabezpieczenie:** pętla ma limit udawanego czasu (2 godziny gry) i rzuca błąd z opisem, na co gra czekała.
**Test:** sam mechanizm `playUntilFinished` w pliku testu.

### 3. Wynik testu zależy od przypadku
**Ryzyko:** prawdziwe boty losują, więc test mógłby raz przechodzić, a raz nie.
**Zabezpieczenie:** stałe ziarna generatora. Przebieg dla tego samego ziarna jest identyczny, co sprawdza osobny test.
**Test:** `integration-test.ts › to samo ziarno daje identyczny przebieg całej gry`.

### 4. Testy integracyjne są za wolne
**Ryzyko:** jedna gra to kilkanaście minut prawdziwego czasu.
**Zabezpieczenie:** udawany zegar Jesta (`jest.useFakeTimers()`), który przesuwamy krokami po 100 ms. Cała gra trwa ułamek sekundy.
**Test:** czas wykonania widoczny w `npm run test:integration`.

### 5. Logi kłamią albo ich brakuje
**Ryzyko:** logi są przydatne tylko wtedy, gdy zgadzają się z tym, co naprawdę zaszło.
**Zabezpieczenie:** testy porównują logi ze stanem gry: kolejność etapów w logach odpowiada przebiegowi gry, każdy upływ czasu człowieka ma wpis, podwójne zatwierdzenie jest zapisane jako zignorowane, a w całej grze nie ma wpisów `warn` ani `error`.
**Test:** `integration-test.ts › logi …`.
