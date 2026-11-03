# Serwer testowy (Azure Container Apps) i sprawdzanie połączenia z aplikacji

Moduły serwera: `server/src/app.ts` (HTTP `/health` + WebSocket `/ws`), `server/src/main.ts` (start, `SIGTERM`), `server/src/log.ts`, `server/scripts/smoke.ts` (test działającego serwera), `server/Dockerfile`.
Moduły aplikacji: `src/backend/serverHealth.ts` (`checkServer`), `src/backend/serverUrl.ts` (adres z `EXPO_PUBLIC_SERVER_URL`), sekcja „Serwer” w `src/app/settings.tsx`.
Testy: `server/src/__tests__/app.test.ts`, `src/backend/__tests__/serverHealth-test.ts`, `src/backend/__tests__/serverHealth-integration-test.ts`.
Logi: serwer – JSON na stdout (`{"tag":"serwer",...}`), aplikacja – `[backend]`.
Instrukcja wdrożenia: `docs/backend-azure-instrukcja.md`.

Serwer jest na razie tylko „szkieletem”: pokazuje, że kontener działa w chmurze i że telefon się z nim łączy (HTTP i WebSocket). Na nim powstaną potem pośrednik OpenAI, baza pytań, Eliminacje i multiplayer.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Kredyt studencki się kończy
**Ryzyko:** kontener działa całą dobę albo uruchamia się w wielu kopiach i w kilka tygodni zużywa 100 USD z Azure for Students. Nikt tego nie zauważa, bo nie ma alertów.
**Zabezpieczenie:** instrukcja zaczyna wdrożenie od budżetu z alertami (Cost Management). Kontener ma `--min-replicas 0` (bez ruchu nic nie działa), `--max-replicas 1` i najmniejszy rozmiar (0,25 vCPU, 0,5 GiB). Obraz trzymamy w darmowym GHCR zamiast płatnego Azure Container Registry. Na koniec projektu: `az group delete`.
**Test:** ręcznie – po wdrożeniu `az containerapp show … --query properties.template.scale` pokazuje `minReplicas: 0, maxReplicas: 1`.

### 2. Zła wiadomość wywraca serwer
**Ryzyko:** klient wysyła nie-JSON, JSON bez `type` albo nieznany typ. Nieobsłużony wyjątek w obsłudze wiadomości zabija proces, a razem z nim wszystkie połączenia.
**Zabezpieczenie:** obsługa wiadomości jest w `try/catch`, a na złą wiadomość serwer odpowiada `{ type: "error", reason }` i połączenie zostaje otwarte.
**Test:** `app.test.ts › zły JSON: odpowiedź error, połączenie dalej działa`, `› nieznany typ wiadomości`.

### 3. Za duża wiadomość zajmuje pamięć
**Ryzyko:** ktoś wysyła wiadomość mającą kilkadziesiąt MB. Kontener ma 0,5 GiB pamięci, więc taka wiadomość może go zabić.
**Zabezpieczenie:** `WebSocketServer({ maxPayload: 16 KiB })` – większa wiadomość zamyka połączenie kodem 1009, a serwer działa dalej.
**Test:** `app.test.ts › za duża wiadomość zamyka tylko to połączenie`.

### 4. Sekrety trafiają do obrazu Dockera
**Ryzyko:** `docker build` kopiuje `.env.local` z kluczem OpenAI albo `node_modules` z maszyny dewelopera. Obraz w publicznym GHCR ujawnia klucz.
**Zabezpieczenie:** obraz budowany jest tylko z katalogu `server/` (kontekst Dockera nie widzi `.env.local` z korzenia). `server/.dockerignore` wyklucza `.env*`, `node_modules` i testy. Hak `.githooks/pre-commit` dalej blokuje commit kluczy.
**Test:** ręcznie – `docker run --rm jzw-server ls -a /app` pokazuje tylko `dist`, `node_modules`, `package*.json`.

### 5. Azure zatrzymuje kontener w trakcie połączeń
**Ryzyko:** przy skalowaniu do zera albo przy nowej wersji Container Apps wysyła `SIGTERM`. Bez obsługi proces kończy się od razu, a klienci dostają zerwane połączenie bez kodu zamknięcia.
**Zabezpieczenie:** `main.ts` na `SIGTERM` zamyka serwer (`close()` – kod 1001 dla otwartych WebSocketów), loguje to i kończy proces. Gdy zamykanie się zawiesi, po 10 s proces kończy się mimo to.
**Test:** `app.test.ts › close() zamyka otwarte połączenia kodem 1001`.

### 6. Zimny start wygląda jak awaria
**Ryzyko:** przy `min-replicas 0` pierwsze zapytanie po przerwie czeka kilka sekund na uruchomienie kontenera. Gracz widzi „brak połączenia”, choć serwer działa.
**Zabezpieczenie:** `checkServer` czeka do 15 s (`SERVER_TIMEOUT_MS`). Po przekroczeniu czasu komunikat mówi wprost, że serwer mógł się dopiero uruchamiać i warto spróbować ponownie. Skrypt `smoke` ma limit 30 s.
**Test:** `serverHealth-test.ts › przekroczony czas: komunikat o uruchamianiu serwera`.

### 7. Aplikacja nie zna adresu serwera albo adres jest zły
**Ryzyko:** brak `EXPO_PUBLIC_SERVER_URL` w `.env.local`, adres bez `https://` albo z ukośnikiem na końcu (`…/` + `/health` = `//health`). Przycisk rzuca wyjątek albo pyta nie tam, gdzie trzeba.
**Zabezpieczenie:** `normalizeServerUrl` przycina spacje i końcowe `/` oraz przyjmuje tylko `http://` i `https://`. Bez adresu przycisk jest wyłączony, a ekran wyjaśnia, co wpisać do `.env.local`.
**Test:** `serverHealth-test.ts › normalizeServerUrl` (przypadki `it.each`), `› brak adresu`.

### 8. Odpowiedź nie od naszego serwera
**Ryzyko:** pod adresem odpowiada coś innego: strona błędu Azure (HTML z kodem 404 przy złym `target-port`), portal w hotelowym Wi-Fi albo JSON innego kształtu. Aplikacja pokazałaby „połączono”, choć serwera gry tam nie ma.
**Zabezpieczenie:** `checkServer` uznaje sukces tylko przy statusie 2xx i odpowiedzi `{ status: "ok", version: string }`. Błędny status, zły JSON i inny kształt mają osobne komunikaty.
**Test:** `serverHealth-test.ts › status 500`, `› odpowiedź nie jest JSON-em`, `› JSON bez status ok`.

### 9. Nieznana trasa albo zła metoda
**Ryzyko:** skanery z internetu wysyłają zapytania pod losowe ścieżki, a serwer odpowiada wyjątkiem albo wisi bez odpowiedzi.
**Zabezpieczenie:** każda trasa poza `GET /health` dostaje `404` z JSON-em, a upgrade WebSocket poza `/ws` jest odrzucany (gniazdo zamknięte).
**Test:** `app.test.ts › nieznana trasa: 404`, `› WebSocket pod złą ścieżką jest odrzucany`.

### 10. Testy serwera psują testy aplikacji
**Ryzyko:** `server/` ma własne `node_modules`, `tsconfig` i testy w Node. Jest z presetem `jest-expo`, `tsc` i ESLint w korzeniu próbowałyby je przetwarzać, przez co testy i lint aplikacji przestałyby przechodzić.
**Zabezpieczenie:** korzeń wyklucza `server/` (`tsconfig.json › exclude`, `jest.testPathIgnorePatterns`, `eslint.config.js › ignores`). Serwer ma osobne `npm test` i `npm run build`.
**Test:** `npm test`, `npx tsc --noEmit`, `npx expo lint` w korzeniu oraz `npm test` w `server/` przechodzą.
