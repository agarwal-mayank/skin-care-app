# Feature: TICKET-2 — Quiz Content Config + Dosha-Scoring Engine

The following plan should be complete, but it's important to validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils/types/models. Import from the right files etc.

## Feature Description

Build the pure-logic core of the quiz: a shared type vocabulary (`lib/quiz/types.ts`), a content-as-config question set (`lib/quiz/questions.ts`), and a scoring function (`lib/quiz/scoring.ts`) that takes a visitor's answers and returns a dominant dosha (Vata/Pitta/Kapha) and a derived skin type. This is the single source of truth every later ticket imports from: TICKET-3's quiz UI renders `questions.ts` and calls `scoring.ts`; TICKET-4 persists the resulting answers/skinType shape into `QuizResponse.answers`/`QuizResponse.skinType`.

## User Story

As the project owner
I want the dosha-scoring logic and quiz question shape defined as pure, tested TypeScript
So that the quiz UI (TICKET-3) and persistence (TICKET-4) have a stable, correct contract to build against, and the real Ayurvedic content can drop in later without touching the scoring algorithm

## Problem Statement

TICKET-1 created the app shell and the `QuizResponse` database model, but there is no quiz logic yet — no question shape, no way to turn answers into a skin type, and no tests proving the scoring rules are correct. TICKET-3 (the quiz UI) cannot start until this contract exists.

## Solution Statement

Define `QuizQuestion`/`QuizAnswers`/`Dosha`/`SkinType` types in `lib/quiz/types.ts`. Define a small, **clearly placeholder** question set in `lib/quiz/questions.ts` — a gender question plus a handful of skin questions, each option carrying per-dosha weights. Implement `scoreQuiz()` in `lib/quiz/scoring.ts` as a pure function: sum each answered option's dosha weights, pick the dominant dosha (with a documented, fixed tie-break order), map dosha → skin type. Add Vitest (this repo's first test dependency) and cover every dosha outcome plus the tie-break case in `lib/quiz/scoring.test.ts`.

## Out of Scope / Non-Goals

- Not included: real Ayurvedic quiz content or scoring weights. The founder has not yet provided the real framework (PRD Open Questions, `.claude/references/quiz-content.md`) — inventing plausible-sounding content is explicitly disallowed. All question text/options in this ticket must be **obviously placeholder** (e.g. prefixed `[PLACEHOLDER]`), not realistic-looking Ayurvedic copy.
- Not included: `lib/quiz/packages.ts` or any skinType → package/pricing mapping — that's TICKET-6, currently blocked on an unresolved PRD question.
- Not included: any UI, React components, or `app/quiz/*` routes — that's TICKET-3.
- Not included: persistence — no route touches `QuizResponse`/Prisma in this ticket. `answers`/`skinType` are just designed to be JSON-serializable so TICKET-4 can store them directly.
- Not changing: `prisma/schema.prisma`, `lib/db.ts`, or anything from TICKET-1.

## Feature Metadata

**Feature Type**: New Capability (pure logic + config)
**Estimated Complexity**: Low–Medium (the logic itself is small; the main risk is content invented where it shouldn't be, and getting the answers/JSON shape right for TICKET-4)
**Primary Systems Affected**: `lib/quiz/` (new), `package.json` (new test dependency/script)
**Dependencies**: Vitest (new devDependency — first test runner in this repo)

## Related Work

**Implements**: TICKET-2 in `docs/tickets/ayurvedic-skin-quiz.md` · **Epic**: `ayurvedic-skin-quiz.architecture.md`

**Back-references** (plans this builds on or inherits decisions from):

- `.claude/plans/ticket-1-project-scaffold.md` — Why: created the `app/`, `lib/`, `prisma/` layout and the `QuizResponse` model this ticket's output must slot into; its Notes section already recommended Vitest for exactly this ticket ("TICKET-2 is the natural place, since `lib/quiz/scoring.ts` is the first piece of genuinely pure, testable logic") — inherited here, not re-decided.

**Forward-references** (plans that extend or supersede this — append as follow-ups get created):

- TICKET-3 (quiz flow UI) will import `lib/quiz/questions.ts` and call `lib/quiz/scoring.ts` to drive the multi-step flow and result screen.
- TICKET-4 (save on completion) will persist `QuizAnswers` and the resulting `SkinType` into `QuizResponse.answers` (Json) / `QuizResponse.skinType` (String) — the shapes defined here are the contract.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `prisma/schema.prisma` (lines 15-22) — the `QuizResponse` model: `answers Json` and `skinType String` are what this ticket's output must be able to fill directly. `answers` must end up as a plain JSON-serializable value (no functions/classes/`Map`/`Set`) — design `QuizAnswers` accordingly.
- `docs/tickets/ayurvedic-skin-quiz.md` (lines 20-25) — TICKET-2's exact scope/AC as sliced from the PRD+architecture: `questions.ts`, `scoring.ts`, `types.ts`, done when scoring has unit tests covering each dosha outcome and the types are the single source every other ticket imports.
- `.claude/plans/ticket-1-project-scaffold.md` (lines 174-191, 206-217) — the `lib/db.ts` singleton pattern (for import-style consistency, e.g. `import { db } from "@/lib/db"` — this ticket's files should be importable the same way: `import { scoreQuiz } from "@/lib/quiz/scoring"`) and the explicit note that TICKET-2 is where a test runner gets installed for the first time.
- `tsconfig.json` (lines 1-27) — `"paths": { "@/*": ["./*"] }` and `moduleResolution: "bundler"` — new files must be importable via the `@/` alias; Vitest's config needs to resolve the same alias (see External Documentation).
- `package.json` — current scripts (`dev`/`build`/`start`/`lint`), no `test` script yet; `"type"` is unset (CommonJS-neutral, ESM via bundler resolution) — match this rather than introducing a different module system for test files.

### New Files to Create

- `lib/quiz/types.ts` — `Dosha`, `SkinType`, `Gender`, `QuizOption`, `QuizQuestion`, `QuizAnswers`, `ScoringResult` types. The single source every other ticket imports from (per TICKET-2's AC) — TICKET-3 and TICKET-4 must never redeclare these.
- `lib/quiz/questions.ts` — exports `questions: QuizQuestion[]`: one gender question (no dosha weight — see Patterns) + a small set (3–5) of clearly-placeholder skin questions, each option carrying `doshaWeights`.
- `lib/quiz/scoring.ts` — exports `scoreQuiz(answers: QuizAnswers, questions: QuizQuestion[]): ScoringResult`, pure function.
- `lib/quiz/scoring.test.ts` — Vitest unit tests: one case per dominant-dosha outcome (Vata/Pitta/Kapha) plus the tie-break case.
- `vitest.config.ts` — root-level Vitest config resolving the `@/*` alias and defaulting to the `node` test environment (no DOM needed — this is pure logic, no components yet).

### Files to Update

- `package.json` — add `vitest` as a pinned devDependency (see global CLAUDE.md: pin versions, don't use an unpinned `latest`) and a `"test": "vitest run"` script.

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Vitest — Getting Started](https://vitest.dev/guide/) — install + `vitest.config.ts` basics.
- [Vitest — Configuring Vite / resolve.alias](https://vitest.dev/config/#resolve-alias) — how to make `vitest.config.ts` honor the same `@/*` alias as `tsconfig.json`'s `paths`, so `lib/quiz/scoring.test.ts` can `import { scoreQuiz } from "@/lib/quiz/scoring"` the same way app code will.
  - Why: without this, tests would need relative imports (`../scoring`) that diverge from the app's own import style — a small but real inconsistency to avoid from the first test file onward.
- Note on the CLAUDE.md "This is NOT the Next.js you know" instruction: this ticket touches **no Next.js runtime surface** (no routes, no App Router files, no `next.config.ts` changes) — it's plain TypeScript modules plus a Vitest config. `node_modules/next/dist/docs/` is not load-bearing for this ticket; TICKET-3 (the first ticket that touches `app/quiz/*`) is where reading it matters.

### Patterns to Follow

**Naming conventions:** camelCase for functions/variables (`scoreQuiz`, `doshaWeights`), PascalCase for types/interfaces (`QuizQuestion`, `ScoringResult`) — matches `PrismaClient`/`QuizResponse` casing already in the codebase.

**Import style:** use the `@/` alias for cross-file imports within `lib/`, matching `lib/db.ts`'s intended consumption pattern (`import { db } from "@/lib/db"`) — e.g. `import type { QuizQuestion } from "@/lib/quiz/types"`.

**Content-as-config (architecture doc, "Content-as-config pattern"):** questions live as a plain exported array, not a class or builder — a later content swap should mean editing data in `questions.ts`, never touching `scoring.ts`.

**Placeholder content marking (`.claude/references/quiz-content.md`):** every question `prompt` and option `label` in `questions.ts` must be unmistakably a placeholder — e.g. `"[PLACEHOLDER] How does your skin feel by midday?"` — never realistic-sounding Ayurvedic copy. This is a hard rule, not a style preference: the reference doc explicitly says not to invent plausible content to fill the gap.

**Fail loudly, never swallow (CLAUDE.md working principles):** `scoreQuiz` should throw (not silently default) if `answers` references a `questionId` or `optionId` that doesn't exist in the given `questions` array — a malformed answer set is a bug, not a case to paper over.

---

## IMPLEMENTATION PLAN

### Phase 1: Types

Establish the shared vocabulary before anything else imports it.

**Tasks:**
- Define `Dosha` (`"vata" | "pitta" | "kapha"`), `Gender`, `SkinType` (see Notes for the dosha→skinType mapping this ticket assumes).
- Define `QuizOption` (`id`, `label`, `doshaWeights: Partial<Record<Dosha, number>>`), `QuizQuestion` (`id`, `prompt`, `options: QuizOption[]`).
- Define `QuizAnswers` (`{ gender: Gender; responses: Record<string, string> }` — `responses` maps `questionId → optionId`) — this must be plain-JSON-shaped since it's what TICKET-4 writes into `QuizResponse.answers` (a Prisma `Json` column).
- Define `ScoringResult` (`{ dominantDosha: Dosha; skinType: SkinType; scores: Record<Dosha, number> }`).

### Phase 2: Question content (placeholder)

**Depends on:** Phase 1 (needs `QuizQuestion`/`QuizOption` types)

**Tasks:**
- Add one gender question (options with empty/no `doshaWeights` — gender doesn't score dosha, per the PRD's "gender first, then skin-related questions" sequencing).
- Add 3–5 placeholder skin questions, each option assigning weight(s) across `vata`/`pitta`/`kapha` (options don't need to be exclusive to one dosha — partial weights across two doshas are fine and more realistic for later real content).
- Mark every prompt/label with a `[PLACEHOLDER]` prefix and add a top-of-file comment pointing at `.claude/references/quiz-content.md` so nobody mistakes this for real content later.

### Phase 3: Scoring engine

**Depends on:** Phase 1 and 2 (needs both the types and a real `questions.ts` to test against)

**Tasks:**
- Implement `scoreQuiz(answers, questions)`: for each entry in `answers.responses`, look up the matching question/option, sum `doshaWeights` into a running `{vata, pitta, kapha}` tally.
- Throw if a `questionId`/`optionId` in `answers.responses` isn't found in `questions` (fail loudly).
- Pick the dominant dosha: highest score wins; ties broken by a fixed priority order `vata > pitta > kapha` (documented in Open Questions — this is an assumption, not a founder decision).
- Map dominant dosha → `SkinType` via a small fixed table (see Notes).

### Phase 4: Test setup + coverage

**Independent of:** Phase 2's exact placeholder wording (tests should define their own small fixture question set inline, not depend on `questions.ts`'s specific content — see Testing Strategy) — but depends on Phase 1 and 3 for the types/function under test.

**Tasks:**
- Add Vitest as a pinned devDependency; add `vitest.config.ts` with the `@/*` alias resolved; add `"test": "vitest run"` to `package.json`.
- Write `scoring.test.ts`: one test per dominant-dosha outcome, one tie-break test, one "throws on unknown answer" test.

---

## STEP-BY-STEP TASKS

### CREATE `lib/quiz/types.ts`

- **IMPLEMENT**: `Dosha`, `Gender`, `SkinType`, `QuizOption`, `QuizQuestion`, `QuizAnswers`, `ScoringResult` (see Phase 1 for field shapes).
- **PATTERN**: PascalCase types, matches `QuizResponse` casing in `prisma/schema.prisma`.
- **IMPORTS**: none (this is the leaf module).
- **GOTCHA**: `QuizAnswers` must stay plain-JSON-shaped — no `Map`/`Set`/functions — since TICKET-4 will store it directly into a Prisma `Json` column.
- **VALIDATE**: `npx tsc --noEmit` passes.
- **SATISFIES**: TICKET-2 AC — "shared `lib/quiz/types.ts`."

### CREATE `lib/quiz/questions.ts`

- **IMPLEMENT**: `export const questions: QuizQuestion[]` — 1 gender question (no weights) + 3–5 `[PLACEHOLDER]`-prefixed skin questions with per-option `doshaWeights`.
- **PATTERN**: content-as-config array export, per architecture doc's "Content-as-config pattern."
- **IMPORTS**: `import type { QuizQuestion } from "@/lib/quiz/types"`.
- **GOTCHA**: do not write realistic-sounding Ayurvedic question text — `.claude/references/quiz-content.md` explicitly forbids inventing plausible content. Every prompt/label must read as an obvious placeholder.
- **VALIDATE**: `npx tsc --noEmit` passes; manual read-through confirms every string is clearly marked as placeholder.
- **SATISFIES**: TICKET-2 AC — "`lib/quiz/questions.ts` (gender + skin questions — placeholder content, clearly marked TBD)."

### CREATE `lib/quiz/scoring.ts`

- **IMPLEMENT**: `scoreQuiz(answers: QuizAnswers, questions: QuizQuestion[]): ScoringResult` — sum weights, pick dominant dosha (tie-break `vata > pitta > kapha`), map to `SkinType`.
- **PATTERN**: pure function, no side effects, no I/O — mirrors the architecture doc's call for `scoring.ts` to be pure/testable logic.
- **IMPORTS**: `import type { QuizAnswers, QuizQuestion, ScoringResult, Dosha, SkinType } from "@/lib/quiz/types"`.
- **GOTCHA**: throw (don't silently skip) on an `answers.responses` entry whose `questionId` or `optionId` isn't present in `questions` — per CLAUDE.md "fail loudly, never swallow."
- **VALIDATE**: `npx tsc --noEmit` passes; covered by `scoring.test.ts` below.
- **SATISFIES**: TICKET-2 AC — "`lib/quiz/scoring.ts` (pure function: answers → dominant dosha/skin type)."

### CREATE `vitest.config.ts`

- **IMPLEMENT**: minimal config setting `resolve.alias` for `@` → project root (mirroring `tsconfig.json`'s `"@/*": ["./*"]`) and `test.environment: "node"`.
- **PATTERN**: N/A — first test config in this repo.
- **IMPORTS**: `defineConfig` from `vitest/config`.
- **GOTCHA**: if the alias isn't wired here, `scoring.test.ts`'s `@/lib/quiz/...` imports will resolve fine in `tsc` (via `tsconfig.json`) but fail at Vitest runtime — verify by actually running the test, not just type-checking.
- **VALIDATE**: `npm test` runs (even with zero tests yet) without an alias-resolution error.
- **SATISFIES**: TICKET-2 AC — "done when `scoring.ts` has unit tests" (this is the enabling infra).

### UPDATE `package.json`

- **IMPLEMENT**: add `"vitest": "<pinned-version>"` to `devDependencies` (check current stable version at install time, e.g. `npm install -D vitest@<version>` then pin the resolved version — same discipline as TICKET-1 pinning Prisma to `6.19.3` after an unpinned install resolved to an unstable release); add `"test": "vitest run"` to `scripts`.
- **PATTERN**: matches TICKET-1's precedent of pinning exact versions rather than `^`/`latest` ranges where a bad resolution already bit this project once.
- **GOTCHA**: don't add `"type": "module"` or other unrelated `package.json` changes — scope this to the test dependency/script only.
- **VALIDATE**: `npm install` completes clean; `npm test` (with no test files yet) exits without a config error.
- **SATISFIES**: enabling infra for TICKET-2's AC.

### CREATE `lib/quiz/scoring.test.ts`

- **IMPLEMENT**: define a small local fixture `QuizQuestion[]` (2-3 questions, hand-picked weights so expected outcomes are unambiguous) — don't import `lib/quiz/questions.ts`'s placeholder content directly, so these tests stay stable when real content replaces the placeholders later. Cover:
  1. Answers that should score dominant Vata.
  2. Answers that should score dominant Pitta.
  3. Answers that should score dominant Kapha.
  4. An exact-tie case, asserting the documented `vata > pitta > kapha` tie-break.
  5. An `answers.responses` entry with an unknown `questionId`/`optionId` — asserts `scoreQuiz` throws.
- **PATTERN**: standard Vitest `describe`/`it`/`expect`.
- **IMPORTS**: `import { describe, it, expect } from "vitest"`; `import { scoreQuiz } from "@/lib/quiz/scoring"`; `import type { QuizQuestion, QuizAnswers } from "@/lib/quiz/types"`.
- **GOTCHA**: keep fixtures self-contained in this file — a future edit to `questions.ts`'s placeholder wording (or real content later) must not break these tests.
- **VALIDATE**: `npm test` — all cases pass.
- **SATISFIES**: TICKET-2 AC — "done when `scoring.ts` has unit tests covering each dosha outcome."

---

## TESTING STRATEGY

This ticket is the first one with real, pure logic in the repo (per TICKET-1's plan notes) — it's exactly the case the global CLAUDE.md's "pure logic should have unit tests" rule targets.

### Unit Tests

`scoring.test.ts` covers `scoreQuiz` exhaustively using local fixtures (not the real placeholder `questions.ts` content) — see the dedicated task above. This is the entire test surface for this ticket; `questions.ts` and `types.ts` are data/type-only and don't need their own test files.

### Integration Tests

None — no cross-module wiring yet (TICKET-3 is where `questions.ts` + `scoring.ts` get wired into a real UI flow).

### Edge Cases

- Exact tie between two or more doshas — resolved by fixed priority order (test 4 above).
- An option with weights on more than one dosha (not mutually exclusive) — the sample fixture should include at least one such option so the summation logic (not just "pick the one dosha this option belongs to") is actually exercised.
- Unknown `questionId`/`optionId` in `answers.responses` — must throw, not return a degraded/default result.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — no lint errors.

### Level 2: Unit Tests
- `npm test` — all `scoring.test.ts` cases pass.

### Level 3: Integration Tests
N/A for this ticket.

### Level 4: Manual Validation
- Open a throwaway Node/`tsx` REPL (or a temporary script, deleted after use — same approach TICKET-1 used to sanity-check `lib/db.ts`) and call `scoreQuiz` with a couple of hand-built `QuizAnswers` against the real `questions.ts` export, confirming it returns a sane `ScoringResult` and doesn't throw on well-formed input.

### Level 5: Additional Validation
N/A.

---

## ACCEPTANCE CRITERIA

- [x] `lib/quiz/types.ts` exports `Dosha`, `Gender`, `SkinType`, `QuizOption`, `QuizQuestion`, `QuizAnswers`, `ScoringResult` — the single source every other ticket imports.
- [x] `lib/quiz/questions.ts` exports a gender question plus 3–5 skin questions, all content unmistakably marked as placeholder.
- [x] `lib/quiz/scoring.ts` exports a pure `scoreQuiz` function with no side effects, throwing on malformed input.
- [x] `lib/quiz/scoring.test.ts` covers all three dominant-dosha outcomes, the tie-break rule, and the throw-on-unknown-answer case.
- [x] `npm test` (new script) runs Vitest and all tests pass.
- [x] `npx tsc --noEmit` and `npm run lint` both pass with zero errors.
- [x] No `app/`, `prisma/`, or `lib/db.ts` files touched — scope stayed inside `lib/quiz/` + test tooling.

---

## COMPLETION CHECKLIST

- [x] All tasks completed in order
- [x] Each task's validation command passed
- [x] `tsc --noEmit` and `npm run lint` both clean
- [x] `npm test` passes with all documented dosha/tie-break/error cases covered
- [x] Placeholder content manually re-read and confirmed unmistakably fake, not realistic Ayurvedic copy
- [x] Acceptance criteria all met

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumption — tie-break order:** `vata > pitta > kapha` when scores are exactly equal. Arbitrary (alphabetical-ish, no domain basis) since the real scoring framework isn't provided yet. Flag for the founder once real content arrives — this may need to change, or ties may need a different resolution (e.g. "combination" skin type) entirely.
- **Assumption — dosha → skinType mapping:** this plan assumes a simple 1:1 mapping (e.g. `vata → "dry"`, `pitta → "sensitive"`, `kapha → "oily"`) with no `"combination"` type, to keep the enum small until real content arrives. This is a guess, not a founder decision — PRD Open Questions confirms "what are the actual quiz questions and dosha-scoring logic" is still TBD. Whoever swaps in real content later may need to widen `SkinType` or change the mapping.
- **Assumption — gender doesn't affect scoring:** per PRD's "gender first, then skin-related questions," the gender question is captured in `QuizAnswers` for storage/display but contributes no `doshaWeights`. If the founder's real framework wants gender to influence scoring, this is a straightforward but real change to `scoreQuiz`.
- **Not blocking this ticket:** the PRD's broader open questions (what a "package" is, Bolt.new integration, whether the quiz should target women specifically) — none affect this ticket's scope.

## NOTES (open canvas)

**Why fixtures in `scoring.test.ts` don't import `questions.ts`:** the placeholder content in `questions.ts` is explicitly expected to be replaced wholesale once the founder provides the real framework. If tests asserted against that placeholder content's specific wording/weights, replacing it would break the test suite for a reason that has nothing to do with the scoring algorithm being wrong. Local, hand-picked fixtures in the test file keep `scoring.test.ts` a durable regression suite across that future content swap.

**Why Vitest over Node's built-in test runner:** Next.js projects conventionally reach for Vitest (fast, TS-native via esbuild, no separate ts-node/babel step) and TICKET-1's own plan already flagged it as the pick for this ticket. Node's built-in runner (`node --test`) would also satisfy the global CLAUDE.md's "prefer standard library" instinct, but Vitest's zero-config TS support and alias resolution avoid extra plumbing for a project that will need a real test runner across many future tickets (TICKET-4's route logic, later UI tests) — worth the one small, well-known dependency.

**Dosha weighting shape:** `doshaWeights: Partial<Record<Dosha, number>>` (not a required full record) so a placeholder/real option can lean toward one or two doshas without needing to write `{ vata: 0, pitta: 0, kapha: 2 }` boilerplate for the untouched ones — `scoreQuiz` treats a missing key as `0`.

**Confidence this ticket is genuinely self-contained:** everything here is new files inside `lib/quiz/` plus one new devDependency — no existing file behavior changes except `package.json`'s scripts/devDependencies. Low risk of regressing TICKET-1's work.

## AMENDMENTS

**2026-09-21 — Implementation complete.** All 4 phases executed and validated; see `.claude/reports/ticket-2-quiz-content-scoring-report.md` for full details. One load-bearing deviation: Vitest pinned to `3.2.7` rather than an unpinned `latest` (which resolved to `5.0.1`, incompatible with this project's `@types/node@^20`) — `3.2.7` is the newest version in the `3.x` line whose peer range still matches `@types/node@^20` without forcing anything.
