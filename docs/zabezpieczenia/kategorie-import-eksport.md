# Import i eksport kategorii (pliki `.kat`)

Moduły: `src/categories/categoryFile.ts` (format pliku, sprawdzanie), `src/categories/transferQuestionSet.ts` (import i eksport krok po kroku), adapter `src/categories/device/categoryFiles.ts` (wybór pliku, wybór folderu, zapis), ekran `src/app/categories/index.tsx`, przycisk eksportu w `src/components/categories/CategoryRow.tsx`
Testy: `src/categories/__tests__/categoryFile-test.ts`, `transferQuestionSet-test.ts`, `categories-integration-test.ts` (blok „import i eksport”)
Logi: `[kategorie]` (import/eksport), `[ekran-kategorii]` (ekran).

Na ekranie „Kategorie” pod listą jest przycisk „Importuj”, a przy każdej własnej kategorii przycisk eksportu (strzałka). Eksport zapisuje kategorię do pliku `<nazwa>.kat` w folderze wybranym przez gracza. W środku jest zwykły JSON:

```json
{
  "format": "jeden-z-wielu/kategoria",
  "version": 1,
  "name": "Biologia",
  "exportedAt": "2026-11-03T12:00:00.000Z",
  "sourceFiles": ["notatki.pdf"],
  "questions": [{ "category": "Nauka", "question": "…", "answers": ["…"], "answerType": "nazwa", "difficulty": 1 }]
}
```

Import przyjmuje tylko pliki z rozszerzeniem `.kat`. Zaimportowana kategoria trafia do tego samego magazynu co kategoria z OpenAI (`QuestionSetStore.add`): liczy się do limitu 3, można ją usunąć, wyeksportować i wybrać przed grą.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Plik o innym rozszerzeniu
**Ryzyko:** gracz wybiera PDF albo zdjęcie. Android nie zna typu MIME dla `.kat`, więc wybierak plików nie może ich odfiltrować.
**Zabezpieczenie:** `isCategoryFileName` sprawdza rozszerzenie `.kat` (bez względu na wielkość liter) przed czytaniem pliku; inny plik to błąd `import-extension` z komunikatem.
**Test:** `categoryFile-test.ts › isCategoryFileName`, `transferQuestionSet-test.ts › odrzuca plik bez rozszerzenia .kat i go nie czyta`.

### 2. Zły albo obcy JSON w pliku `.kat`
**Ryzyko:** uszkodzony plik, ręcznie edytowany plik, inny JSON z rozszerzeniem `.kat` albo plik z nowszej wersji gry. Gra wywróciłaby się albo zapisała śmieci.
**Zabezpieczenie:** `parseCategoryFile` sprawdza po kolei: poprawny JSON, obiekt, pole `format`, znaną wersję, nazwę, listę pytań. Każdy przypadek to `CategoryError('import-format')` z polskim komunikatem. Nic nie jest zapisywane.
**Test:** `categoryFile-test.ts › parseCategoryFile` (przypadki `it.each`).

### 3. Złe pytania w pliku
**Ryzyko:** plik pochodzi spoza gry, więc pytania mogą psuć rozgrywkę jak złe pytania z OpenAI (puste, zła data, powtórzenia, „błędna” odpowiedź równa poprawnej).
**Zabezpieczenie:** pytania przechodzą przez tę samą funkcję co pytania z OpenAI (`sanitizeGeneratedQuestions` → `parseQuestion`): złe odrzucane pojedynczo, powtórzenia pomijane, id nadawane na nowo. Poniżej 20 poprawnych pytań (tyle samo co przy OpenAI) import jest odrzucany (`too-few-questions`).
**Test:** `categoryFile-test.ts › odrzuca złe pytania pojedynczo`, `› za mało poprawnych pytań`.

### 4. Bardzo duży plik
**Ryzyko:** wczytanie pliku setek MB do pamięci zawiesiłoby telefon.
**Zabezpieczenie:** rozmiar z wybieraka jest sprawdzany przed czytaniem (najwyżej 5 MB; kategoria z 60 pytaniami ma kilkadziesiąt KB). Plik pusty też jest odrzucany.
**Test:** `transferQuestionSet-test.ts › odrzuca za duży i pusty plik bez czytania`.

### 5. Limit kategorii i nazwa zajęta
**Ryzyko:** import czwartej kategorii albo import tej samej kategorii drugi raz (dwie o tej samej nazwie).
**Zabezpieczenie:** limit jest sprawdzany przed czytaniem pliku i jeszcze raz w magazynie (`add`). Gdy nazwa jest zajęta, gra nadaje wolną nazwę z numerem („Biologia (2)”), przycinając ją do 30 znaków. Przycisk „Importuj” jest wyłączony przy 3 kategoriach.
**Test:** `transferQuestionSet-test.ts › przy limicie nie czyta pliku`, `› zajęta nazwa dostaje numer`, `categoryFile-test.ts › uniqueSetName`.

### 6. Eksport kategorii domyślnej
**Ryzyko:** eksport wbudowanej bazy pozwoliłby ją zaimportować jako własną kopię 50 pytań i obejść sens limitu; dla domyślnej nie ma też sensu przycisk.
**Zabezpieczenie:** `exportQuestionSet` odrzuca zestaw wbudowany (`default-set`); przy domyślnej nie ma przycisku eksportu.
**Test:** `transferQuestionSet-test.ts › nie eksportuje kategorii domyślnej`.

### 7. Nazwa pliku z niedozwolonymi znakami
**Ryzyko:** nazwa kategorii „Historia: 1/2” dałaby ścieżkę z `/` albo znakami zakazanymi w systemie plików; zapis by się nie udał.
**Zabezpieczenie:** `categoryFileName` zamienia znaki `\ / : * ? " < > |` i znaki sterujące na `_`, pustą nazwę zamienia na „kategoria”, zawsze dokleja `.kat`.
**Test:** `categoryFile-test.ts › categoryFileName`.

### 8. Android dokleja inne rozszerzenie
**Ryzyko:** Storage Access Framework przy typie `application/json` potrafi zapisać plik jako `nazwa.kat.json`, a takiego import nie przyjmie.
**Zabezpieczenie:** plik jest tworzony z typem `application/octet-stream`, dla którego system nie zmienia nazwy.
**Test:** ręcznie na telefonie (adapter urządzenia nie jest testowany w Jest).

### 9. Anulowanie wyboru pliku albo folderu, błąd zapisu
**Ryzyko:** gracz zamyka wybierak; gra pokazałaby błąd albo zawisła. Brak uprawnień do folderu skończyłby się czerwonym ekranem.
**Zabezpieczenie:** anulowanie zwraca `null` / `false` i nic się nie dzieje. Błąd zapisu lub odczytu to `CategoryError` (`export-write`, `file-read`) pokazany w oknie „Błąd”. Przyciski są zablokowane na czas operacji (`useRef`), więc dwa stuknięcia nie uruchomią dwóch importów.
**Test:** `transferQuestionSet-test.ts › anulowany zapis to brak eksportu`, `› błąd zapisu to export-write`, `› błąd odczytu to file-read`.

### 10. Eksport–import gubi dane
**Ryzyko:** plik wyeksportowany przez grę nie dałby się z powrotem zaimportować albo pytania zmieniłyby się po drodze.
**Zabezpieczenie:** eksport zapisuje pytania bez wewnętrznych id, w tym samym formacie co baza; test przechodzi pełną drogę eksport → import → gra.
**Test:** `categories-integration-test.ts › kategoria wyeksportowana i zaimportowana na innym telefonie działa w grze`.
