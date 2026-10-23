# Formaty odpowiedzi i czas decyzji botów

Funkcjonalność: poziomy Łatwy i Normalny odpowiadają wyborem ABCD, poziom Ekspert pisemnie. Boty decydują po czasie z rozkładu Gaussa (wg PDF „Quiz Frenzy”: ok. 1,5 s dla ABCD, ok. 3,5 s dla pisemnego). Zasady poziomów (skuteczność botów, mnożnik tempa) się nie zmieniają.

## Ryzyka

### 1. Za mało opcji do ABCD
- **Ryzyko:** pytanie bez `wrongAnswers` i bez innych pytań tego samego typu da mniej niż 4 opcje, gracz zobaczy pusty przycisk albo wybór bez sensu.
- **Zabezpieczenie:** `buildChoices` losuje pomyłki z `wrongAnswers`, potem z innych pytań tego samego typu, a dla dat i liczb dopełnia liczbami obok poprawnej (`nearbyNumber`). Gdy i tak brakuje opcji, zwraca mniej, a kontroler loguje ostrzeżenie i pokazuje pole tekstowe zamiast ABCD.
- **Co się wydarzyło:** w bazie są tylko 3 pytania o datach, więc bez `nearbyNumber` część pytań dawała 3 opcje (opisane w dokumentacji postępów, punkt 7.29).
- **Test:** `src/game/__tests__/answer-format-test.ts` › „każde pytanie w bazie dostaje 4 różne opcje, w tym poprawną odpowiedź”; „bez puli pytań liczby dopełniają opcje liczbami obok poprawnej”.

### 2. Poprawna odpowiedź w opcjach jest zdublowana albo pominięta
- **Ryzyko:** pomyłka równa poprawnej odpowiedzi (np. „1410” i „1410 r.”) albo brak poprawnej opcji sprawi, że gracz zostanie ukarany mimo dobrego wyboru.
- **Zabezpieczenie:** pomyłki filtrowane przez `isCorrectAnswer` i deduplikowane przez `normalizeAnswer`. Poprawna odpowiedź (`answers[0]`) zawsze jest dodawana.
- **Test:** `answer-format-test.ts` › „każde pytanie w bazie…” (sprawdza też, że poprawna odpowiedź jest wśród opcji); „pomyłki nie są zgodne z poprawną”.

### 3. Losowanie opcji psuje powtarzalność gry
- **Ryzyko:** jeśli opcje losuje główny generator gry, każda zmiana w liczbie wywołań zmienia cały późniejszy przebieg, a testy na ustalonych ziarnach przestają działać.
- **Zabezpieczenie:** opcje losowane są z osobnego generatora zasianego id pytania (`createRng(hashString(question.id))`).
- **Test:** `answer-format-test.ts` › „te same pytanie dają te same opcje…”.

### 4. Gracz odpowiada ABCD, a silnik oczekuje tekstu
- **Ryzyko:** gdyby wybór przekazywał literę (A–D) zamiast treści, silnik uznałby każdą odpowiedź za błędną.
- **Zabezpieczenie:** przycisk wysyła treść wybranej opcji tym samym `submitAnswer(text)`, co pole tekstowe. Silnik się nie zmienia.
- **Test:** ręcznie w przeglądarce: klik w opcję zatwierdza odpowiedź (`submitAnswer` dostaje treść opcji, a silnik ocenia ją jak zwykłą odpowiedź).

### 5. Głos w trybie ABCD
- **Ryzyko:** mikrofon nasłuchujący przy wyborze ABCD mógłby zgłosić odpowiedź niezgodną z opcjami.
- **Zabezpieczenie:** w trybie ABCD `AnswerPanel` nie włącza mikrofonu (`paused` ustawione na prawdę), a przycisk mikrofonu jest ukryty.
- **Test:** ręcznie w przeglądarce (brak przycisku mikrofonu w trybie ABCD).

### 6. Czas decyzji bota wychodzi poza zakres
- **Ryzyko:** rozkład Gaussa może dać wartość ujemną albo większą niż czas odpowiedzi gracza, co zablokuje turę albo da nieludzką szybkość.
- **Zabezpieczenie:** wynik przycinany do przedziału (ABCD 1000–2500 ms, pisemnie 2000–5000 ms), mnożony przez `speedFactor` poziomu i ograniczany do `answerTimeMs − 300`.
- **Test:** `answer-format-test.ts` › „na poziomie … mieści się w przedziale dla swojego formatu”; „rozkład Gaussa ma średnią bliską wartości z PDF”.

### 7. Zmiana tempa odbiera botom osobowość w czasie
- **Ryzyko:** profile botów miały różne `answerTimeMs`; po zmianie na rozkład z PDF wszyscy odpowiadają podobnie.
- **Zabezpieczenie:** różnice zostają w `buzzTimeMs` (zgłoszenia w finale) i w skuteczności. Decyzja świadoma, opisana w dokumentacji postępów.
- **Test:** `simulate-test.ts` nadal przechodzi; zmiana zapisana w dokumentacji postępów (punkt 4).

### 8. Zmiana wpływa na poziom Ekspert
- **Ryzyko:** Ekspert musi nadal pisać odpowiedzi i mieć skuteczność botów bez zmian.
- **Zabezpieczenie:** `answerFormat` jest tylko nowym polem w `DIFFICULTY_PRESETS`; `knowledgeOffset`, `speedFactor` i `strategicness` pozostają takie same.
- **Test:** `answer-format-test.ts` › „Łatwy i Normalny używają ABCD, Ekspert pisemnie”; „pozostałe parametry poziomów… się nie zmieniły”.
