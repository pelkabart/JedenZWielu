# Sprawdzanie odpowiedzi

Moduł: `src/game/answers.ts`
Testy: `src/game/__tests__/answers-test.ts`

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Odpowiedź bez polskich znaków jest odrzucana
**Ryzyko:** „Wisla” zamiast „Wisła”. Standardowa normalizacja (`NFD` + usunięcie akcentów) nie obsługuje litery ł.
**Zabezpieczenie:** ł/Ł zamieniamy na l ręcznie przed normalizacją.
**Test:** `answers-test.ts › akceptuje odpowiedź bez polskich znaków`, `usuwa wielkość liter, polskie znaki i interpunkcję`.

### 2. Tolerancja literówek akceptuje złe liczby
**Ryzyko:** „1411” różni się od „1410” jedną cyfrą, więc przy tolerancji 1 literówki zostałoby uznane.
**Zabezpieczenie:** odpowiedzi z cyframi muszą się zgadzać dokładnie.
**Test:** `answers-test.ts › wymaga dokładnej liczby`, `nie toleruje literówek w liczbach i krótkich słowach`.

### 3. Krótkie odpowiedzi myli jedna litera
**Ryzyko:** „Ag” i „Au” to różne pierwiastki, a różnią się jedną literą.
**Zabezpieczenie:** do 4 znaków nie ma tolerancji literówek.
**Test:** `answers-test.ts › wymaga dokładnych krótkich odpowiedzi`.

### 4. Przecinek dziesiętny rozbija liczbę
**Ryzyko:** „42,195” po usunięciu interpunkcji staje się „42 195” i się nie zgadza.
**Zabezpieczenie:** przecinek i kropka między cyframi są sklejane przed usunięciem interpunkcji.
**Test:** `answers-test.ts › skleja liczby z separatorem dziesiętnym`.

### 5. Brak odpowiedzi albo puste pole liczy się jako dobra odpowiedź
**Ryzyko:** `null` (koniec czasu) albo same spacje po normalizacji dają pusty tekst, który mógłby pasować do czegoś w odległości edycyjnej.
**Zabezpieczenie:** pusty tekst i `null` są zawsze odrzucane.
**Test:** `answers-test.ts › odrzuca brak odpowiedzi i pusty tekst`.
