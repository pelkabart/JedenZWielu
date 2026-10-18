# Odpowiadanie głosem

Moduły: `src/speech/` (`VoiceAnswerSession.ts`, `spokenAnswer.ts`, `expoRecognizer.ts`), `src/hooks/useVoiceAnswer.ts`, `src/components/solo/AnswerPanel.tsx`, `setListening` w `src/game/controller/SoloController.ts`
Testy: `src/speech/__tests__/spokenAnswer-test.ts`, `src/speech/__tests__/VoiceAnswerSession-test.ts`, `src/speech/__tests__/voice-answer-integration-test.ts`, `src/narration/__tests__/NarrationDirector-test.ts` (mikrofon ucisza lektora), `src/game/__tests__/controller-test.ts` (blok „mikrofon”)

Na pytanie można odpowiedzieć na dwa sposoby: wpisać odpowiedź albo ją powiedzieć. Przycisk z mikrofonem obok pola odpowiedzi włącza rozpoznawanie mowy Androida (`expo-speech-recognition`, język `pl-PL`). W trakcie mówienia rozpoznany tekst pojawia się w polu odpowiedzi. Gdy gracz skończy, odpowiedź jest zatwierdzana tak samo jak wpisana (`controller.submitAnswer`), więc sprawdzanie, literówki i liczenie czasu się nie zmieniają.

## Co może pójść nie tak i jak to zabezpieczamy

### 1. Mikrofon słyszy lektora
**Ryzyko:** gdy przychodzi kolej gracza, prowadzący mówi „Twoja kolej!…”. Gdyby gracz od razu włączył mikrofon, rozpoznawanie mogłoby złapać głos lektora jako odpowiedź.
**Zabezpieczenie:** włączenie mikrofonu ustawia w sterowniku `listening`, a dyrektor lektora na ten widok przerywa wypowiedź i nie zaczyna nowej, dopóki mikrofon słucha.
**Test:** `NarrationDirector-test.ts › mikrofon ucisza lektora i nie pozwala mu zacząć`, `voice-answer-integration-test.ts › gracz odpowiada głosem przez całą grę; w czasie słuchania lektor milczy`.

### 2. Rozpoznany tekst nie pasuje do zapisu odpowiedzi
**Ryzyko:** rozpoznawanie mowy zapisuje odpowiedzi inaczej niż baza: „Mieszko pierwszy” zamiast „Mieszko I”, „tysiąc czterysta dziesięć” zamiast „1410”, wielkie litery, kropka na końcu. Dobra odpowiedź byłaby uznana za złą.
**Zabezpieczenie:** `normalizeSpokenAnswer` zamienia liczebniki porządkowe po imieniu na cyfry rzymskie. Normalizacja z `answers.ts` (wielkość liter, interpunkcja, polskie znaki, literówki) działa tak samo jak dla tekstu wpisanego. Rozpoznawanie zwraca kilka wersji tego, co usłyszało (`maxAlternatives`). Wybieramy pierwszą, którą sprawdzanie uznaje za poprawną, a jeśli żadna nie pasuje, najbardziej prawdopodobną. Tak samo zachowałby się prowadzący, który dobrze usłyszał odpowiedź. Liczby słownie zwykle przychodzą już jako cyfry (Android sam je zamienia).
**Test:** `spokenAnswer-test.ts`.

### 3. Odpowiedź zatwierdzona dwa razy albo po czasie
**Ryzyko:** rozpoznawanie może zwrócić wynik końcowy, gdy gracz już wpisał i zatwierdził odpowiedź, albo gdy minął czas. Wtedy padłyby dwie odpowiedzi albo odpowiedź na następne pytanie.
**Zabezpieczenie:** sesja zatwierdza najwyżej jedną odpowiedź i tylko dla pytania, przy którym ją włączono. Zmiana pytania albo zamknięcie panelu przerywa rozpoznawanie (`abort`). Sterownik i tak przyjmuje odpowiedź tylko wtedy, gdy czeka na ruch gracza (zabezpieczenie z etapu 4).
**Test:** `VoiceAnswerSession-test.ts › dispose przerywa słuchanie, a wynik po zakończeniu sesji jest ignorowany`, `› zatwierdza najwyżej jedną odpowiedź`, `› zgoda przyszła po zamknięciu panelu: nie włącza mikrofonu`, `voice-answer-integration-test.ts › odpowiedź głosem po czasie nie liczy się`.

### 4. Gracz nie dał zgody na mikrofon albo telefon nie ma rozpoznawania mowy
**Ryzyko:** odmowa uprawnienia, emulator bez usługi Google albo brak modułu natywnego (Expo Go). Gra nie może się na tym zatrzymać.
**Zabezpieczenie:** przycisk mikrofonu pojawia się tylko wtedy, gdy rozpoznawanie jest dostępne. Odmowa zgody kończy sesję z komunikatem, a pole do wpisywania działa dalej. Moduł natywny jest ładowany dopiero przy sprawdzaniu dostępności, w `try/catch`.
**Test:** `VoiceAnswerSession-test.ts › brak zgody na mikrofon: komunikat i można dalej pisać`, `› błąd rozpoznawania: komunikat, sesja kończy się`.

### 5. Nic nie usłyszano
**Ryzyko:** gracz włączył mikrofon i milczał albo mówił za cicho. Pusta odpowiedź zostałaby uznana za złą i kosztowała szansę.
**Zabezpieczenie:** pusty wynik albo błąd `no-speech` nie zatwierdza odpowiedzi. Gracz widzi komunikat „Nie usłyszałem odpowiedzi” i może spróbować jeszcze raz albo wpisać.
**Test:** `VoiceAnswerSession-test.ts › pusty wynik nie jest zatwierdzany`, `› cisza (no-speech) to komunikat, a nie błąd`.

### 6. Mikrofon zostaje włączony
**Ryzyko:** gracz wychodzi z gry albo mija czas, a rozpoznawanie dalej słucha (zużycie baterii, ikona mikrofonu w systemie, prywatność).
**Zabezpieczenie:** odmontowanie panelu, zmiana pytania i pauza gry wołają `abort()`. `listening` w sterowniku jest wyłączane przy każdym końcu sesji, także po błędzie.
**Test:** `VoiceAnswerSession-test.ts › dispose przerywa słuchanie, a wynik po zakończeniu sesji jest ignorowany`, `› anulowanie (pauza) przerywa słuchanie bez odpowiedzi, potem można zacząć od nowa`, `voice-answer-integration-test.ts › pauza gry w czasie słuchania wyłącza mikrofon`, `› gracz odpowiada głosem przez całą grę…` (po każdej odpowiedzi `listening` jest wyłączone).

### 7. Uprawnienie do mikrofonu w Google Play
**Ryzyko:** `RECORD_AUDIO` to uprawnienie „niebezpieczne”, Google Play wymaga uzasadnienia w opisie aplikacji.
**Zabezpieczenie:** uprawnienie dodaje tylko wtyczka `expo-speech-recognition` (z opisem po polsku), `expo-audio` nadal ma `recordAudioAndroid: false`. O zgodę pytamy dopiero przy pierwszym dotknięciu mikrofonu, nie przy starcie aplikacji.
**Test:** przegląd `app.json`; ręcznie na emulatorze.

### 8. Wersja biblioteki niezgodna z Expo SDK
**Ryzyko:** `npx expo install expo-speech-recognition` zainstalował wersję 58.0.0, a projekt jest na Expo SDK 57. To paczka spoza Expo, więc `expo install` nie zna jej zgodności z SDK i bierze najnowszą. Niezgodna wersja mogłaby się nie zbudować albo wywrócić aplikację.
**Zabezpieczenie:** wersja `^57.1.1`, czyli gałąź dla SDK 57 wskazana w README biblioteki.
**Test:** budowanie APK i uruchomienie na emulatorze.
