# Skórki postaci

Moduły: `src/skins/` (katalog, przydział, wybór gracza, mimika), `src/hooks/useSelectedSkin.ts`, `src/hooks/useIdleFace.ts`, komponenty `src/components/skins/SkinFigure.tsx`, `src/components/home/PlayerAvatar.tsx`, ekran `src/app/skins.tsx`, skrypt `scripts/skins/remove_background.py`.
Testy: `src/skins/__tests__/`, `src/game/__tests__/bots-test.ts` (limit płci).
Logi: `[skorki]`.

Skórki leżą w `assets/skins/<male|female|player>/<id>/<id>-<normal|smile|closed-eyes>.png`, prowadzący w `assets/skins/host/`. Lista powstaje przy budowaniu paczki (`require.context`), więc nowy folder działa bez zmian w kodzie.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Nowa skórka nie działa albo trzeba ją dopisać w kodzie
**Ryzyko:** Metro wymaga statycznych `require`, więc lista na sztywno rozjechałaby się z folderem.
**Zabezpieczenie:** jedyne miejsce z plikami to `require.context` w `skinAssets.ts`; pula, id i mimika wynikają ze ścieżki (`buildCatalog`).
**Test:** `catalog-test.ts › nowy folder pojawia się bez zmian w kodzie`, `skins-integration-test.ts › nowa skórka trafia do losowania`.

### 2. Skórka z brakującą klatką, literówką w nazwie albo w nieznanym folderze
**Ryzyko:** wywrócenie gry przy starcie albo znikająca postać w środku rozgrywki.
**Zabezpieczenie:** brak `normal` to pominięcie skórki z `log.warn`; brak innej klatki to użycie `normal`; nieznany plik i folder są pomijane z ostrzeżeniem. Testowy skan prawdziwego folderu wymaga wszystkich 3 klatek, więc błąd wychodzi przed wydaniem.
**Test:** `catalog-test.ts › brak klatki normal`, `› brak innej klatki`, `› nieznany plik`, `real-assets-test.ts › każda skórka ma komplet klatek`.

### 3. Grafika bez przezroczystości
**Ryzyko:** trzy skórki (`male/002`, `male/003`, `player/201`) miały czarne tło zamiast kanału alfa, na scenie byłby czarny kwadrat. To samo może się zdarzyć przy nowej grafice.
**Zabezpieczenie:** `scripts/skins/remove_background.py` wycina tło od rogów (próg 12, wyższy naruszał czarny sweter skórki `201`). Test sprawdza kanał alfa każdego pliku.
**Test:** `real-assets-test.ts › każdy plik ma kanał alfa`; obrys obejrzany na kontrastowym tle.

### 4. Kobieta w męskiej skórce albo dwie takie same postacie
**Ryzyko:** złe dopasowanie płci, powtórka skórki w jednej grze.
**Zabezpieczenie:** `BotProfile.gender` jest polem wymaganym, więc nowy bot bez płci się nie skompiluje. `assignSkins` rozdaje każdą skórkę najwyżej raz, tylko z puli płci bota. Pula gracza (`player`) nie pokrywa się z pulami botów.
**Test:** `assignSkins-test.ts › płeć i brak powtórek na wielu ziarnach`.

### 5. Za mało skórek jednej płci
**Ryzyko:** botów jest po 4 z każdej płci, a skórek po 3. Wylosowanie 4 botów tej samej płci wymusiłoby powtórkę albo złą płeć.
**Zabezpieczenie:** `pickOpponents` przyjmuje limit płci równy liczbie skórek, więc taki skład nie powstaje. Gdy skórek jest za mało na całą grę (np. ktoś usunął folder), gra i tak rusza: bot bez skórki dostaje dotychczasowy rysunek zastępczy i `log.warn`, nigdy skórkę drugiej płci.
**Test:** `bots-test.ts › pickOpponents`, `assignSkins-test.ts › brak skórki`.

### 6. Skórki zmieniają przebieg gry
**Ryzyko:** dodatkowe losowania z generatora gry zmieniłyby wyniki gier z tego samego ziarna i symulacji.
**Zabezpieczenie:** silniki nie wiedzą o skórkach. Przydział używa osobnego generatora z ziarna gry. Limit działa tylko, gdy zostanie podany, i zużywa tyle samo losowań.
**Test:** `bots-test.ts › limit nie zmienia składu, gdy nie ma potrzeby`, istniejące `simulate-test.ts`.

### 7. Zapisany wybór jest uszkodzony albo skórki już nie ma
**Ryzyko:** po aktualizacji bez danej skórki albo po przerwanym zapisie gracz zostałby bez postaci.
**Zabezpieczenie:** `SkinSelectionStore` sprawdza zapis względem katalogu i w razie problemu bierze pierwszą skórkę. Błąd zapisu nie blokuje gracza: wybór działa do końca sesji, w logach jest `warn`. Zapisy idą po kolei, więc starszy nie nadpisze nowszego. Plik zapisuje `fileStorage` (przez plik tymczasowy).
**Test:** `SkinSelectionStore-test.ts`.

### 8. Miganie i zużycie pamięci przy mimice
**Ryzyko:** podmiana źródła obrazka na czas mrugnięcia mogłaby mignąć pustym polem; 6 postaci po 3 klatki 1254×1254 to ok. 110 MB nieskompresowanych bitmap.
**Zabezpieczenie:** klatki leżą jedna na drugiej i zmienia się tylko przezroczystość. `expo-image` zmniejsza obraz do rozmiaru widoku (`allowDownscaling`, domyślnie włączone). Klatki są wyrównane: różnią się tylko oczami albo ustami.
**Test:** ręcznie, ekran gry w przeglądarce; pamięć do sprawdzenia na telefonie.

### 9. Zegary mimiki działają po wyjściu z ekranu
**Ryzyko:** ustawianie stanu po odmontowaniu, zegary kumulujące się z każdą grą.
**Zabezpieczenie:** `IdleFace` ma `stop()` wywoływane w sprzątaniu efektu i po zatrzymaniu nie planuje nic więcej. Postać, która odpadła, nie mruga wcale.
**Test:** `IdleFace-test.ts › stop kasuje zegar`.

### 9a. Postać, która odpadła, jest nieczytelna
**Ryzyko:** sama przezroczystość daje wyblakłą postać, przez którą prześwituje tło, a nie przyciemnioną.
**Zabezpieczenie:** `SkinFigure` z `dimmed` kładzie pod klatką ciemną sylwetkę (`tintColor`). Postać ma otwarte oczy i nie mruga.
**Test:** ręcznie, zrzut ekranu z gry w rundzie 3.

### 10. Kolizje nazw zasobów na Androidzie
**Ryzyko:** Android spłaszcza ścieżkę assetu do nazwy zasobu i usuwa znaki inne niż litery, cyfry i `_`. Dwa pliki mogłyby dostać tę samą nazwę i pokazać złą grafikę tylko w APK.
**Zabezpieczenie:** test liczy nazwy tak jak Android i wymaga ich unikalności.
**Test:** `real-assets-test.ts › nazwy zasobów Androida są unikalne`.
