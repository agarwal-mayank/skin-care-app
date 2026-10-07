# Root Cause Analysis: GitHub Issue #11

## Issue Summary

- **GitHub Issue ID**: #11
- **Issue URL**: https://github.com/agarwal-mayank/skin-care-app/issues/11
- **Title**: Type the email test's LABELS map against SkinType so new skin types can't go untested
- **Reporter**: agarwal-mayank (found in the automated review of #3, Low findings 1–2)
- **Status**: OPEN, labelled `good first issue`, no linked PR

## Assessment

| Metric | Value | Reasoning |
|--------|-------|-----------|
| Severity | Low | Only test coverage is affected, not runtime behaviour. A new skin type still breaks the build through the production `Record<SkinType, …>` maps, so nobody ships without noticing. |
| Complexity | Low | Changes one test file. No production code, integrations or schema involved. |
| Confidence | High | Reproduced: temporarily widening `SkinType` made `tsc` fail in `quizResultEmail.ts` and `packages.ts`, with no error in `quizResultEmail.test.ts`. |

## Problem Description

`lib/email/quizResultEmail.test.ts` drives its parameterised tests from a local `LABELS` object. That object is typed from its own literal (`as const`), not against `SkinType`. As a result, the list of skin types the tests cover is not tied to the type it should cover.

**Expected Behavior:**
If a `SkinType` value is added or renamed without updating `LABELS`, the test file fails to compile.

**Actual Behavior:**
The test file still compiles. The tests run over the old 3 keys and pass, and the new skin type gets no email test coverage.

**Symptoms:**
- `tsc` reports no error in `quizResultEmail.test.ts` after `SkinType` is widened.
- `as keyof typeof LABELS` casts at 3 call sites hide the mismatch.

## Reproduction

**Steps to Reproduce:**
1. In `lib/quiz/types.ts:5`, change `SkinType` to `"dry" | "sensitive" | "oily" | "combination"`.
2. Run `npx tsc --noEmit`.
3. Errors appear at `lib/email/quizResultEmail.ts:7` and `lib/quiz/packages.ts:12` (both `Record<SkinType, …>`), but **none in `lib/email/quizResultEmail.test.ts`**.

**Reproduction Verified:** Yes. Run on 2026-10-07, then reverted.

(Note: 3 unrelated `tsc` errors exist in this environment because `prisma generate` and Next typegen haven't run: `route.ts:15`, `validate.ts:9`, `layout.tsx:20`. Ignore them.)

## Root Cause

### Affected Components

- **Files**: `lib/email/quizResultEmail.test.ts`
- **Functions/Classes**: the `LABELS` constant (lines 7–11) and its casts at lines 15, 31 and 46
- **Dependencies**: none

### Analysis

**Evidence Chain (5 Whys):**
```
WHY does a new SkinType go untested without a compile error?
  → because the tests iterate LABELS, and nothing forces LABELS to contain every SkinType
    (evidence: quizResultEmail.test.ts:14 — it.each(Object.entries(LABELS)); :28 — it.each(Object.keys(LABELS)))
WHY doesn't anything force that?
  → because LABELS's type is inferred from its own literal and has no relation to SkinType
    (evidence: quizResultEmail.test.ts:7-11 — const LABELS = { dry: "Dry", sensitive: "Sensitive", oily: "Oily" } as const;)
WHY doesn't the call into buildQuizResultEmail(skinType: SkinType) catch it?
  → because the keys are cast to keyof typeof LABELS, and a subset of SkinType is always assignable to SkinType
    (evidence: :15 — skinType as keyof typeof LABELS; :31 — const typed = skinType as keyof typeof LABELS; :46 — other as keyof typeof LABELS)
ROOT CAUSE: LABELS is declared `as const` instead of `Record<SkinType, string>`
    (evidence: quizResultEmail.test.ts:7-11)
```

**Why This Occurs:**
The production module already uses the right pattern (`quizResultEmail.ts:7` — `const SKIN_TYPE_LABELS: Record<SkinType, string>`). The test didn't mirror it. Ticket 6 later copied the same cast style into a second test (plan `ticket-6-package-definition-display.md:274`: "cast `skinType as keyof typeof LABELS` the same way the existing test does"), so the gap now covers both `it.each` blocks.

**Code Location:**
```
lib/email/quizResultEmail.test.ts:7-11
const LABELS = {
  dry: "Dry",
  sensitive: "Sensitive",
  oily: "Oily",
} as const;
```

**History:** This behaviour has been there since the file was created in `a6fa621` (2026-09-22, ticket 5). `19c3b01` (2026-09-28, ticket 6) added the second test with the same cast. It is not a regression.

### Related Issues

- **Scope wider than the issue text:** the issue cites only line 15. The same cast appears at lines 31 and 46, in the package-content test that ticket 6 added. The fix should cover all 3.
- **Same class of gap elsewhere (out of scope, mention only):**
  - `lib/quiz/packages.test.ts:7` uses `const SKIN_TYPES: SkinType[] = ["dry", "sensitive", "oily"]`.
  - `app/api/quiz-response/validate.ts:7` uses `const VALID_SKIN_TYPES: SkinType[] = [...]`.
  - An array annotated `SkinType[]` rejects bad values but doesn't require *every* value. So a new skin type would also go untested in `packages.test.ts`. More importantly, the API would **reject it at runtime** in `validate.ts`. The `validate.ts` case is a real behavioural risk, not just test hygiene. It deserves its own issue rather than a drive-by fix (per CLAUDE.md).

## Impact Assessment

**Scope:** One test file. No runtime code paths.

**Affected Features:** Unit test coverage for the result email (`buildQuizResultEmail`).

**Severity Justification:** Low. Adding a skin type already breaks the build through `quizResultEmail.ts:7` and `packages.ts:12`, so the gap only shows up after those are fixed. At that point the email tests would pass while silently skipping the new type.

**Data/Security Concerns:** None.

## Proposed Fix

### Fix Strategy

Type `LABELS` as `Record<SkinType, string>`. Do the key cast once, at the point of iteration, and drop the 3 `keyof typeof LABELS` casts. Optionally, move the fixed subject assertion into its own test.

### Files to Modify

1. **lib/email/quizResultEmail.test.ts**
   - Changes:
     - Add `import type { SkinType } from "@/lib/quiz/types";`. Put it in the `@/lib/...` import group, matching `packages.test.ts:2-3`.
     - `const LABELS: Record<SkinType, string> = { dry: "Dry", sensitive: "Sensitive", oily: "Oily" };` (drop `as const`).
     - Add `const SKIN_TYPES = Object.keys(LABELS) as SkinType[];`. This is the single, safe cast: the `Record` type guarantees the keys are exactly `SkinType`.
     - Test 1: `it.each(SKIN_TYPES)(…, (skinType) => { const label = LABELS[skinType]; … buildQuizResultEmail(skinType) … })`. `otherLabels` stays as `Object.values(LABELS).filter(...)`.
     - Test 2: `it.each(SKIN_TYPES)`. Remove the `typed` variable, and build `otherNames` from `SKIN_TYPES.filter(...).map(getPackageForSkinType)`.
     - Optional (issue's second finding): move `expect(content.subject).toMatch(/skin type/i)` out of the loop into one standalone `it("uses a skin-type subject line", …)` for any single skin type.
   - Reason: a missing or extra key in `LABELS` becomes a compile error, and no cast remains that could hide a mismatch.

### Alternative Approaches

- **The issue's exact suggestion** (keep `Object.entries`, cast its key to `SkinType`): this works, but leaves a cast in each test. A single `SKIN_TYPES` derived from the typed record is cleaner and removes all 3 casts at the call sites.
- **Export `SKIN_TYPE_LABELS` from `quizResultEmail.ts` and reuse it:** rejected. The test would then check production data against itself and could no longer catch a wrong label (for example, `oily: "Dry"`).
- **`satisfies Record<SkinType, string>`:** also enforces exhaustiveness and keeps literal types. It's fine, but `Record<SkinType, string>` matches the existing house style (`quizResultEmail.ts:7`, `packages.ts:12`, `scoring.ts:11`).

### Risks and Considerations

- Test-only change. No production impact.
- `it.each` titles still interpolate `%s` with the skin-type string, so test names stay the same.

### Testing Requirements

**Test Cases Needed:**
1. Existing 6 cases (3 skin types × 2 tests) still pass.
2. Negative check (manual, then revert): add a value to `SkinType`. `tsc` must now report an error in `lib/email/quizResultEmail.test.ts` (missing property in `Record<SkinType, string>`).
3. Optional: the standalone subject test passes.

**Validation Commands:**
```bash
npx vitest run lib/email/quizResultEmail.test.ts
npm test
npx tsc --noEmit   # expect only the 3 pre-existing env errors (Prisma/Next typegen), none in the test file
npm run lint
```

## Implementation Plan

1. Add the `SkinType` import and retype `LABELS` as `Record<SkinType, string>`.
2. Derive `SKIN_TYPES` once and replace both `it.each` sources and all 3 `keyof typeof LABELS` casts.
3. Optionally, pull the subject assertion into its own test.
4. Run the validation commands. Do the temporary negative check on `SkinType`, then revert it.
5. Draft (don't file without approval) a follow-up issue for the `SkinType[]` exhaustiveness gap in `validate.ts:7` / `packages.test.ts:7`.

This RCA document should be used by the `piv-implement-issue` skill.

## Next Steps

1. Review this RCA document
2. Run the `piv-implement-issue` skill with issue #11 to implement the fix
3. Run the `piv-commit` skill after implementation complete
