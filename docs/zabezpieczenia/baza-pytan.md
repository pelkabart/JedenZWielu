# Baza pytań

Moduł: `src/game/questions.ts`, dane: `src/data/questions.json`
Testy: `src/game/__tests__/questions-test.ts`, `src/game/__tests__/integration-test.ts`
Logi: `[baza-pytan]` – liczba załadowanych pytań albo opis błędu.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Literówka w bazie psuje grę dopiero w trakcie rozgrywki
**Ryzyko:** zła kategoria, nieznany typ odpowiedzi albo pusta lista odpowiedzi wyszłyby dopiero wtedy, gdy pytanie zostanie wylosowane.
**Zabezpieczenie:** `parseQuestionBank` sprawdza całą bazę przy uruchomieniu i rzuca błąd z numerem pozycji. Błąd trafia też do logów (`Błąd w bazie pytań`).
**Test:** `questions-test.ts › parseQuestionBank` (przypadki `it.each`: brak tablicy, powtórzone id, nieznana kategoria i inne).

### 2. Dwa pytania z tym samym id
**Ryzyko:** silnik i sterownik rozpoznają pytania po `id` (np. przygotowana odpowiedź bota w finale). Duplikat pomieszałby odpowiedzi.
**Zabezpieczenie:** walidacja odrzuca powtórzone id.
**Test:** `questions-test.ts › parseQuestionBank` (przypadek „powtórzone id”).

### 3. „Błędna” odpowiedź dla bota jest w rzeczywistości poprawna
**Ryzyko:** `wrongAnswers` różniące się od poprawnej odpowiedzi jedną literą zostałyby uznane za poprawne, przez co bot „mylący się” zdobywałby punkty.
**Zabezpieczenie:** każda pozycja `wrongAnswers` przechodzi przez `isCorrectAnswer`. Jeśli zostałaby zaakceptowana, baza jest odrzucana.
**Test:** `questions-test.ts › parseQuestionBank`.

### 4. Zapisana poprawna odpowiedź nie przechodzi przez sprawdzanie
**Ryzyko:** gracz wpisuje dokładnie odpowiedź z bazy, a gra uznaje ją za błędną, np. przez interpunkcję.
**Zabezpieczenie:** test przechodzi po całej bazie i sprawdza każdą zapisaną odpowiedź.
**Test:** `questions-test.ts › każda zapisana odpowiedź jest akceptowana przez sprawdzanie`.

### 5. Data albo liczba zapisana tekstem
**Ryzyko:** boty mylą się przy datach, przesuwając liczbę. Data zapisana jako „rok 1410” nie dałaby się przesunąć.
**Zabezpieczenie:** dla typów `data` i `liczba` pierwsza odpowiedź musi być liczbą całkowitą.
**Test:** `questions-test.ts › daty i liczby mają liczbową pierwszą odpowiedź`.

### 6. Za mało pytań na jedną grę
**Ryzyko:** gra zużywa 49–94 pytania, a w bazie jest 50. Talia by się skończyła.
**Zabezpieczenie:** talia jest zapętlona (`drawQuestion` bierze `cursor % deck.length`), a pusta baza jest odrzucana w `createGame`.
**Test:** `engine-test.ts › nie zadaje dwa razy tego samego pytania, dopóki talia się nie skończy`, `integration-test.ts › pełna gra kończy się poprawnie na poziomie …`.
