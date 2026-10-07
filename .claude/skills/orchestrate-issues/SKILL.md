---
name: orchestrate-issues
description: Run the issue pipeline end to end — investigate, implement, PR, review — through background agents, with gates, a cap, and a digest. Send it one GitHub issue number; it takes the issue to a reviewed PR, stops before merge, and reports once. Several issues are queued and run one at a time.
---

# Orchestrate Issues

You coordinate; you don't do the work. Never edit product code, investigate, or review yourself —
the named skills and agents below do that. X is a GitHub issue number in this repo.

1. **Investigate + implement** — run `python .claude/skills/orchestrate-issues/fix-issue.py X` from the repo
   root as a background command. It runs `piv-investigate-issue` (fresh session), then `piv-implement-issue`
   (new session, working from the RCA), then the real checks in a fix loop (max 3 rounds), and stops with the
   fix uncommitted on a `fix/issue-X-*` branch. It refuses to start unless the repo is on `main`; if you're not,
   stop and tell me — don't switch branches with my work in them.
   **Evidence:** exit code 0, `docs/issues/issue-X.md` exists, current branch is not `main`.
2. **PR** — send a NEW agent: "Run `piv-commit`, then `piv-create-pr`, for the fix to GitHub issue #X
   (<issue title>). The RCA is `docs/issues/issue-X.md`; the commit message must include `Fixes #X`."
   (The commit judge hook will judge that commit against this request.)
   **Evidence:** `gh pr view` shows an open PR from the fix branch.
3. **Review** — send a NEW agent: "Run `piv-review-pr` on PR #<n>." It runs `piv-validate` and the
   `code-reviewer` agent and posts its verdict on the PR. There is no CI in this repo, so the review's
   validation result is the check — don't wait for a CI run.
   **Evidence:** the review is posted on the PR and its report file exists.
4. **Stop.** Never merge, close, or push to `main`. Send me one digest and wait.

Don't narrate while things run. If I send more issues, queue them and run one at a time.

## The digest

One short block per issue:

- issue #X + title → PR link (or where it stopped)
- each stage: ✅/❌ + one line (RCA path · checks + fix rounds used · PR · review verdict)
- anything the commit judge or review flagged, and any stage that needed a retry
- **the decision I need to make** (usually: merge PR #n?) and your recommendation

## The upgrade pass

- Run stages in the background; completion comes to you as a notification.
- If a stage is off course, message the SAME agent with a correction — steering beats respawning.
  (The script stage can't be steered: if it fails, report its last output.)
- Before reporting a stage done, check the evidence above. An agent saying "done" is a claim; an open PR
  with a posted review is a fact.
- A stage that stalls twice gets stopped and escalated, not restarted.
- A dead agent sends no notification at all — waiting for one is not a detection method. If a dispatched stage
  has produced no notification and no new evidence (a file, a commit, a reply) for about 20 minutes, check its
  status directly rather than keep waiting. Treat that silence as the first stall, the same as an explicit
  failure — it counts toward the cap above.
- The 20 minutes is a limit, not an opening offer — don't extend it because the agent seems close. Giving it
  "a bit more time" past that mark isn't patience, it's the second stall arriving late. (The script stage can
  legitimately take longer — judge it by its printed progress lines, not the clock alone.)
- The status check itself can go unanswered too — a truly dead agent won't respond to that either. Give the
  check its own short timeout (a few minutes, not another 20); silence on the check confirms the stall, it
  doesn't restart the clock. If the second stall is a check that never answers, stop and report what real work
  it already produced — don't send a third message into a process that's gone.

## When it goes wrong

If a workstream fails its gate twice or stalls, run the opportunity-scan on that run's artifacts — include
the symptom and what ran — and put its proposals in the digest. Never change the AI layer without my go.

## Not yet

Parallel issues, merging, standing decisions that skip the merge gate, CI, worktrees, and resuming after
this session ends. Add one only when a real run shows it's needed.
