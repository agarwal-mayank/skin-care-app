#!/usr/bin/env python3
"""
fix-issue.py — investigate and implement a fix for one GitHub issue, with a
deterministic validation loop, then stop.

  1. INVESTIGATE  fresh headless session runs /piv-investigate-issue N
                  evidence: docs/issues/issue-N.md exists
  2. IMPLEMENT    NEW headless session runs /piv-implement-issue N
                  (fresh context: it works from the written RCA, not the
                  investigator's memory; it creates the fix/issue-N-* branch)
  3. VALIDATE     the real checks, run by this script — no agent opinion.
                  Red -> the exact output goes back to the SAME implement
                  session (it remembers what it was doing). Max 3 rounds.

It does NOT commit, open a PR or review: those are the orchestrator's next
stages, done by fresh agents. Auth is your normal Claude login — no keys here.

The project's hooks (secrets / Order.status guards, stop gate) also run inside
these headless sessions.

Usage (from the repo root, on main):  python .claude/skills/orchestrate-issues/fix-issue.py 42
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):  # Windows console: allow the arrows below
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[3]
BASE_BRANCH = "main"

# Same as piv-validate and the stop gate (+ eslint). The line to edit if checks change.
CHECK_COMMAND = "npx next typegen && npx tsc --noEmit && npm test && npx eslint ."

MAX_FIX_ATTEMPTS = 3            # an unbounded fix loop is money spent on a wall
CALL_TIMEOUT_S = 30 * 60        # per headless call
CALL_BUDGET_USD = "5.00"        # per headless call

# Workers chain commands (`cd … ; npm test | tail`), and every part of a chain must
# be allowed, so harmless read-only helpers are listed too. `sed -n` only prints.
ALLOWED_TOOLS = ",".join([
    "Read", "Edit", "Write", "Glob", "Grep", "Agent",
    "Bash(npm *)", "Bash(npx *)", "Bash(git *)", "Bash(gh *)",
    "Bash(cd *)", "Bash(echo *)", "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)",
    "Bash(grep *)", "Bash(wc *)", "Bash(sed -n *)", "Bash(mkdir *)",
])

WORKER_FLAGS = [
    "--permission-mode", "acceptEdits",
    "--allowedTools", ALLOWED_TOOLS,
    "--strict-mcp-config",          # no MCP connectors: workers don't need Gmail/Drive/etc.
    # Chains with redirects/subshells get denied even when each command is allowed.
    "--append-system-prompt",
    "You are already in the repo root. Run ONE plain command per Bash call: no `cd`, `;`, `&&`, "
    "pipes, redirects (`>`, `2>&1`), subshells or `$?`. Command output and exit status are returned "
    "to you directly.",
    "--max-budget-usd", CALL_BUDGET_USD,
]


def sh(cmd: str) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def ask(prompt: str, *extra: str) -> dict:
    """One headless Claude call. JSON out so we get the session id back."""
    p = subprocess.run(
        ["claude", "-p", prompt, "--output-format", "json", *WORKER_FLAGS, *extra],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=CALL_TIMEOUT_S,
    )
    try:
        out = json.loads(p.stdout)
    except ValueError:
        fail(f"headless call returned no JSON (exit {p.returncode}):\n{(p.stderr or p.stdout)[-1500:]}")
    if out.get("is_error"):
        fail(f"headless call errored ({out.get('subtype')}): {str(out.get('result'))[-1500:]}")
    return out


def fail(msg: str) -> None:
    print(f"✗ {msg}")
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        sys.exit("usage: fix-issue.py <issue-number>")
    issue = sys.argv[1]

    # ── 0. PRECONDITIONS ─────────────────────────────────────────────────────
    branch = sh("git rev-parse --abbrev-ref HEAD").stdout.strip()
    if branch != BASE_BRANCH:
        fail(f"on '{branch}', not '{BASE_BRANCH}'. Switch first, so the fix branch starts from {BASE_BRANCH}.")
    view = sh(f"gh issue view {issue} --json number,state,title")
    if view.returncode != 0:
        fail(f"can't read issue #{issue} with gh (installed and logged in? restart the terminal "
             f"if gh was just installed):\n{view.stderr.strip()}")
    meta = json.loads(view.stdout)
    if meta["state"] != "OPEN":
        fail(f"issue #{issue} is {meta['state']}, not OPEN.")
    print(f"→ issue #{issue}: {meta['title']}")

    # ── 1. INVESTIGATE (fresh session) ───────────────────────────────────────
    print("→ investigating")
    ask(f"/piv-investigate-issue {issue}")
    rca = ROOT / "docs" / "issues" / f"issue-{issue}.md"
    if not rca.is_file():
        fail(f"investigation finished but {rca.relative_to(ROOT)} doesn't exist — no evidence, stopping.")
    print(f"✓ RCA written: {rca.relative_to(ROOT).as_posix()}")

    # ── 2. IMPLEMENT (NEW session, works from the RCA) ───────────────────────
    print("→ implementing")
    session = ask(f"/piv-implement-issue {issue}")["session_id"]

    # ── 3. VALIDATE — failures go back to the SAME implement session ─────────
    attempt = 1
    while True:
        checks = sh(CHECK_COMMAND)
        if checks.returncode == 0:
            print("✓ checks pass")
            break
        output = (checks.stdout + checks.stderr).strip()
        if attempt > MAX_FIX_ATTEMPTS:
            print("\n".join(output.splitlines()[-20:]))
            fail(f"still failing after {MAX_FIX_ATTEMPTS} fix attempts — stopping so a human can look.")
        print(f"→ checks failed (attempt {attempt}/{MAX_FIX_ATTEMPTS}) — handing the output back")
        ask(f"The checks failed (`{CHECK_COMMAND}`). Fix them. Exact output:\n\n{output[-8000:]}",
            "--resume", session)
        attempt += 1

    fix_branch = sh("git rev-parse --abbrev-ref HEAD").stdout.strip()
    if fix_branch == BASE_BRANCH:
        fail(f"checks pass but the work is still on {BASE_BRANCH} — expected a fix branch. Stopping.")
    changed = sh(f"git status --porcelain").stdout.strip() or "(nothing uncommitted)"

    # ── STOP. No commit, PR or review — that's the next agents' job. ─────────
    print(f"✓ done — issue #{issue} implemented and validated on branch '{fix_branch}'.")
    print(f"  RCA: {rca.relative_to(ROOT).as_posix()}")
    print(f"  changes (uncommitted):\n{changed}")
    print("  next: commit + open the PR (fresh agent), then review (another fresh agent).")


if __name__ == "__main__":
    main()
