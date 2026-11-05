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

### 4. Ten sam bot za każdym razem wygląda inaczej albo dwie takie same postacie
**Ryzyko:** losowana skórka zmienia wygląd bota w każdej grze, a dwa boty z tą samą skórką wyglądałyby tak samo.
**Zabezpieczenie:** `BotProfile.skinId` jest polem wymaganym i jedynym miejscem przypisania skórki do bota, a `assignSkins` nic nie losuje. Test pilnuje, że każde `skinId` jest unikalne i wskazuje pulę `male` albo `female`. Pula gracza (`player`) nie pokrywa się z pulami botów.
**Test:** `skins-integration-test.ts › ten sam bot ma tę samą skórkę w każdej grze`, `bots-test.ts › każdy bot ma własne imię i własną skórkę z puli botów`.

### 5. Bot, którego skórki jeszcze nie ma, albo skórka bez bota
**Ryzyko:** skórki dochodzą stopniowo, więc bot z pustym folderem wszedłby do gry z rysunkiem zastępczym. Skórka z literówką w `skinId` nigdy by się nie pojawiła i nikt by tego nie zauważył.
**Zabezpieczenie:** `pickOpponents` dostaje zbiór istniejących skórek i losuje tylko ich właścicieli. Gdy botów ze skórką jest za mało (np. ktoś usunął foldery), gra i tak rusza: reszta dostaje rysunek zastępczy i `log.warn`. Test na prawdziwym folderze wymaga co najmniej 4 botów ze skórką i właściciela dla każdej skórki. Log `Nowa gra w rundach` podaje `botsWithSkin`.
**Test:** `bots-test.ts › bot bez istniejącej skórki nigdy nie jest losowany`, `real-assets-test.ts › każda skórka bota ma właściciela`.

### 6. Skórki zmieniają przebieg gry
**Ryzyko:** dodatkowe losowania z generatora gry zmieniłyby wyniki gier z tego samego ziarna.
**Zabezpieczenie:** silniki nie wiedzą o skórkach, a `assignSkins` nie losuje. Filtr w `pickOpponents` tasuje całą listę, więc zużywa tyle samo losowań. Inny zestaw skórek zmienia jednak skład botów, więc do odtworzenia gry z ziarna potrzebne są te same skórki.
**Test:** `bots-test.ts › zużywa tyle samo losowań`, `gdy wszystkie skórki istnieją, skład jest taki sam jak bez filtra`.

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
