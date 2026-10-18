# Zabezpieczenia – co mogło pójść nie tak

W tym folderze zapisujemy, co mogło się nie udać przy tworzeniu danej funkcjonalności, chociaż zauważyliśmy to wcześniej i się przed tym zabezpieczyliśmy. Każda funkcjonalność ma jeden plik.

Zasady:

1. Plik dla nowej funkcjonalności tworzymy **przed** napisaniem kodu. Na początku wpisujemy ryzyka, które przewidujemy. W trakcie pracy dopisujemy te, które wyszły po drodze.
2. Każdy punkt ma trzy części:
   - **Ryzyko** – co mogło pójść nie tak i z jakim skutkiem,
   - **Zabezpieczenie** – co zrobiliśmy w kodzie,
   - **Test** – który test (plik › nazwa) to sprawdza albo jak sprawdziliśmy to ręcznie.
3. Błędy, które naprawdę wystąpiły, opisujemy w `docs/Dokumentacja_postepow_prac.md` (sekcja 7). Tutaj są te, którym zapobiegliśmy.

Każda nowa funkcjonalność ma też logi (`src/lib/log.ts`), testy jednostkowe i testy integracyjne.

## Pliki

| Plik | Funkcjonalność |
|---|---|
| [ekran-glowny.md](ekran-glowny.md) | ekran główny, wybór poziomu, tło |
| [baza-pytan.md](baza-pytan.md) | format i walidacja bazy pytań |
| [sprawdzanie-odpowiedzi.md](sprawdzanie-odpowiedzi.md) | normalizacja i tolerancja literówek |
| [silnik-gry.md](silnik-gry.md) | zasady etapów I, II i finału |
| [boty.md](boty.md) | decyzje i osobowości botów |
| [symulator.md](symulator.md) | rozgrywanie całych gier botami |
| [sterownik-gry.md](sterownik-gry.md) | czas, pauzy i ruchy botów w czasie rzeczywistym |
| [ekran-rozgrywki.md](ekran-rozgrywki.md) | ekran gry, klawiatura, wyjście z gry |
| [logowanie.md](logowanie.md) | logi aplikacji |
| [testy-integracyjne.md](testy-integracyjne.md) | testy całej rozgrywki na prawdziwych modułach |
| [lektor.md](lektor.md) | głos prowadzącego na żywo (Piper + sherpa-onnx), krok „czytanie” w sterowniku |
| [odpowiedzi-glosem.md](odpowiedzi-glosem.md) | odpowiadanie na pytania głosem (mikrofon) |
