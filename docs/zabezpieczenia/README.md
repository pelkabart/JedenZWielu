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
| [rundy-goracy-ziemniak.md](rundy-goracy-ziemniak.md) | zasady i sterownik rund „Gorący Ziemniak” (jedyny tryb gry) |
| [limit-pytan-botow.md](limit-pytan-botow.md) | najwyżej 2 pytania z rzędu dla botów, potem bot musi wskazać gracza |
| [poprawki-rozgrywki.md](poprawki-rozgrywki.md) | plansza rundy z pomijaniem lektora, start sprintu, 5 s na decyzję w finale, pauza, mnożnik na środku, start od gracza, błędy przebiegu gry |
| [tabela-wynikow.md](tabela-wynikow.md) | tabela wyników na końcu gry, 10 punktów w finale, mnożnik najwyżej ×3 |
| [silnik-gry.md](silnik-gry.md) | zasady etapów I, II i finału (kod usunięty) |
| [boty.md](boty.md) | decyzje i osobowości botów |
| [symulator.md](symulator.md) | rozgrywanie całych gier botami (kod usunięty) |
| [sterownik-gry.md](sterownik-gry.md) | czas, pauzy i ruchy botów w starym trybie (kod usunięty) |
| [ekran-rozgrywki.md](ekran-rozgrywki.md) | ekran gry, klawiatura, wyjście z gry |
| [logowanie.md](logowanie.md) | logi aplikacji |
| [testy-integracyjne.md](testy-integracyjne.md) | testy całej rozgrywki na prawdziwych modułach |
| [lektor.md](lektor.md) | głos prowadzącego na żywo (Piper + sherpa-onnx), krok „czytanie” w sterowniku |
| [odpowiedzi-glosem.md](odpowiedzi-glosem.md) | odpowiadanie na pytania głosem (mikrofon) |
| [kategorie-pytan.md](kategorie-pytan.md) | kategorie: własne zestawy pytań generowane przez OpenAI z plików, wybór kategorii w trybie jednoosobowym |
| [kategorie-import-eksport.md](kategorie-import-eksport.md) | import i eksport kategorii do plików `.kat` (JSON) |
| [ustawienia-klucz-api.md](ustawienia-klucz-api.md) | klucz API OpenAI z pliku `.env.local` (wcześniej ekran ustawień i Android Keystore) |
| [ustawienia-glosnosc.md](ustawienia-glosnosc.md) | ekran ustawień: głośność muzyki i lektora (suwaki 0–100%, zapis na telefonie) |
| [skorki.md](skorki.md) | skórki postaci: katalog z folderu, przydział wg płci bez powtórek, wybór gracza, mimika |
| [serwer-testowy.md](serwer-testowy.md) | serwer testowy na Azure Container Apps (`server/`) i sprawdzanie połączenia z aplikacji |
