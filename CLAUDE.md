# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

"Jeden z Wielu" is an Android quiz game inspired by TV knowledge game shows (Polish-language project; docs and UI copy are in Polish). Planned design, from `docs/Jeden_z_Wielu_Dokumentacja_Wstepna.docx`:

- Lobby screen with three modes: **Solo** (quiz against bots), **Eliminacje** (qualifying series that unlocks public multiplayer), **Multiplayer** (online between players).
- Multiple-choice questions (A/B/C/D), a countdown timer, and scoring. Question bank of pre-verified questions (target ~2000).
- Optional Premium mode: voice answers with no A–D options (pending speech-recognition testing).
- Backend not decided yet; tentatively Supabase + PostgreSQL. Target platform is Android / Google Play.

This is a university project for the course "Dynamiczna analiza oprogramowania" (dynamic software analysis). Progress log: `docs/Dokumentacja_postepow_prac.md`. Reports for the instructor: `docs/Jeden_z_Wielu_Analiza_dynamiczna_etap*.docx`.

Current state: home screen, difficulty selection and a playable solo mode (human + 4 bots). Game logic is plain TypeScript in `src/game/`: a pure engine (`engine.ts`, `reduce(state, action)`), bots (`bots/`), a simulator (`simulate.ts`) and a real-time controller (`controller/SoloController.ts`) with an injected clock. Logging is in `src/lib/log.ts`.

## Required workflow for every new feature

1. **Before writing code**, create `docs/zabezpieczenia/<feature-name>.md` (one shared folder, one file per feature; see its `README.md`). List what could go wrong and how it is prevented: risk → safeguard → test. Keep it updated while working.
2. Add **logs** with `createLogger('<module>')` from `@/lib/log`. Log small values only (ids, numbers), never the whole `GameState`. Use `debug`/`info` for normal gameplay; `warn`/`error` show on screen in Expo Go. The engine (`reduce`) stays pure and does not log.
3. Add **unit tests** and **integration tests** (`src/game/__tests__/integration-test.ts` wires the same modules as the app, on Jest fake timers).
4. Update `docs/Dokumentacja_postepow_prac.md` (state table, tests table, and section 7 for problems that actually happened).
5. Before finishing: `npm test`, `npx tsc --noEmit`, `npx expo lint`.
6. After changes to the app, build a release APK and put it in `androidApk/` (see "Building the APK" below).

## Commands

The project uses npm (`package-lock.json`), so use `npx`, not `bunx`.

```bash
npm install
npx expo start            # dev server; scan QR with Expo Go (phone and PC on same Wi-Fi)
npx expo start --tunnel   # when local Wi-Fi doesn't work
npx expo start -c         # clear Metro cache
npx expo lint             # lint
npx tsc --noEmit          # typecheck
npm test                  # all Jest tests (jest-expo preset)
npm run test:integration  # integration tests only
npm run test:coverage     # coverage report
```

Host voice (lektor): everything the host says and every question is synthesized live on the device from the Piper model via `react-native-sherpa-onnx` (`src/narration/`). No audio files are pre-generated. The source model `voiceModel/voice.onnx` (63 MB) is committed; the sherpa-ready folder `voiceModel/vits-piper-pl/` is generated and git-ignored — prepare it once before `npx expo prebuild`, which copies it into Android assets via `plugins/withVoiceModel.js` (prebuild fails with instructions if it is missing):

```bash
scripts/narration/.venv/Scripts/python scripts/narration/prepare_voice_model.py   # venv setup: see the script's docstring
```

Tests live in `__tests__` folders next to the code; any file there is treated as a test, so shared test helpers go in `src/game/testing/`. Randomness goes through a seeded `Rng` (`src/game/rng.ts`) so tests are reproducible. The `reset-project` script in `package.json` points to `scripts/reset-project.js`, which doesn't exist.

The game still runs in Expo Go, but silently: sherpa-onnx is a native module, so the host voice needs a development build (`npx expo run:android`) or an APK.

## Building the APK

The APK is built locally (no EAS; there is no `eas.json`): Expo prebuild generates the native `android/` project, then Gradle from the Android SDK builds it. Both `android/` and `androidApk/` are git-ignored.

```bash
# 1. Generate android/ — needed the first time and after changes to app.json, plugins/, native dependencies
#    or the voice model; JS/TS-only changes can skip it, assembleRelease bundles the current JS.
npx expo prebuild --platform android
# 2. Build (in android/; on Windows ./gradlew.bat). arm64-v8a for a phone, x86_64 for the emulator.
#    Don't build a universal APK (~320 MB, much slower).
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# 3. Copy the result to androidApk/ in the project root (create the folder if missing), overwriting the old one.
mkdir -p androidApk && cp android/app/build/outputs/apk/release/app-release.apk androidApk/JedenZWielu-arm64-v8a.apk
```

Prebuild recreates `android/` from scratch, deleting `android/local.properties`, and `ANDROID_HOME` is not set on this machine, so Gradle fails with "SDK location not found". After every prebuild write `sdk.dir=C:/Users/dpietek/AppData/Local/Android/Sdk` to `android/local.properties` (forward slashes — in a `.properties` file `\U` is an escape and breaks the path).

Prebuild rewrites `package.json` scripts and adds a placeholder package name to `app.json`; revert those changes and don't commit them. An `arm64-v8a` APK crashes on start on an x86_64 emulator (see section 7 of the progress log).

## Configuration notes

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript strict.
- `app.json` enables `experiments.typedRoutes` (route hrefs are type-checked; generated types live in `.expo/types`) and `experiments.reactCompiler` (avoid manual `useMemo`/`useCallback` unless needed).
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- `.claude/settings.json` enables the `expo@claude-plugins-official` plugin.
