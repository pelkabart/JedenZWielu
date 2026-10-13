# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

"Jeden z Wielu" is an Android quiz game inspired by TV knowledge game shows (Polish-language project; docs and UI copy are in Polish). Planned design, from `docs/Jeden_z_Wielu_Dokumentacja_Wstepna.docx`:

- Lobby screen with three modes: **Solo** (quiz against bots), **Eliminacje** (qualifying series that unlocks public multiplayer), **Multiplayer** (online between players).
- Multiple-choice questions (A/B/C/D), a countdown timer, and scoring. Question bank of pre-verified questions (target ~2000).
- Optional Premium mode: voice answers with no A–D options (pending speech-recognition testing).
- Backend not decided yet; tentatively Supabase + PostgreSQL. Target platform is Android / Google Play.

Current state: an empty Expo Router scaffold, with a root `Stack` in `src/app/_layout.tsx` and a single start screen in `src/app/index.tsx`.

## Commands

The project uses npm (`package-lock.json`), so use `npx`, not `bunx`.

```bash
npm install
npx expo start            # dev server; scan QR with Expo Go (phone and PC on same Wi-Fi)
npx expo start --tunnel   # when local Wi-Fi doesn't work
npx expo start -c         # clear Metro cache
npx expo lint             # lint (no ESLint config committed yet; first run will set it up)
npx tsc --noEmit          # typecheck
```

No test framework is set up. The `reset-project` script in `package.json` points to `scripts/reset-project.js`, which doesn't exist.

Testing currently happens in Expo Go. Once a native module outside Expo Go is added, a development build will be needed (see AGENTS.md).

## Configuration notes

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript strict.
- `app.json` enables `experiments.typedRoutes` (route hrefs are type-checked; generated types live in `.expo/types`) and `experiments.reactCompiler` (avoid manual `useMemo`/`useCallback` unless needed).
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- `.claude/settings.json` enables the `expo@claude-plugins-official` plugin.
