# Deferred-finding issue body

Fill this in for each finding triaged as **Defer**. Drop any section that would be empty; don't pad it.
Live examples: issues #6–#11. Keep the sections in sync with `.github/ISSUE_TEMPLATE/bug.yml`.

**The repo is public: describe the code, never the data.**
- No real emails, phone numbers, addresses, quiz answers, keys/env values, or local paths (e.g. review files).
- A finding that is **exploitable** (payment, webhook signature, secrets, PII exposure) is **not drafted for
  public filing**: flag it to the human as sensitive and let them decide (private fix, or a GitHub security
  advisory).

**Title:** describe the problem from the user's or maintainer's point of view, not the fix
(e.g. "Quiz renders a blank screen instead of failing loudly when the result is missing").

**Labels:** one or more of the repo's existing labels (`gh label list`): `bug`, `accessibility`,
`enhancement`, `documentation`, plus `good first issue` (tests/config only, no behaviour change)
or `help wanted` (needs a human action an agent can't take, e.g. a dashboard or DNS change).

```markdown
## Summary
<1–3 sentences: what's wrong and what it means for a visitor or maintainer>

## Where
`path/to/file.ts:LINE` (use line numbers on `main`, or note "on branch X, not yet on main")
<the offending snippet, if short>

## Steps to reproduce        <!-- or "## Why it matters" when it isn't reproducible today -->
<numbered steps, or why it's latent and what would expose it>

## Suggested fix
<the reviewer's fix, concretely; a snippet if it's short>

## Acceptance criteria
- [ ] <observable outcome>
- [ ] <test that proves it>

---
Found in the automated review of #<PR number> (<severity>, finding <n>).
```
