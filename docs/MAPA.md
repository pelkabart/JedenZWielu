# Mapa projektu (co zmieniam → gdzie)

Krótki spis dla szybkiej pracy, a nie dokumentacja. Aktualizuj go, gdy dochodzi albo znika moduł lub plik.

## Przepływ gry
1. `src/app/solo/game.tsx`: ekran. Bierze poziom i kategorię z parametrów i renderuje `PotatoGame`.
2. `src/hooks/usePotatoController.ts`: tworzy sterownik, lektora (`PotatoNarrator`) i bramkę ładowania (`loadingGate.ts`). Sterownik startuje dopiero, gdy wszystko się wczyta.
3. `src/game/potato/controller/PotatoController.ts`: czas rzeczywisty (wstrzyknięty zegar, `schedule()` uwzględnia pauzę), tury botów, nakładki (`reveal` / `round` / `lifeBonus` / `finished`), czekanie na lektora.
4. `src/game/potato/engine.ts`: czyste zasady `reducePotato(state, action)` i stałe `POTATO`. Bez logów i losowania.
5. `src/components/potato/PotatoGame.tsx`: cały ekran rozgrywki. Kwestie lektora daje `narrationFor(view)` w `src/narration/PotatoNarrator.ts`.

## Chcę zmienić X → plik
| Co | Gdzie |
|---|---|
| Liczby zasad (szanse, punkty, czas sprintu, mnożnik) | `POTATO` w `game/potato/engine.ts` |
| Logika rundy (osłona, utrata szans, przejścia faz, premia za szanse) | `engine.ts`: `answerRound1/2`, `answerSprint`, `answerDuel`, `enterRound2`, `enterSprint`, `finishSprint` |
| Tytuły i zasady na planszach rund | `game/potato/texts.ts` (`PHASE_TITLE`, `PHASE_RULE`) |
| Trudność botów (modyfikatory poziomów) | `game/rules.ts` (`DIFFICULTY_PRESETS`); **`game/bots/profiles.ts` jest nietykalny** |
| Jak bot odpowiada (szansa, pomyłki, czas) | `game/bots/brain.ts` |
| Kogo bot wskazuje, limit pytań bez gracza | `game/potato/bots.ts` (`pickTarget`, `MAX_QUESTIONS_WITHOUT_HUMAN`) |
| Skład gry (człowiek + 4 boty, miejsca) | `game/potato/solo.ts` |
| Czasy: wynik, plansze, animacja premii, limity wskazania | `DEFAULT_POTATO_PACING`, `PICK_TIMEOUT_MS` w `PotatoController.ts` |
| Lampki, osłona, premia, kto podświetlony | `components/potato/gameDisplay.ts` (czyste funkcje) + `components/solo/Podium.tsx` |
| Napisy na środku („BUM!”, ×2, „TRACISZ OSŁONĘ”) | `components/potato/MultiplierBadge.tsx` |
| Pytanie, odpowiedź ABCD lub wpisywana, mikrofon | `components/solo/QuestionCard.tsx`, `AnswerPanel.tsx`, `answerLayout.ts`, `TimerBar.tsx` |
| Licznik wskazania gracza | `components/potato/PickCountdown.tsx` |
| Tabela wyników na końcu | `components/potato/Scoreboard.tsx` + `scoreboardData.ts` |
| Ekran ładowania | `components/potato/loadingGate.ts` (logika) + `LoadingScreen.tsx` |
| Co i kiedy mówi lektor | `narration/PotatoNarrator.ts` |
| Silnik głosu (Piper / sherpa-onnx), rozgrzewka | `narration/sherpaVoice.ts`, interfejs `narration/voice.ts` |
| Wymowa i intonacja | `narration/pronunciation.ts`, `questionIntonation.ts` |
| Głośność i włączniki muzyki/lektora | `settings/VolumeStore.ts` (zapis), `settings/volume.ts` (wspólny magazyn), `audio/volume.ts` (wzmocnienie), `app/settings.tsx`, `components/settings/VolumeSlider.tsx` |
| Muzyka | `audio/menuMusic.ts`, `audio/gameMusic.ts`, na których ekranach: `audio/menuMusicRoutes.ts`, `hooks/useMenuMusic.ts` |
| Skórki i mimika | `skins/` (`catalog.ts` z `require.context`, `assignSkins.ts`, `IdleFace.ts`), `components/skins/SkinFigure.tsx`, `components/solo/Host.tsx`, ekran `app/skins.tsx` |
| Kategorie z plików przez OpenAI, import/eksport `.kat` | `categories/` (`openaiGenerator.ts`, `QuestionSetStore.ts`, `transferQuestionSet.ts`, `device/`), ekrany `app/categories/`, klucz z `.env.local`: `settings/configApiKey.ts` |
| Odpowiedzi głosem | `speech/` (`VoiceAnswerSession.ts`, `spokenAnswer.ts`, `expoRecognizer.ts`), `hooks/useVoiceAnswer.ts` |
| Sprawdzanie wpisanej odpowiedzi (literówki) | `game/answers.ts` |
| Opcje ABCD z pytania | `game/choices.ts` |
| Baza pytań i jej walidacja | `data/questions.json`, `game/questions.ts` |
| Menu, wybór trybu i poziomu | `app/index.tsx`, `app/solo/index.tsx`, `app/solo/categories.tsx`, `components/home/` |
| Kolory i motyw | `constants/theme.ts` |
| Logi | `lib/log.ts` (`createLogger('<tag>')`) |
| Test połączenia z serwerem | `backend/serverHealth.ts`, `backend/serverUrl.ts` |

## Testy (który plik sprawdza co)
- Silnik: `game/potato/__tests__/potato-test.ts`. Sterownik na udawanym zegarze: `controller-test.ts`.
- Całe gry (prawdziwa baza i boty, Jest fake timers): `game/__tests__/integration-test.ts`. Boty: `bots-test.ts`.
- Ekran (czyste funkcje): `components/potato/__tests__/gameDisplay-test.ts`, `scoreboardData-test.ts`, `loadingGate-test.ts`.
- Lektor: `narration/__tests__/potato-narrator-test.ts`, `narration-integration-test.ts`.
- Głośność: `settings/__tests__/VolumeStore-test.ts`, `volume-integration-test.ts`, `audio/__tests__/volume-test.ts`.
- Skórki: `skins/__tests__/` (`real-assets-test.ts` sprawdza prawdziwe pliki).
- Pomocnicze funkcje testów: `game/testing/`, `narration/testing/`, `skins/testing/`, `speech/testing/`, `categories/testing/`.
- Uwaga: testy silnika i sterownika używają `POTATO.*` albo konkretnych liczb (np. lifeBonus 20). Zmiana zasad wymaga poprawek w `potato-test`, `controller-test` i asercjach w `integration-test`.

## Dokumentacja przy zmianie
- Zasady rund, osłona, sprint, premia: `docs/zabezpieczenia/rundy-goracy-ziemniak.md`.
- Inne obszary: `boty.md`, `limit-pytan-botow.md`, `lektor.md`, `ekran-ladowania.md`, `ustawienia-glosnosc.md`, `skorki.md`, `tabela-wynikow.md`, `kategorie-pytan.md`, `kategorie-import-eksport.md`, `odpowiedzi-glosem.md`, `muzyka-menu.md`, `muzyka-gra.md`, `logowanie.md`, `formaty-odpowiedzi.md`.
- `silnik-gry.md`, `sterownik-gry.md`, `symulator.md` to archiwum: opisują usunięte moduły, nie aktualizujemy ich.
- `docs/Dokumentacja_postepow_prac.md` jest duży, więc nie czytaj go w całości. Zmieniaj w nim przez grep tylko trzy rzeczy: wiersz w tabeli stanu (sekcja 1), licznik „Razem” w tabeli stanu i w tabeli testów (sekcja 6) oraz nowy wpis `**7.N.**` na końcu sekcji 7 (przed `## 8.`).

## Nie ruszać
- `src/game/bots/profiles.ts`: należy do właściciela projektu.
- Zależności natywne w `package.json`: jest na nie zbudowany dev build.
- `server/`: na razie bez zmian. `android/` i `ios/` są generowane.
