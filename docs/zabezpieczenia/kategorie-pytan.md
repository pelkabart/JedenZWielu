# Kategorie pytań (własne zestawy z OpenAI)

Moduły: `src/categories/` (`sourceFiles.ts`, `generatedQuestions.ts`, `openaiGenerator.ts`, `QuestionSetStore.ts`, `soloEntry.ts`, adaptery `fileStorage.ts`, `pickSourceFiles.ts`, `apiKeyStorage.ts`, wspólna instancja `questionSets.ts`), `parseQuestion` w `src/game/questions.ts`, ekrany `src/app/categories/`, `src/app/solo/categories.tsx`
Testy: `src/categories/__tests__/sourceFiles-test.ts`, `generatedQuestions-test.ts`, `openaiGenerator-test.ts`, `QuestionSetStore-test.ts`, `soloEntry-test.ts`, `categories-integration-test.ts`
Logi: `[kategorie]` (magazyn zestawów), `[openai]` (generowanie), `[ekran-kategorii]` (ekrany).

W menu jest przycisk „Kategorie”. Na liście pierwsza jest zawsze „Domyślna” – pytania z `src/data/questions.json`; nie da się jej usunąć. Gracz może dodać najwyżej 3 własne zestawy: podaje nazwę i wybiera od 1 do 9 plików (PDF, TXT, DOCX, …). Pliki idą do OpenAI (Responses API, `input_file`), a model zwraca pytania w formacie bazy pytań (Structured Outputs, schemat JSON). Zestaw jest zapisywany w pamięci telefonu. Gdy oprócz domyślnej jest choć jedna własna kategoria, wejście w tryb jednoosobowy pokazuje najpierw listę kategorii; pytania w grze są losowane tylko z wybranej.

W kodzie kategoria to „zestaw pytań” (`QuestionSet`), żeby nie mylić jej z polem `Question.category` (dziedzina: Historia, Sport…).

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Za dużo albo za duże pliki
**Ryzyko:** gracz wybiera 15 plików albo film 300 MB. OpenAI przyjmuje najwyżej 50 MB na zapytanie; zakodowanie w base64 dużego pliku może też zabrać całą pamięć telefonu.
**Zabezpieczenie:** `validateSourceFiles` przed wysłaniem sprawdza: od 1 do 9 plików, każdy niepusty, najwyżej 10 MB, razem najwyżej 30 MB (po base64 ok. 40 MB), tylko obsługiwane rozszerzenia. Plik jest czytany do pamięci dopiero po tej kontroli, na podstawie rozmiaru z wybieraka plików.
**Test:** `sourceFiles-test.ts › validateSourceFiles` (przypadki `it.each`).

### 2. Model zwraca pytania, które psują grę
**Ryzyko:** odpowiedź z modelu to dane z zewnątrz: puste pytanie, data zapisana słowami („rok 1410”), nieznana dziedzina, „błędna” odpowiedź dla bota identyczna z poprawną, powtórzone pytania. Wyszłoby to dopiero w trakcie gry.
**Zabezpieczenie:** `sanitizeGeneratedQuestions` przepuszcza każde pytanie przez tę samą walidację co bazę domyślną (`parseQuestion`). Złe pytania są odrzucane pojedynczo (a nie cały zestaw), pomyłki uznawane za poprawne są usuwane, powtórzenia treści pomijane, a id nadawane na nowo (`<id zestawu>-001`). Nieznana dziedzina zamienia się w „Rozmaitości”.
**Test:** `generatedQuestions-test.ts`.

### 3. Za mało pytań na grę
**Ryzyko:** z krótkiego pliku model zrobi 5 pytań. Gra zużywa ich kilkadziesiąt, więc te same pytania wracałyby co chwilę.
**Zabezpieczenie:** prosimy o 60 pytań; zestaw z mniej niż 20 poprawnymi pytaniami (po walidacji) jest odrzucany z komunikatem „Za mało pytań…”. Talia i tak jest zapętlona (zabezpieczenie z bazy pytań).
**Test:** `openaiGenerator-test.ts › za mało poprawnych pytań to błąd too-few-questions`.

### 4. Błędy sieci i API
**Ryzyko:** brak internetu, zły klucz (401), limit (429), błąd serwera, odpowiedź ucięta (`status: incomplete`), odmowa modelu (`refusal`), niepoprawny JSON, zawieszone połączenie. Gracz zobaczyłby czerwony ekran albo kręciołek bez końca.
**Zabezpieczenie:** `generateQuestionSet` zamienia każdy przypadek na `GenerationError` z rodzajem (`auth`, `rate-limit`, `network`, `server`, `bad-response`, `refused`, `timeout`, …) i polskim komunikatem. Zapytanie ma limit czasu (`AbortController`, 3 min). Ekran pokazuje komunikat i pozwala spróbować ponownie; nic nie jest zapisywane.
**Test:** `openaiGenerator-test.ts` (blok „błędy”).

### 5. Klucz API wycieka
**Ryzyko:** klucz wpisany w kod albo w `EXPO_PUBLIC_…` trafiłby do APK, z którego każdy może go wyciągnąć. Klucz w logach trafiłby na ekran albo do raportu.
**Zabezpieczenie:** klucza nie ma w repozytorium ani w APK – gracz wpisuje własny klucz na ekranie dodawania kategorii; jest zapamiętywany w `expo-secure-store` (szyfrowany magazyn systemu). Logi zawierają tylko liczby i nazwy plików, nigdy klucza ani treści plików.
**Test:** `openaiGenerator-test.ts › klucz nie trafia do logów`.

### 6. Więcej niż 3 własne kategorie albo usunięcie domyślnej
**Ryzyko:** szybkie podwójne kliknięcie „Utwórz” albo błąd w ekranie dodałby czwarty zestaw; usunięcie domyślnej zostawiłoby grę bez pytań.
**Zabezpieczenie:** limit i ochrona domyślnej są w magazynie (`QuestionSetStore`), a nie tylko w ekranie: `add` odrzuca czwarty zestaw (`limit`), `remove('default')` jest odrzucane. Ekran nie pokazuje przycisku usuwania przy domyślnej, a przycisk „Dodaj” jest wyłączony przy 3 zestawach. Generowanie sprawdza limit przed wysłaniem plików, żeby nie płacić za pytania, których nie da się zapisać.
**Test:** `QuestionSetStore-test.ts › nie pozwala dodać czwartego zestawu`, `› domyślnej nie da się usunąć`.

### 7. Zła nazwa kategorii
**Ryzyko:** pusta nazwa, same spacje, bardzo długi tekst rozjeżdżający przycisk, dwie kategorie o tej samej nazwie (nie da się ich odróżnić na liście), nazwa „Domyślna”.
**Zabezpieczenie:** `validateSetName`: przycięcie spacji, 1–30 znaków, unikalność bez względu na wielkość liter i polskie znaki, zajęta nazwa „Domyślna”.
**Test:** `QuestionSetStore-test.ts › validateSetName` (przypadki `it.each`).

### 8. Uszkodzony zapis na telefonie
**Ryzyko:** przerwany zapis, zmiana formatu w nowej wersji gry albo ręczna edycja pliku. Gra wywróciłaby się przy starcie.
**Zabezpieczenie:** `load` czyta zapis w `try/catch`; zły JSON albo zła wersja to ostrzeżenie w logach i pusta lista własnych zestawów, a pojedynczy zepsuty zestaw jest pomijany (pozostałe zostają). Każde pytanie przechodzi przez `parseQuestion`. Kategoria domyślna nie jest zapisywana, więc zawsze działa.
**Test:** `QuestionSetStore-test.ts` (blok „uszkodzony zapis”).

### 9. Wybrana kategoria nie istnieje
**Ryzyko:** gracz wybiera kategorię, a w międzyczasie ją usuwa (albo adres ekranu ma stare id). Gra dostałaby pustą listę pytań.
**Zabezpieczenie:** `questionsForSet` dla nieznanego id zwraca pytania domyślne i loguje ostrzeżenie.
**Test:** `QuestionSetStore-test.ts › nieznany zestaw: pytania domyślne`.

### 10. Pytania z innej kategorii w grze
**Ryzyko:** silnik lub boty brałyby pytania z bazy domyślnej mimo wybrania własnej kategorii (np. bank pomyłek botów zostałby domyślny).
**Zabezpieczenie:** wybrany zestaw jest przekazywany jako `questions` do `createSoloGame` i jako `bank` do sterownika.
**Test:** `categories-integration-test.ts › cała gra na wygenerowanej kategorii zadaje tylko jej pytania`.

### 11. Lista kategorii pokazuje się, gdy nie ma wyboru
**Ryzyko:** gracz bez własnych kategorii musiałby za każdym razem wybierać jedyną „Domyślną”.
**Zabezpieczenie:** `soloEntryRoute` prowadzi do listy kategorii tylko wtedy, gdy jest więcej niż jeden zestaw; inaczej od razu do wyboru poziomu.
**Test:** `soloEntry-test.ts`, `categories-integration-test.ts`.

### 12. Dwa stuknięcia w „Utwórz kategorię” wysyłają dwa płatne zapytania
**Ryzyko:** dwa stuknięcia w tej samej klatce widzą jeszcze stary stan ekranu (przycisk aktywny). Magazyn odrzuciłby drugi zestaw (ta sama nazwa), ale za oba zapytania do OpenAI trzeba by zapłacić.
**Zabezpieczenie:** ekran ma znacznik `submitting` (`useRef`), ustawiany synchronicznie przy pierwszym stuknięciu; w czasie tworzenia przycisk znika i pokazuje się postęp.
**Test:** ręcznie (ekran nie ma testów komponentów); ochrona w magazynie: `QuestionSetStore-test.ts › dwa jednoczesne dodania przy dwóch zestawach: przechodzi tylko jedno`.

### 13. Wybierak plików ukrywa obsługiwane pliki
**Ryzyko:** filtr typów MIME w wybieraku Androida nie zna części typów (np. `text/markdown`), więc takie pliki byłyby wyszarzone, choć gra je obsługuje.
**Zabezpieczenie:** wybierak pokazuje wszystkie pliki (`*/*`), a format sprawdza `validateSourceFiles` po rozszerzeniu, z komunikatem, które formaty są obsługiwane.
**Test:** `sourceFiles-test.ts › mimeTypeFor`, `› odrzuca: nieobsługiwany typ`.

### 14. Czwarty przycisk nie mieści się w menu
**Ryzyko:** gra działa w poziomie; na telefonie o wysokości ok. 360 punktów tytuł i cztery przyciski nie zmieściłyby się, a dolny („Kategorie”) zostałby ucięty.
**Zabezpieczenie:** poniżej 400 punktów wysokości (po odjęciu bezpiecznych marginesów) ekran główny zmniejsza tytuł i odstępy. Listy kategorii są w `ScrollView`.
**Test:** ręcznie, na emulatorze w poziomie.

### 15. Gracz wychodzi z ekranu w czasie generowania
**Ryzyko:** zapytanie trwa do kilku minut; gracz wraca do menu. Wynik mógłby przepaść albo zapisać się w połowie.
**Zabezpieczenie:** tworzenie kategorii nie zależy od ekranu: kończy się w tle i zapisuje całą kategorię naraz (najpierw zapis do pliku tymczasowego, potem podmiana), a lista kategorii odświeża się sama (`useSyncExternalStore`).
**Test:** `QuestionSetStore-test.ts › powiadamia subskrybentów…`, `› błąd zapisu: zestaw nie jest dodany…`.
