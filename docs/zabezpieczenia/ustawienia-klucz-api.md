# Ustawienia: klucz API OpenAI

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
**Test:** ręcznie (aktualizacja APK na emulatorze z zapisanym kluczem).
