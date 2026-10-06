---
name: piv-fix-review-findings
description: Triage code-review findings (manual or AI), fix the ones you choose one at a time with tests, draft the deferred rest as GitHub issues (filed on approval), then validate — and if the work is on a PR, commit and push so the PR reflects the fixes. Use after a review has produced a list of issues or a review file.
argument-hint: "[code-review-file-or-issues] [scope / what to fix now vs defer]"
arguments: [review, scope]
---

# Fix Review Findings

A review produced findings — but a review is **input, not a work order.** You decide what happens to each one.

Code-review (file or description of issues): $review

Direction / scope (what to fix now vs defer): $scope

If the Code-review is a file, **read the entire file first** so you understand every finding before triaging.

## 1. Triage first (the human's call)

Sort the findings before touching code. Honor any direction in the scope argument; if it's unclear, surface the
findings grouped and **ask** rather than fixing everything by default:

- **Fix now (this PR)** — real, in-scope, belongs with this change.
- **Defer / log as an issue** — real but later; don't bloat this PR. File it as a GitHub issue (step 1b) instead
  of fixing it here.
- **Needs a human look / manual test** — anything you should inspect or test by hand before trusting it. Flag it,
  don't silently auto-fix.
- **Noise / won't-fix** — say why, then drop it.

Don't let the reviewer dictate scope — "real, but later" is a valid and common call; a clean small PR beats a
sprawling one.

## 1b. Draft the deferred set as issues — file only on approval

The repo is public, so nothing is filed without the human's yes.

1. **Verify each finding still exists** on the current code (re-check the file and line). Drop any that are
   already fixed.
2. **De-duplicate:** `gh issue list --state all --search "<key file or symbol>"` per finding. If an issue already
   covers it, comment the new evidence there instead of opening another.
3. **Draft** each body from `templates/deferred-issue.md` (**read it before drafting**). Related findings in the
   same file may share one issue.
4. **Ask once:** show the list of draft titles and labels (and any "comment on #N instead"), then wait. File only
   the ones approved: `gh issue create --title ... --label ... --body-file <draft>`. Write drafts to a temp file,
   never into the repo.

## 2. Fix the "fix now" set — one at a time

For each:
1. Explain what was wrong.
2. Make the fix.
3. Create and run a test that proves it.

## 3. Validate

Run the `piv-validate` skill to finalize the fixes.

## 4. If operating on a PR — commit and push

If these fixes are on a PR branch, **commit them (use `piv-commit`) and push** so the PR reflects the fixes and the
review can re-run on the updated PR. If nothing was fixed (everything deferred), there's nothing to push — just make
sure the approved deferred items are filed as issues (step 1b).

## Output

A short report: what was **fixed** (with its test), what was **deferred** (with the filed issue links, plus any
drafts the human declined), what needs a
**manual look/test** — and, if on a PR, the **pushed commit** + confirmation the PR is updated.
