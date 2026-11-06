# Ekran ładowania gry

Przed pierwszą rundą gra czeka, aż wczytają się skórki wszystkich postaci (gracz, boty, prowadzący) i aż lektor będzie gotowy (silnik Piper załadowany, pierwsza próbna synteza za nami). W tym czasie widać ekran „Wczytywanie gry…” z paskiem postępu. Gra pod spodem jest już narysowana, więc obrazki dekodują się za zasłoną, ale sterownik nie jest uruchomiony. Logika jest w `src/components/potato/loadingGate.ts` (`LoadingGate`, bez Reacta, z wstrzykiwanym zegarem).

### 1. Gra wisi na ekranie ładowania
- **Ryzyko:** obrazek nie zgłosi wczytania (błąd pliku, brak zdarzenia `onLoad`) albo lektor nigdy się nie przygotuje, więc gracz czeka bez końca.
- **Zabezpieczenie:** błąd obrazka (`onError`) liczy się jak wczytanie. Lektor bez silnika (Expo Go, brak modelu) zgłasza gotowość od razu. Po `LOADING_TIMEOUT_MS` (10 s) bramka i tak się otwiera i zostawia `warn` w logach z tym, czego zabrakło.
- **Test:** `loadingGate-test.ts` › „po czasie granicznym gra rusza mimo braków”, „błąd lektora nie blokuje gry”.

### 2. Postęp liczony źle
- **Ryzyko:** ten sam obrazek zgłasza się dwa razy (ponowne `onLoad`) albo zgłasza się obrazek spoza listy, więc pasek pokazuje 100%, choć czegoś brakuje.
- **Zabezpieczenie:** bramka zna listę oczekiwanych kluczy (`<id gracza>:<klatka>`). Liczy każdy klucz raz, a nieznane pomija.
- **Test:** `loadingGate-test.ts` › „ten sam obrazek liczy się raz, obcy wcale”.

### 3. Gra startuje dwa razy albo po wyjściu z ekranu
- **Ryzyko:** bramka otwiera się po odmontowaniu ekranu (np. gracz wyszedł w trakcie ładowania) albo powiadamia dwa razy, więc sterownik startuje ponownie.
- **Zabezpieczenie:** bramka powiadamia o gotowości dokładnie raz. Hook przy odmontowaniu wypisuje się z bramki i wstrzymuje jej czas graniczny (`stop()`), a sterownik startuje tylko z tego powiadomienia (`start` sterownika jest i tak odporny na ponowne wywołanie). `start()`/`stop()` bramki można powtarzać, bo React w trybie deweloperskim potrafi uruchomić efekt dwa razy, a jednorazowe „zniszczenie” bramki zablokowałoby grę na ekranie ładowania.
- **Test:** `loadingGate-test.ts` › „gotowość tylko raz”, „stop wstrzymuje czas graniczny, start liczy od nowa”.

### 4. Lektor mówi w trakcie ładowania
- **Ryzyko:** próbna synteza albo plansza rundy odtwarza się za zasłoną.
- **Zabezpieczenie:** próbna synteza tylko generuje plik, nie odtwarza go. Sterownik nie jest uruchomiony, więc w stanie gry nie ma pytania ani planszy, a `narrationFor` zwraca pustą listę.
- **Test:** `potato-narrator-test.ts` (stan przed startem = cisza); ręcznie na telefonie.

### 5. Lektor czyta zasady rund
- **Ryzyko:** gracz chce, żeby zasady były tylko napisane. Lektor czytał je przy każdej planszy i opóźniał start rundy.
- **Zabezpieczenie:** `narrationFor` dla planszy rundy zwraca tylko tytuł rundy. Zasada zostaje na planszy (`PHASE_RULE` w `PotatoGame`).
- **Test:** `potato-narrator-test.ts` › „plansza rundy: tylko tytuł, bez zasad”.
