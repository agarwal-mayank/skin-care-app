# Implementation Report — TICKET-2 Quiz Content Config + Dosha-Scoring Engine

**Plan**: `.claude/plans/ticket-2-quiz-content-scoring.md`   **Branch**: `feature/ticket-2-quiz-content-scoring`   **Status**: COMPLETE

## Summary
Built the pure-logic core of the quiz: `lib/quiz/types.ts` defines the shared `Dosha`/`Gender`/`SkinType`/`QuizQuestion`/`QuizAnswers`/`ScoringResult` types; `lib/quiz/questions.ts` provides a clearly-`[PLACEHOLDER]`-marked gender question plus 4 skin questions with per-option dosha weights; `lib/quiz/scoring.ts` implements a pure `scoreQuiz()` function (sum weights → dominant dosha via a fixed tie-break order → mapped skin type, throwing on malformed input). Vitest was added as the repo's first test dependency, with 7 unit tests in `lib/quiz/scoring.test.ts` covering every dominant-dosha outcome, cross-dosha weight summation, the tie-break rule, and both error cases.

## Tasks completed
- Define shared types → `lib/quiz/types.ts` (CREATE)
- Add placeholder question content → `lib/quiz/questions.ts` (CREATE)
- Implement scoring engine → `lib/quiz/scoring.ts` (CREATE)
- Add Vitest config with `@/*` alias → `vitest.config.ts` (CREATE)
- Add `vitest` devDependency + `test` script → `package.json`, `package-lock.json` (UPDATE)
- Write scoring unit tests → `lib/quiz/scoring.test.ts` (CREATE)

## Tests added
`lib/quiz/scoring.test.ts` — 7 cases, all passing:
- Dominant Vata result
- Dominant Pitta result
- Dominant Kapha result
- Weight summation across an option spanning two doshas (vata+pitta) combined with another vata-only answer
- Exact-tie resolution via the fixed `vata > pitta > kapha` order
- Throws on an unknown `questionId`
- Throws on an unknown `optionId` for a known question

Fixtures are defined locally in the test file (not imported from `questions.ts`) per the plan, so the suite stays valid once real content replaces the placeholders.

## Validation results
- `npx tsc --noEmit` → pass, no errors.
- `npm run lint` → pass, no errors.
- `npm test` (`vitest run`) → 1 file, 7/7 tests passed.
- Manual validation (Level 4): a throwaway `tsx` script called `scoreQuiz` with hand-built answers against the real `questions.ts` export — returned a sane, non-throwing `ScoringResult` (`{ dominantDosha: "vata", skinType: "dry", scores: { vata: 8, pitta: 0, kapha: 0 } }`); script deleted after use, not committed.

## Deviations from the plan
- **Vitest pinned to `3.2.7`, not an unpinned `latest`.** An unpinned `npm install -D vitest` resolved to `5.0.1`, which conflicts with this project's `@types/node@^20` (vitest 5's `vite@8` peer dependency requires `@types/node@^22 || >=24`). Bumping `@types/node` was out of scope for this ticket (plan explicitly says not to make unrelated `package.json` changes), so I checked peer-dependency compatibility across majors and pinned to `3.2.7` — the latest version in the `3.x` line, whose peer range (`^18 || ^20 || >=22`) matches the installed `@types/node@^20` exactly, with no `--force`/`--legacy-peer-deps` needed. This mirrors TICKET-1's precedent of pinning Prisma to its last compatible stable release after an unpinned install resolved to something incompatible.
- **`npm audit` now flags one additional moderate advisory**: `@vitest/mocker` (bundled with vitest 2.1.0–4.1.10, including our pinned `3.2.7`) has a path-traversal/arbitrary-file-read advisory, fixable only by upgrading to vitest `5.0.1` — which reintroduces the `@types/node` conflict above. This is a dev-only tool (module mocking during test runs; unused by our current tests) with no production exposure. Not fixed here, consistent with the project's existing acceptance of the pre-existing `deepmerge-ts`/Prisma dev-only advisory from TICKET-1. Worth revisiting whenever `@types/node` is deliberately bumped to `^22`+ for another reason.
- Everything else matches the plan as written (file paths, type shapes, tie-break rule, dosha→skinType mapping, placeholder-content marking).

## Issues encountered
None beyond the Vitest/`@types/node` peer-dependency conflict resolved above.
