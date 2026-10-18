# Ekran rozgrywki

Pliki: `src/app/solo/game.tsx`, `src/components/solo/*`, `src/hooks/useSoloController.ts`, `src/hooks/useKeyboardHeight.ts`
Testy: `src/components/solo/__tests__/answerLayout-test.ts`, `src/game/__tests__/view-test.ts`, `src/game/__tests__/integration-test.ts`, ręczne w Expo Go
Logi: `[gra-solo] Nowa gra` (ziarno, poziom, gracze), `[klawiatura]` (otwarcie z wysokością i schowanie), `[ekran-gry] Gracz przerwał grę`.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Klawiatura zasłania pole odpowiedzi
**Ryzyko:** w Expo SDK 57 Android działa w trybie edge-to-edge, więc klawiatura przykrywa okno. W poziomie zajmuje 60–70% wysokości.
**Zabezpieczenie:** `useKeyboardHeight` zna wysokość klawiatury, a czysta funkcja `answerLayout` ustawia panel tuż nad nią. Przy małej ilości miejsca panel przechodzi w tryb kompaktowy. Wysokość klawiatury jest w logach, więc problem na konkretnym telefonie widać w terminalu.
**Test:** `answerLayout-test.ts` (4 testy), ręcznie na telefonie.

### 2. Pełnoekranowe pole edycji Androida w poziomie
**Ryzyko:** Android w poziomie otwiera pole edycji na cały ekran i zasłania grę.
**Zabezpieczenie:** `disableFullscreenUI` w polu odpowiedzi.
**Test:** ręcznie na telefonie.

### 3. Pole traci fokus i wpisany tekst
**Ryzyko:** przełączanie między dwoma różnymi panelami (z klawiaturą i bez) odmontowałoby pole tekstowe.
**Zabezpieczenie:** to ten sam panel, zmienia się tylko styl.
**Test:** ręcznie na telefonie.

### 4. Wyjście z gry przypadkiem
**Ryzyko:** systemowy „wstecz” albo przycisk przerwania kończy grę bez pytania.
**Zabezpieczenie:** potwierdzenie „Przerwać grę?”, a na czas okna gra jest wstrzymana. Wyjście jest logowane. Na ekranie gry gest cofania jest wyłączony (`gestureEnabled: false`).
**Test:** pauza: `controller-test.ts › zatrzymuje licznik i wznawia go z pozostałym czasem`, okno: ręcznie.

### 5. Nieprawidłowy poziom trudności w adresie
**Ryzyko:** parametr `difficulty` z adresu może być dowolnym tekstem.
**Zabezpieczenie:** wartość jest dopasowywana do `DIFFICULTIES`. Nieznana daje `normal`.
**Test:** przegląd kodu (`src/app/solo/game.tsx`).

### 6. Gra na telefonie nie do odtworzenia
**Ryzyko:** gra losuje ziarno z `Date.now()`, więc błędu z telefonu nie da się powtórzyć.
**Zabezpieczenie:** ziarno jest logowane przy starcie gry. Wystarczy wpisać je w `createRng(seed)`, żeby dostać identyczną grę.
**Test:** `integration-test.ts › to samo ziarno daje identyczny przebieg całej gry`.

### 7. Długie imiona ucięte na pulpicie
**Ryzyko:** „Kapitan Marek” nie mieści się na małym pulpicie.
**Zabezpieczenie:** `adjustsFontSizeToFit`.
**Test:** zrzuty ekranu z przeglądarki, ręcznie na telefonie.
