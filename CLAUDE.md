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

Question narration: each question in `src/data/questions.json` has a pre-generated Piper recording in `assets/audio/questions/` (model in `voiceModel/`, not committed). After adding or editing questions, regenerate them (otherwise `questionAudio-test.ts` fails):

```bash
scripts/narration/.venv/Scripts/python scripts/narration/generate_question_audio.py   # venv setup: see the script's docstring
```

Tests live in `__tests__` folders next to the code; any file there is treated as a test, so shared test helpers go in `src/game/testing/`. Randomness goes through a seeded `Rng` (`src/game/rng.ts`) so tests are reproducible. The `reset-project` script in `package.json` points to `scripts/reset-project.js`, which doesn't exist.

Testing currently happens in Expo Go. Once a native module outside Expo Go is added, a development build will be needed (see AGENTS.md).

## Configuration notes

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript strict.
- `app.json` enables `experiments.typedRoutes` (route hrefs are type-checked; generated types live in `.expo/types`) and `experiments.reactCompiler` (avoid manual `useMemo`/`useCallback` unless needed).
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- `.claude/settings.json` enables the `expo@claude-plugins-official` plugin.
