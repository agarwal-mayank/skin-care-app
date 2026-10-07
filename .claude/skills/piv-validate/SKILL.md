---
name: piv-validate
description: Runs this project's full validation suite — tests, type checks, and linting across every part of the stack — then reports overall health. Use before committing, before opening a PR, or after finishing a chunk of work to confirm zero regressions.
---

# Validate

Run every check this project has and report a single PASS/FAIL verdict.

All commands run from the **repo root** (one Next.js app; configs live there). They work the same in
Git Bash and PowerShell. Run them in order and keep going after a failure so the report covers
everything; capture the output of any command that fails. Each takes roughly 3–8 seconds.

## 1. Tests

```bash
npm test
```

Vitest (`vitest run`). **Expected:** all tests pass.

## 2. Type check

```bash
npx next typegen && npx tsc --noEmit
```

`next typegen` first: `tsc` needs Next's generated route types (`LayoutProps` etc.) in `.next/`, which
are missing after a fresh clone or a deleted `.next` until `next dev` runs. Without it, `tsc` fails on
correct code. **Expected:** no type errors.

## 3. Lint

```bash
npx eslint .
```

**Expected:** 0 errors. Warnings don't fail the check, but list any warnings in files the current change
touched.

## 4. Prisma schema

```bash
npx prisma validate
```

**Expected:** "The schema … is valid". Only meaningful when `prisma/schema.prisma` changed, but cheap.

## 5. Not part of this check

- **`npm run build`**: slow and needs the real server env vars; run it by hand before a release.
- **Razorpay / Resend live calls**: never from here. Checkout verification is a manual test-mode run.

## 6. Summary report

Report each check with a ✅ or ❌, then an overall verdict:

- One line per check
- **Overall: PASS or FAIL**

For every ❌, include the failing command and the relevant output. Do not fix anything here —
this skill reports; fixing is a separate step.

## Notes

- The stop gate, commit judge and `fix-issue.py` run the type-check + test core of this suite (not every
  command here), so a PASS here covers what they enforce.
- A checker that cannot fail is worthless. If you change a command, break something on purpose and
  confirm this skill reports ❌.
