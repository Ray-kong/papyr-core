# Repository Guidelines

## Project Structure & Module Organization
Papyr Core is a TypeScript library. Core pipeline modules live in `src/` (`builder.ts`, `analytics.ts`, `search.ts`); generated bundles publish to `dist/` via Vite. Test suites and fixtures live under `tests/`. Project metadata (`package.json`, `todo.md`) sits at the root, alongside build configs (`tsconfig.json`, `vitest.config.ts`, `vite.config.ts`). Keep markdown fixtures and sample vaults inside `tests/fixtures` so builds stay clean.

## Build, Test, and Development Commands
Use pnpm for all workflows:
- `pnpm build` – compile the library to `dist/` using Vite and emit type declarations.
- `pnpm dev` – watch-mode build for rapid iteration while editing `src/` files.
- `pnpm test` – run the Vitest suite once; respects `.ts` specs inside `tests/`. press q to quit the test after checking result.
- `pnpm test:coverage` – execute tests with V8 coverage reporting to confirm regressions.
- `pnpm clean` – remove the `dist/` directory before a fresh build or release.

## Coding Style & Naming Conventions
Follow existing two-space indentation and ES module syntax. Prefer explicit `type`/`interface` exports from `src/types.ts` to keep contracts centralized. Function names should be descriptive verbs (`generateSearchIndex`, `calculateAnalytics`); class names stay PascalCase. Run `pnpm build` before opening a PR to validate TypeScript emits cleanly.

## Testing Guidelines
Vitest powers unit and integration coverage. Mirror file names (`builder.test.ts` for `builder.ts`) and co-locate helpers in `tests/utils`. Aim to cover new graph, search, and serialization paths; add regression cases whenever touching analytics metrics or config merging. Use `pnpm test -- --runInBand` when diagnosing flaky filesystem-dependent specs.

## Commit & Pull Request Guidelines
Adopt Conventional Commits (`feat:`, `fix:`, `docs:`) as seen in history. Keep summaries imperative and under 72 characters, e.g., `fix: preserve default builder globs`. PRs should describe intent, list validation commands, link related issues, and attach output snippets or screenshots for developer tooling. Request review once CI and coverage pass, and avoid bundling unrelated refactors in the same change.

## Environment & Tooling Notes
Target Node.js ≥18 as enforced in `package.json`. FlexSearch indices and filesystem operations may rely on POSIX paths; verify Windows behavior when contributing cross-platform features. Keep external API keys or analytics tokens out of the repo—use `.env.local` entries and document expected variables in the PR when necessary.
