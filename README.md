
# Jeden z Wielu

Projekt gry quizowej na Androida.

## Technologie

- React Native
- TypeScript
- Expo

## Jak zrobić development build
- Należy w terminalu projektu wykonać komendę: npx eas build --platform android --profile development. Może być wymagane zalogowanie się do expo w terminalu.
- Po skończeniu należy pobrać wykonanego builda na emulator / telefon i go uruchomić.
- W terminalu uruchomić komendę: npx expo start --dev-client. Po wykonaniu zeskanować w pobranej aplikacji kod QR z terminala. Ewentualnie skopiować i wkleić kod ręcznie.

## Klucz API OpenAI (dla programistów)
- Skopiuj `.env.example` jako `.env.local` i wpisz klucz: `EXPO_PUBLIC_OPENAI_API_KEY=sk-...`. Gra użyje go, gdy w Ustawieniach na telefonie nie ma zapisanego klucza.
- `.env.local` jest w `.gitignore`, a hak `.githooks/pre-commit` (włącza go `npm install`) nie pozwoli zacommitować klucza.
- Po zmianie klucza uruchom ponownie `npx expo start` (najlepiej z `-c`).
- Uwaga: klucz z `.env.local` trafia do zbudowanego APK jawnym tekstem – nie udostępniaj takiego APK innym.
