# Multiplayer: tworzenie pokoju i poczekalnia

Moduły serwera: `server/src/protocol.ts` (typy i sprawdzanie wiadomości), `server/src/rooms.ts` (`RoomRegistry`: pokoje w pamięci), `server/src/app.ts` (połączenia, rozsyłanie stanu pokoju, heartbeat), `server/scripts/smoke.ts` (create + join na działającym serwerze).
Moduły aplikacji: `src/multiplayer/protocol.ts` (kopia typów), `nick.ts`, `roomCode.ts`, `RoomClient.ts` (WebSocket), `roomStore.ts` (stan dla ekranów), `nickStore.ts` (zapamiętany nick); ekrany `src/app/multiplayer/` (`index.tsx` nick + wybór, `join.tsx` kod, `lobby.tsx` poczekalnia).
Testy: `server/src/__tests__/rooms.test.ts`, `server/src/__tests__/app.test.ts`, `src/multiplayer/__tests__/`.
Logi: serwer `{"tag":"serwer"}` / `{"tag":"pokoje"}`, aplikacja `[multiplayer]`.

Zakres: gracz podaje nick, tworzy pokój (serwer losuje kod) albo dołącza kodem. Wszyscy w pokoju widzą na żywo listę graczy (maks. 5). Rozgrywki jeszcze nie ma.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Dwa pokoje z tym samym kodem
**Ryzyko:** losowy kod trafia na istniejący pokój. Drugi twórca „przejmuje” cudzy pokój albo gracze lądują w złej poczekalni.
**Zabezpieczenie:** `RoomRegistry` losuje kod, dopóki nie znajdzie wolnego (alfabet 32 znaki, 5 znaków ≈ 33 mln kodów, a pokoi jest maks. 200). Po 50 nieudanych próbach zwraca błąd zamiast pętli bez końca.
**Test:** `rooms.test.ts › kod zajęty: losuje następny`, `› generator zawsze trafia w zajęty kod: błąd, nie pętla`.

### 2. Kod źle przepisany z ekranu kolegi
**Ryzyko:** `0` i `O`, `1` i `I`, małe litery, spacja na końcu. Gracz wpisuje kod poprawnie z jego punktu widzenia, a dostaje „nie ma takiego pokoju”.
**Zabezpieczenie:** kody nie zawierają `0 O 1 I`. Serwer i aplikacja normalizują wpis (`trim`, wielkie litery, bez spacji w środku). Pole w aplikacji ma `autoCapitalize="characters"` i limit 5 znaków.
**Test:** `rooms.test.ts › join akceptuje małe litery i spacje`, `roomCode-test.ts`.

### 3. Szósty gracz w pokoju na 5
**Ryzyko:** dwóch graczy dołącza w tej samej chwili do pokoju z 4 osobami i obaj wchodzą.
**Zabezpieczenie:** Node obsługuje wiadomości po kolei w jednym wątku, a `join` sprawdza limit i dodaje gracza w jednym synchronicznym kroku. Szósty dostaje `room-full`.
**Test:** `rooms.test.ts › szósty gracz dostaje room-full`, `app.test.ts › pełny pokój`.

### 4. Zły albo zdublowany nick
**Ryzyko:** pusty nick, same spacje, 200 znaków (rozjeżdża listę), dwóch „Bartek” w jednym pokoju.
**Zabezpieczenie:** `normalizeNick` przycina i skleja spacje, a nick musi mieć 2–16 znaków. Ta sama reguła jest w aplikacji (przycisk wyłączony) i na serwerze (`nick-invalid`), bo serwer nie może ufać klientowi. Nick zajęty w pokoju bez względu na wielkość liter daje `nick-taken`.
**Test:** `rooms.test.ts › nick zajęty`, `› nick za krótki / za długi`, `nick-test.ts`.

### 5. Gracz zamyka aplikację i „wisi” w poczekalni
**Ryzyko:** telefon traci zasięg albo gracz zabija aplikację. Socket nie wysyła `close`, więc pozostali widzą gracza, którego nie ma, a pokój nigdy nie znika.
**Zabezpieczenie:** zamknięcie połączenia usuwa gracza i rozsyła nową listę. Heartbeat co 30 s (ramka ping z `ws`): połączenie bez odpowiedzi do następnego pinga jest zrywane (`terminate`), więc gracz znika najpóźniej po ok. 60 s.
**Test:** `app.test.ts › rozłączenie usuwa gracza z listy u pozostałych`, `› heartbeat zrywa połączenie, które nie odpowiada`.

### 6. Host wychodzi
**Ryzyko:** pokój zostaje bez hosta i nikt nie może później wystartować gry.
**Zabezpieczenie:** po wyjściu hosta hostem zostaje najdłużej obecny gracz. Ostatni gracz wychodzi, więc pokój jest usuwany (bez wycieku pamięci).
**Test:** `rooms.test.ts › wyjście hosta przekazuje koronę`, `› pusty pokój znika`.

### 7. Pamięć serwera
**Ryzyko:** ktoś w pętli tworzy pokoje. Kontener ma 0,5 GiB.
**Zabezpieczenie:** jedno połączenie może być naraz tylko w jednym pokoju (`already-in-room`), maks. 200 pokoi (`too-many-rooms`), `maxPayload` 16 KiB zostaje.
**Test:** `rooms.test.ts › limit pokoi`, `app.test.ts › drugi create z tego samego połączenia`.

### 8. Zimny start i brak serwera
**Ryzyko:** przy `min-replicas 0` pierwsze połączenie czeka kilkanaście sekund albo adres jest pusty. Ekran wisi na „łączę…” bez końca.
**Zabezpieczenie:** `RoomClient` przerywa łączenie po `SERVER_TIMEOUT_MS` (15 s) z komunikatem o uruchamianiu serwera. Brak `EXPO_PUBLIC_SERVER_URL` daje od razu komunikat, co wpisać. Zerwanie w poczekalni pokazuje komunikat i przycisk powrotu.
**Test:** `RoomClient-test.ts › przekroczony czas łączenia`, `› brak adresu`, `› zerwane połączenie w pokoju`.

### 9. Odpowiedź przychodzi do ekranu, którego już nie ma
**Ryzyko:** gracz klika „Stwórz” i od razu „Wróć”. Spóźniona odpowiedź `room` wrzuca go do poczekalni, z której wyszedł, a socket zostaje otwarty.
**Zabezpieczenie:** `roomStore.leave()` zamyka socket i odpina obsługę zdarzeń, a wiadomości ze starego połączenia są ignorowane (sprawdzanie numeru połączenia).
**Test:** `roomStore-integration-test.ts › wyjście w trakcie łączenia: spóźniona odpowiedź nie zmienia stanu`.

### 10. Protokół w aplikacji i na serwerze się rozjeżdża
**Ryzyko:** typy wiadomości są w dwóch kopiach (`server/src/protocol.ts` i `src/multiplayer/protocol.ts`), bo `server/` jest poza `tsc` aplikacji. Zmiana tylko po jednej stronie psuje grę bez błędu kompilacji.
**Zabezpieczenie:** obie kopie mają komentarz z odnośnikiem do drugiej. Klient odrzuca nieznane i źle zbudowane wiadomości (`parseServerMessage`) i loguje je jako `warn`, czyli widać to na ekranie w Expo Go. Docelowo wspólny pakiet razem z przeniesieniem silnika.
**Test:** `RoomClient-test.ts › nieznana wiadomość serwera: warn, stan bez zmian`.

### 11. Restart kontenera kasuje pokoje
**Ryzyko:** pokoje są w pamięci. Nowa wersja albo uśpienie kontenera usuwa wszystkie, a druga replika nie widziałaby pokoi pierwszej.
**Zabezpieczenie:** `--max-replicas 1`. Przy `SIGTERM` serwer zamyka sockety kodem 1001, a aplikacja pokazuje „połączenie z serwerem zostało przerwane”. Na tym etapie świadomie się na to godzimy, a trwały stan (baza) dojdzie razem z kontami.
**Test:** `app.test.ts › close() zamyka otwarte połączenia kodem 1001`; ręcznie `az containerapp show … --query properties.template.scale`.

### 12. Nick w logach
**Ryzyko:** nicki to dane wpisane przez użytkownika. Logowanie całych list zapycha Log Analytics i zostawia dane osobowe w logach.
**Zabezpieczenie:** logi zawierają tylko `connectionId`, kod pokoju, liczbę graczy i powód błędu, bez nicków.
**Test:** przegląd kodu; `app.test.ts` sprawdza wpisy logów przy tworzeniu pokoju.

### 13. Ekran przerysowuje się w trakcie znikania
**Ryzyko:** zmiana stanu i nawigacja w tej samej chwili, np. „w pokoju” → `router.replace` na poczekalnię albo „Wyjdź” → stan „idle” → powrót. Ekran, który właśnie znika, dostaje nowe widoki, a Fabric na Androidzie rzuca `addViewAt: View already has a parent`. Aplikacja się restartuje i gracz wypada z pokoju (zdarzyło się, 7.76).
**Zabezpieczenie:** ekran dołączania traktuje „w pokoju” jak „łączę”, więc nic się na nim nie zmienia przed przejściem. Poczekalnia trzyma ostatni stan inny niż „idle” i nie czyści się przy wyjściu. Wyjście nawiguje tylko raz (flaga `removing`, ustawiana też w `beforeRemove`).
**Test:** ręcznie na dwóch telefonach: dołączenie kodem, „Wyjdź”, strzałka wstecz i systemowe „wstecz” w poczekalni, „Wróć” po błędzie. Logika stanów: `RoomClient-test.ts`.
