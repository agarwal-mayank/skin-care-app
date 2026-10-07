#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///
"""
PreToolUse hook (Bash, `git commit` only) — LLM-as-judge commit gate.

Before code is committed, one headless Claude call judges the diff against the
user's requests in this session and the project's CLAUDE.md rules.

  PASS          -> commit proceeds silently; this exact diff is remembered.
  FAIL 1..2     -> commit denied; the reason + next steps go back to the agent,
                   which fixes the work and retries the commit (re-judged).
  FAIL 3        -> report written to .claude/judge/reports/, commit denied and
                   the turn ends so the human decides. Committing that same diff
                   again is then allowed through once ("commit anyway").

Cheap guards first, so the model is only paid for when there is something new:
not a real commit / no code in the change / diff already passed -> silent allow;
type-check or tests red -> deny with their output (no model call).

Fails open: any unexpected error (or the judge being unreachable) allows the
commit, with a visible warning that it was NOT judged.
"""

import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Reuse the stop gate's definitions so both hooks agree on "code" and "green".
sys.dont_write_bytecode = True  # don't leave __pycache__/ in .claude/hooks
from stop_gate import CHECK_COMMAND, CODE_PATH, _project_env, changed_code_files, fingerprint

JUDGE_MODEL = "claude-sonnet-5-5"
MAX_ROUNDS = 3                 # failed judgments per session before handing back to the human
JUDGE_TIMEOUT_S = 180
JUDGE_MAX_BUDGET_USD = "1.00"  # hard cap per judgment
MAX_DIFF_CHARS = 60_000        # larger diffs are truncated (the judge is told)
MAX_REQUESTS = 10              # most recent user requests passed to the judge
RECURSION_ENV = "CLAUDE_COMMIT_JUDGE_ACTIVE"

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "reason": {"type": "string"},
        "next_steps": {"type": "array", "items": {"type": "string"}},
        "recommendations": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["ok", "reason", "next_steps", "recommendations"],
}

JUDGE_SYSTEM_PROMPT = """You are a strict but fair code reviewer acting as a commit gate.
You receive: the user's recent requests from a coding session, the project's rules
(CLAUDE.md), and the diff about to be committed.

PASS (ok=true) only if BOTH hold:
1. The diff correctly and completely does what the user asked for, as far as the
   requests relevant to this diff go. Ignore requests unrelated to this diff.
   No half-done work, no placeholder logic, no unrelated changes slipped in.
2. The diff follows the project rules, especially the ones a pattern-matcher can't
   check: fail loudly (no swallowed errors around money/PII), no invented
   Ayurvedic/product content, scope discipline (no auth, admin UI, fulfilment,
   subscriptions), Prisma types not hand-written, third-party clients in lib/.
   (Server secrets in client files and Order.status writes are already enforced
   by other hooks; you need not re-check them.)

FAIL (ok=false) only for concrete, actionable problems you can point to in the
diff. Do not fail for style preferences, missing nice-to-haves, or things you
cannot see. If the diff was truncated, judge what you can see.

reason: 1-4 sentences, specific (file + problem).
next_steps: concrete fixes the coding agent should make (empty if ok).
recommendations: optional advice for the human (may be empty)."""


def is_git_commit(command: str):
    """Return (is_commit, stages_all) for the Bash command."""
    is_commit = stages_all = False
    for part in re.split(r"&&|\|\||;|\n|\|", command):
        try:
            words = shlex.split(part, posix=True)
        except ValueError:
            words = part.split()
        while words and re.match(r"^\w+=", words[0]):  # leading VAR=x
            words = words[1:]
        if not words or words[0] != "git":
            continue
        args = words[1:]
        # skip global options like `-C path` / `-c k=v`
        while args and args[0] in ("-C", "-c"):
            args = args[2:]
        if not args:
            continue
        if args[0] == "add":
            stages_all = True
        elif args[0] == "commit" and "--dry-run" not in args:
            is_commit = True
            if any(a in ("--all",) or re.match(r"^-[a-zA-Z]*a", a) for a in args[1:]):
                stages_all = True
    return is_commit, stages_all


def git(root: Path, *args) -> str:
    return subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True,
        encoding="utf-8", errors="replace", check=True,
    ).stdout


def code_diff(root: Path, stages_all: bool) -> str:
    """Diff of the code about to be committed."""
    if not stages_all:
        names = [n for n in git(root, "diff", "--cached", "--name-only").splitlines() if CODE_PATH.search(n)]
        return git(root, "diff", "--cached", "--", *names) if names else ""

    tracked = [n for n in git(root, "diff", "HEAD", "--name-only").splitlines() if CODE_PATH.search(n)]
    diff = git(root, "diff", "HEAD", "--", *tracked) if tracked else ""
    untracked = [
        n for n in git(root, "ls-files", "--others", "--exclude-standard").splitlines() if CODE_PATH.search(n)
    ]
    for n in untracked:
        try:
            body = (root / n).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        diff += f"\n--- /dev/null\n+++ b/{n}  (new file)\n" + "".join(f"+{l}\n" for l in body.splitlines())
    return diff


def user_requests(transcript_path: str) -> list:
    """The human's own prompts from the session transcript (most recent last)."""
    prompts = []
    try:
        with open(transcript_path, encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") != "user" or d.get("isMeta") or d.get("isSidechain"):
                    continue
                content = d.get("message", {}).get("content")
                if isinstance(content, str) and content.strip() and not content.lstrip().startswith("<"):
                    prompts.append(content.strip()[:1500])
    except OSError:
        pass
    return prompts[-MAX_REQUESTS:]


def run_judge(root: Path, requests: list, diff: str):
    """One headless judgment. Returns the verdict dict, or None if unavailable."""
    claude = shutil.which("claude")
    if not claude:
        return None
    truncated = len(diff) > MAX_DIFF_CHARS
    try:
        rules = (root / "CLAUDE.md").read_text(encoding="utf-8")
    except OSError:
        rules = "(CLAUDE.md not found)"
    prompt = (
        "## User requests (oldest first)\n"
        + ("\n".join(f"- {r}" for r in requests) or "- (none found)")
        + "\n\n## Project rules (CLAUDE.md)\n" + rules
        + "\n\n## Diff to be committed" + (" (TRUNCATED)" if truncated else "") + "\n```diff\n"
        + diff[:MAX_DIFF_CHARS] + "\n```\n"
    )
    env = _project_env()
    env[RECURSION_ENV] = "1"
    try:
        p = subprocess.run(
            [claude, "-p", "--model", JUDGE_MODEL, "--tools", "", "--setting-sources", "user",
             "--no-session-persistence", "--output-format", "json",
             "--max-budget-usd", JUDGE_MAX_BUDGET_USD,
             "--system-prompt", JUDGE_SYSTEM_PROMPT, "--json-schema", json.dumps(VERDICT_SCHEMA)],
            input=prompt, cwd=root, env=env, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=JUDGE_TIMEOUT_S,
        )
        verdict = json.loads(p.stdout).get("structured_output")
        if isinstance(verdict, dict) and isinstance(verdict.get("ok"), bool):
            return verdict
    except (subprocess.TimeoutExpired, ValueError, OSError):
        pass
    return None


# ── state ────────────────────────────────────────────────────────────────────
def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def save_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=1), encoding="utf-8")


def emit(obj: dict) -> None:
    print(json.dumps(obj))
    sys.exit(0)


def deny(reason: str, end_turn: str = "") -> None:
    out = {"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason,
    }}
    if end_turn:
        out.update({"continue": False, "stopReason": end_turn})
    emit(out)


def write_report(root: Path, rounds: list, diff: str, requests: list) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    path = root / ".claude" / "judge" / "reports" / f"{stamp}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    last = rounds[-1]
    branch = git(root, "rev-parse", "--abbrev-ref", "HEAD").strip()
    files = sorted(set(re.findall(r"^\+\+\+ b/(\S+)", diff, re.MULTILINE)))
    lines = [
        f"# Commit judge gave up — {stamp}",
        "",
        f"**Branch:** `{branch}` · **Judge:** {JUDGE_MODEL} · **Rounds failed:** {len(rounds)}/{MAX_ROUNDS}",
        "",
        "The commit was blocked and the turn ended so you can decide. Committing this exact",
        "change again is allowed through once; any further edit gets judged afresh.",
        "",
        "## What's still wrong",
        last.get("reason", ""),
        "",
        "## Next steps",
        *[f"- {s}" for s in last.get("next_steps") or ["(none given)"]],
        "",
        "## Recommendations",
        *[f"- {s}" for s in last.get("recommendations") or ["(none given)"]],
        "",
        "## Round history",
    ]
    for i, r in enumerate(rounds, 1):
        lines += [f"### Round {i}", r.get("reason", ""), *[f"- {s}" for s in r.get("next_steps", [])], ""]
    lines += ["## Files in the judged change", *[f"- `{f}`" for f in files], "",
              "## Requests the judge considered", *[f"- {q[:300]}" for q in requests]]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def main() -> None:
    try:
        if os.environ.get(RECURSION_ENV):
            sys.exit(0)  # never judge from inside a judge
        data = json.load(sys.stdin)
        if data.get("tool_name") != "Bash":
            sys.exit(0)
        is_commit, stages_all = is_git_commit(data.get("tool_input", {}).get("command", ""))
        if not is_commit:
            sys.exit(0)

        root = Path(data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or ".")
        diff = code_diff(root, stages_all)
        if not diff.strip():
            sys.exit(0)  # no code in this commit

        state_dir = root / ".claude" / "judge" / "state"
        passed_file = state_dir / "passed.json"
        escalated_file = state_dir / "escalated.json"
        session_id = re.sub(r"[^\w-]", "_", data.get("session_id") or "unknown")
        session_file = state_dir / f"{session_id}.json"
        fp = hashlib.sha256(diff.encode()).hexdigest()

        passed = load_json(passed_file, [])
        if fp in passed:
            sys.exit(0)  # this exact change already passed

        escalated = load_json(escalated_file, [])
        if fp in escalated:
            escalated.remove(fp)
            save_json(escalated_file, escalated)
            emit({"systemMessage": "Commit judge: committing a change it failed "
                  f"{MAX_ROUNDS}x, at your request. See .claude/judge/reports/."})

        # Deterministic checks first — no point paying to judge code that doesn't build.
        green_file = root / ".claude" / "hooks" / ".gate-state" / "last-green.sha"
        tree_fp = fingerprint(root, changed_code_files(root))
        if not (green_file.is_file() and green_file.read_text().strip() == tree_fp):
            checks = subprocess.run(
                CHECK_COMMAND, shell=True, cwd=root, env=_project_env(),
                capture_output=True, text=True, encoding="utf-8", errors="replace",
            )
            if checks.returncode != 0:
                tail = "\n".join((checks.stdout + checks.stderr).strip().splitlines()[-30:])
                deny(f"Commit blocked: type-check/tests failed (`{CHECK_COMMAND}`). "
                     f"Fix them first; the commit judge runs once they're green.\n\n{tail}")
            green_file.parent.mkdir(parents=True, exist_ok=True)
            green_file.write_text(tree_fp)

        requests = user_requests(data.get("transcript_path", ""))
        verdict = run_judge(root, requests, diff)
        if verdict is None:
            emit({"systemMessage": "Commit judge unavailable (timeout or error) — this commit was NOT judged."})

        session = load_json(session_file, {"rounds": []})
        if verdict["ok"]:
            save_json(passed_file, (passed + [fp])[-50:])
            session_file.unlink(missing_ok=True)
            sys.exit(0)

        session["rounds"].append(verdict)
        n = len(session["rounds"])
        steps = "\n".join(f"- {s}" for s in verdict.get("next_steps", []))
        if n < MAX_ROUNDS:
            save_json(session_file, session)
            deny(f"Commit judge FAIL (round {n}/{MAX_ROUNDS}): {verdict['reason']}\n\n"
                 f"Fix this, then retry the commit:\n{steps}")

        report = write_report(root, session["rounds"], diff, requests)
        session_file.unlink(missing_ok=True)
        save_json(escalated_file, (escalated + [fp])[-20:])
        rel = report.relative_to(root).as_posix()
        deny(f"Commit judge FAIL (round {n}/{MAX_ROUNDS}): {verdict['reason']} — giving up; report at {rel}.",
             end_turn=f"Commit judge failed this change {MAX_ROUNDS} times, so the commit was blocked and "
                      f"I've stopped. Review {rel} (what's wrong, next steps, recommendations). "
                      "To commit it anyway, ask again; to keep iterating, say what to change.")

    except SystemExit:
        raise
    except Exception:
        sys.exit(0)  # fail open


if __name__ == "__main__":
    main()
