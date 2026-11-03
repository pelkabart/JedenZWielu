# Ustawienia: klucz API OpenAI

> **Od 03.11.2026 klucza nie wpisuje się w aplikacji.** Ekran, zapis na telefonie (`ApiKeyStore`, `expo-secure-store`) i ich testy są usunięte. Klucz pochodzi tylko z `EXPO_PUBLIC_OPENAI_API_KEY` (`src/settings/configApiKey.ts`). Punkty o Keystore i ekranie ustawień poniżej to zapis wcześniejszych prac.

## Aktualne ryzyka

### A. Klucz jest w zbudowanej aplikacji
**Ryzyko:** `EXPO_PUBLIC_…` trafia do paczki jawnym tekstem, więc każdy, kto dostanie APK, może wyciągnąć klucz i korzystać z niego na koszt właściciela.
**Zabezpieczenie:** tylko częściowe: `.env.local` jest w `.gitignore`, hak pre-commit blokuje commit klucza, a klucz nie trafia do logów. APK z kluczem nie wolno udostępniać. Pełne rozwiązanie to pośrednik po stronie serwera.
**Test:** `configApiKey-test.ts`, `categories-integration-test.ts` › „poprawny klucz trafia do zapytania, ale do żadnego logu”.

### B. Build bez klucza
**Ryzyko:** build EAS nie ma `.env.local` (plik jest w `.gitignore`), więc tworzenie kategorii z plików w nim nie działa. Import `.kat` działa dalej.
**Zabezpieczenie:** przycisk „Utwórz kategorię” jest wyłączony, a ekran mówi, czego brakuje. Klucz do buildów EAS trzeba podać przez zmienne środowiskowe EAS.
**Test:** `categories-integration-test.ts` › „bez klucza API…”.

### C. Zły format klucza
**Ryzyko:** literówka w pliku wyszłaby dopiero jako błąd 401, po czytaniu plików.
**Zabezpieczenie:** `resolveApiKey` sprawdza format przy starcie, zły klucz traktuje jak brak i zapisuje ostrzeżenie bez treści klucza.
**Test:** `configApiKey-test.ts` › „odrzuca…”; `categories-integration-test.ts` › „klucz w złym formacie…”.

Moduły: `src/settings/ApiKeyStore.ts` (walidacja, maskowanie, magazyn klucza), adapter `src/settings/device/secureKeyStorage.ts` (`expo-secure-store`), wspólna instancja `src/settings/apiKey.ts`, hak `src/hooks/useApiKey.ts`, ekran `src/app/settings.tsx`; ekran `src/app/categories/new.tsx` tylko czyta klucz.
Testy: `src/settings/__tests__/ApiKeyStore-test.ts`, `src/settings/__tests__/settings-integration-test.ts`, `src/categories/__tests__/categories-integration-test.ts` (brak klucza).
Logi: `[ustawienia]`.

Klucz API OpenAI wpisuje się raz, na ekranie „Ustawienia” (zębatka w prawym górnym rogu ekranu głównego). Jest zapisywany na telefonie w `expo-secure-store` – na Androidzie to `SharedPreferences` zaszyfrowane kluczem z Android Keystore, więc zostaje po zamknięciu i ponownym uruchomieniu gry. Ekran „Nowa kategoria” nie ma już pola na klucz: korzysta z zapisanego, a gdy go brak, pokazuje przycisk „Ustawienia”.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Klucz wycieka z telefonu albo z logów
**Ryzyko:** klucz zapisany zwykłym plikiem albo w `AsyncStorage` da się odczytać z kopii zapasowej lub na telefonie z rootem. Klucz w logach trafiłby na ekran (Expo Go) albo do raportu. Pełny klucz pokazany na ekranie ustawień zobaczy każdy, kto patrzy graczowi przez ramię.
**Zabezpieczenie:** klucz jest tylko w `expo-secure-store` (Android Keystore). Wtyczka `expo-secure-store` w `app.json` domyślnie wyłącza ten magazyn z kopii zapasowej Androida (`configureAndroidBackup`). Logi `[ustawienia]` mówią tylko, czy klucz jest (`saved: true/false`), nigdy jaki. Ekran pokazuje klucz zamaskowany (`sk-…abcd`, `maskApiKey`), a pole do wpisywania jest typu hasło.
**Test:** `ApiKeyStore-test.ts › klucz nie trafia do logów`, `› maskApiKey`.

### 2. Zapisany zostaje śmieć zamiast klucza
**Ryzyko:** gracz wkleja klucz ze spacją na końcu, z przejściem do nowej linii, sam fragment albo przypadkiem inny tekst. Dowiedziałby się o tym dopiero po kilku minutach generowania kategorii (błąd 401).
**Zabezpieczenie:** `validateApiKey` przycina spacje i odrzuca: pusty tekst, spacje w środku, tekst niezaczynający się od `sk-`, za krótki (< 20 znaków) i za długi (> 300). Komunikat po polsku pokazuje się od razu pod polem.
**Test:** `ApiKeyStore-test.ts › validateApiKey` (przypadki `it.each`).

### 3. Nieudany zapis albo odczyt magazynu
**Ryzyko:** `SecureStore` rzuca wyjątek (np. uszkodzony klucz Keystore po przywróceniu telefonu z kopii). Gra wywróciłaby się przy wejściu w ustawienia albo pokazałaby „zapisano”, choć nic nie zapisano.
**Zabezpieczenie:** `load` łapie błąd odczytu: ostrzeżenie w logach i brak klucza (gracz wpisze go jeszcze raz). `save` i `clear` najpierw zapisują do magazynu, a dopiero po udanym zapisie zmieniają stan w pamięci; błąd to `ApiKeyError('storage')` z komunikatem na ekranie.
**Test:** `ApiKeyStore-test.ts › błąd odczytu: brak klucza`, `› błąd zapisu: stary klucz zostaje`, `› błąd usuwania: klucz zostaje`.

### 4. Ekran „Nowa kategoria” nie widzi świeżo zapisanego klucza
**Ryzyko:** gracz wchodzi z ekranu kategorii do ustawień, zapisuje klucz i wraca – ekran dalej myśli, że klucza nie ma (przycisk „Utwórz” wyłączony).
**Zabezpieczenie:** `ApiKeyStore` powiadamia subskrybentów, a ekrany czytają klucz przez `useSyncExternalStore` (`useApiKey`), więc odświeżają się same.
**Test:** `ApiKeyStore-test.ts › powiadamia subskrybentów`, `settings-integration-test.ts`.

### 5. Wysłanie plików bez klucza
**Ryzyko:** bez klucza gra przeczytałaby wszystkie pliki (do 30 MB w pamięci) tylko po to, żeby dostać błąd.
**Zabezpieczenie:** `createQuestionSet` sprawdza klucz razem z nazwą, limitem i plikami – przed czytaniem plików i przed zapytaniem do OpenAI; komunikat odsyła do ustawień. Ekran ma wtedy wyłączony przycisk „Utwórz kategorię” i pokazuje przycisk „Ustawienia”.
**Test:** `categories-integration-test.ts › bez klucza API: błąd przed czytaniem plików`.

### 6. Dwa zapisy naraz
**Ryzyko:** szybkie „Zapisz”, a zaraz „Usuń” (albo dwa zapisy) kończą się w innej kolejności niż zostały kliknięte – w magazynie zostaje inny klucz niż na ekranie.
**Zabezpieczenie:** zapisy i usuwanie idą w kolejce (jak w `QuestionSetStore`), a `load` czeka na nie.
**Test:** `ApiKeyStore-test.ts › zapis i usunięcie po sobie: wygrywa ostatnie`.

### 7. Stary zapis z poprzedniej wersji gry
**Ryzyko:** wcześniejsza wersja zapisywała klucz z ekranu „Nowa kategoria”. Po aktualizacji gracz musiałby wpisywać go od nowa.
**Zabezpieczenie:** adapter używa tej samej nazwy wpisu w `SecureStore` (`openai_api_key`), więc stary klucz jest od razu widoczny w ustawieniach.
**Test:** ręcznie: APK z ustawieniami zainstalowany na emulatorze na wersję, w której klucz wpisano na ekranie „Nowa kategoria” – ustawienia od razu pokazały zapisany klucz (`sk-…` + 4 ostatnie znaki), a log `[ustawienia] Wczytano ustawienia {"saved":true}`.

## Klucz wpisany w pliku `.env.local` (dla programistów)

Zamiast wpisywać klucz na każdym telefonie/emulatorze, można go wpisać raz w pliku `.env.local` w katalogu głównym projektu:

```
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

Expo CLI wczytuje ten plik przy `npx expo start` / `npx expo run:android` / budowaniu APK i wstawia wartość do kodu (`src/settings/configApiKey.ts`). Wzór pliku (bez klucza) to `.env.example`. Klucz zapisany w ustawieniach na telefonie ma pierwszeństwo; gdy go nie ma, gra używa klucza z `.env.local`.

### 8. Klucz z pliku trafia do repozytorium
**Ryzyko:** ktoś commituje `.env.local` (np. `git add -f`) albo wkleja klucz bezpośrednio do pliku `.ts`; klucz trafia na GitHuba i OpenAI go blokuje (albo ktoś go używa na nasz koszt).
**Zabezpieczenie:** `.gitignore` ignoruje `.env` i `.env.*` (poza `.env.example`). Dodatkowo hak `.githooks/pre-commit` (włączany automatycznie przez `npm install` – skrypt `prepare` ustawia `core.hooksPath`) odrzuca commit, który zawiera plik `.env*` inny niż `.env.example` albo w dodanych liniach ma tekst wyglądający na klucz OpenAI (`sk-` + co najmniej 20 znaków).
**Test:** ręcznie: `git add -f .env.local && git commit` → commit odrzucony; plik `.ts` z `sk-` + 30 znaków → odrzucony.

### 9. Klucz z pliku jest niepoprawny
**Ryzyko:** literówka albo spacja w `.env.local` – gra myśli, że ma klucz, a OpenAI odpowiada 401 po kilku minutach.
**Zabezpieczenie:** klucz z pliku przechodzi przez tę samą `validateApiKey`; niepoprawny jest pomijany z ostrzeżeniem `[ustawienia] Klucz z .env.local jest niepoprawny` (bez treści klucza).
**Test:** `ApiKeyStore-test.ts › klucz z konfiguracji`.

### 10. Klucz z pliku jest w zbudowanym APK
**Ryzyko:** zmienne `EXPO_PUBLIC_*` są wpisywane do paczki JS jawnym tekstem – każdy, kto dostanie APK, może klucz wyciągnąć.
**Zabezpieczenie:** to opcja tylko dla programistów; APK dla innych osób budujemy z pustym `EXPO_PUBLIC_OPENAI_API_KEY` (ostrzeżenie w README i w `.env.example`). Ekran ustawień pokazuje, że klucz pochodzi z pliku, i nie pozwala go „usunąć” z telefonu.
