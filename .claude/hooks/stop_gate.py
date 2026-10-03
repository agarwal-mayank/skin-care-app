#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///
"""
Stop hook — the GATE. Fires when the agent thinks it's done.

If there are uncommitted code changes, run the type check and the unit tests.
Green -> allowed to finish. Red -> exit 2 blocks the stop and the failure output
is handed back to the agent so it fixes it.

  * Skips when no code is uncommitted (nothing was built, nothing to gate).
  * Skips when the code is byte-identical to the last green run, so a chat-only
    turn doesn't pay ~10s of checks.
  * Bounded: after MAX_GATE_ATTEMPTS red stops in one session it lets the stop
    through and says so. `stop_hook_active` is NOT used as the bound — it is a
    boolean that goes true on the first retry, so it would gate only once.
  * Fails open: any unexpected error exits 0.

MAKE IT YOURS: CHECK_COMMAND is the one line to edit.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# typegen first: tsc needs Next's generated route types (LayoutProps etc.) in .next/,
# which are missing after a fresh clone or a deleted .next until `next dev` runs.
CHECK_COMMAND = "npx next typegen && npx tsc --noEmit && npm test"
MAX_GATE_ATTEMPTS = 3
OUTPUT_TAIL_LINES = 40

# Which uncommitted paths count as "code" worth gating.
CODE_PATH = re.compile(
    r"\.(ts|tsx|mts|cts|js|jsx|mjs)$|^prisma/|^package(-lock)?\.json$|^tsconfig[^/]*\.json$"
)


def _project_env() -> dict:
    """os.environ minus uv's ephemeral venv, so the project's own tools resolve."""
    env = os.environ.copy()
    venv = env.pop("VIRTUAL_ENV", None)
    if venv:
        drop = {os.path.join(venv, "Scripts"), os.path.join(venv, "bin")}
        env["PATH"] = os.pathsep.join(
            p for p in env.get("PATH", "").split(os.pathsep) if p not in drop
        )
    return env


def changed_code_files(root: Path) -> list:
    out = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=root, capture_output=True, text=True, check=True,
    ).stdout
    files = []
    for line in out.splitlines():
        path = line[3:].split(" -> ")[-1].strip('"')
        if CODE_PATH.search(path):
            files.append(path)
    return sorted(files)


def fingerprint(root: Path, files: list) -> str:
    """Hash of the changed code files' current contents (deleted files hash as gone)."""
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode())
        p = root / f
        h.update(p.read_bytes() if p.is_file() else b"<deleted>")
    return h.hexdigest()


def main() -> None:
    try:
        data = json.load(sys.stdin)
        root = Path(data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or ".")
        session_id = re.sub(r"[^\w-]", "_", data.get("session_id") or "unknown")

        files = changed_code_files(root)
        if not files:
            sys.exit(0)  # no uncommitted code — nothing to gate

        state_dir = root / ".claude" / "hooks" / ".gate-state"
        state_dir.mkdir(parents=True, exist_ok=True)
        green_file = state_dir / "last-green.sha"
        counter_file = state_dir / f"{session_id}.count"

        fp = fingerprint(root, files)
        if green_file.is_file() and green_file.read_text().strip() == fp:
            sys.exit(0)  # same code already passed

        result = subprocess.run(
            CHECK_COMMAND, shell=True, cwd=root, env=_project_env(),
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )

        if result.returncode == 0:
            green_file.write_text(fp)
            counter_file.unlink(missing_ok=True)
            sys.exit(0)  # green — allowed to finish

        tail = "\n".join((result.stdout + result.stderr).strip().splitlines()[-OUTPUT_TAIL_LINES:])
        attempt = int(counter_file.read_text() or 0) + 1 if counter_file.is_file() else 1

        if attempt >= MAX_GATE_ATTEMPTS:
            counter_file.unlink(missing_ok=True)
            print(
                f"Stop gate gave up after {MAX_GATE_ATTEMPTS} attempts. The checks are STILL FAILING "
                f"(`{CHECK_COMMAND}`); letting the stop through so a human can look. Last output:\n\n{tail}",
                file=sys.stderr,
            )
            sys.exit(0)  # the bound giving up on purpose, not the checks passing

        counter_file.write_text(str(attempt))
        print(
            f"Type check / tests failed (`{CHECK_COMMAND}`), attempt {attempt}/{MAX_GATE_ATTEMPTS}. "
            f"Fix them before finishing. Output:\n\n{tail}",
            file=sys.stderr,
        )
        sys.exit(2)  # block the stop

    except SystemExit:
        raise
    except Exception:
        sys.exit(0)  # fail open


if __name__ == "__main__":
    main()
