#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///
"""
PreToolUse hook — the deterministic guardrail.

Fires BEFORE every matched tool call. It inspects what the agent is about to do
and, if the call crosses a line you never want crossed, blocks it: print the
reason to stderr and exit(2). Claude Code stops the tool and hands the reason
back to the agent, so it adapts instead of doing the thing.

Two guarantees ship here:
  1. The agent can never reach your secrets — not the env file, not the other
     credential files (ssh keys, .pem, .aws, .netrc, credentials.json), and not
     by dumping the process environment. Committed `.env.example` is allowed.
  2. The agent can never run a destructive `rm -rf`.
  3. The agent can never put a server-only secret name (RAZORPAY_KEY_SECRET etc.)
     into a "use client" file, which would ship it to the browser.
  4. The agent can never write Order.status outside lib/orders.ts.

Everything else is allowed (exit 0). The hook FAILS OPEN: any unexpected error
exits 0, so a bug in this script can never brick your session.

MAKE IT YOURS: the two `is_*` functions below are the entire policy. Add your own
(protected paths, prod config, lockfiles, migrations), or run the `hooks-create`
skill and describe the guarantee you want in plain English.

A note on coverage: the hook is GUARANTEED to run — what it CATCHES is only as
good as the checks below. This blocks the obvious routes, not every conceivable
one. The hook is the enforcement point; you still own the coverage.
"""

import json
import re
import sys

# Committed template files that are safe to read. Everything else that looks like
# an env file is treated as real secrets. Change this one line if your repo uses a
# different convention (e.g. add ".env.sample" or ".env.template").
ENV_TEMPLATE_SUFFIXES = (".env.example",)

# Secrets do not only live in `.env` — these are the other usual homes.
SECRET_PATH = re.compile(
    r"\.env\b|\.pem$|\.key$|id_rsa|id_ed25519|\.ssh/|\.aws/credentials|\.netrc|credentials\.json",
    re.IGNORECASE,
)

# ...and they do not only live in FILES. Each of these reads them straight out of
# the process environment, which a file-only guard waves right through.
ENV_DUMP = (
    re.compile(r"\bprintenv\b", re.IGNORECASE),
    re.compile(r"^\s*env\s*(\||>|$)", re.IGNORECASE),            # bare `env`, maybe piped
    re.compile(r"\becho\b.*\$\{?[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)", re.IGNORECASE),
    re.compile(r"os.environ|process\.env|ENV\[", re.IGNORECASE),
)

BLOCKED_ENV_MESSAGE = (
    "BLOCKED: access to secrets is not allowed.\n"
    "Read a committed .env.example template instead."
)
BLOCKED_RM_MESSAGE = "BLOCKED: refusing to run a recursive-force delete (rm -rf)."

# Server-only env vars (see CLAUDE.md). A "use client" file ships to the browser,
# so none of these may appear in one. RAZORPAY_KEY_ID is public by design.
SERVER_SECRETS = re.compile(
    r"\b(RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|RESEND_API_KEY|DATABASE_URL)\b"
)
USE_CLIENT = re.compile(r"""^\s*(//[^\n]*\n\s*|/\*.*?\*/\s*)*['"]use client['"]""", re.DOTALL)

BLOCKED_CLIENT_SECRET_MESSAGE = (
    "BLOCKED: server-only secret ({name}) in a \"use client\" file ({path}).\n"
    "Client components ship to the browser. Keep secrets in a server-only module in lib/ "
    "(like lib/razorpay.ts) or an API route, and pass the client only what it needs."
)


def _is_template(path: str) -> bool:
    return path.endswith(ENV_TEMPLATE_SUFFIXES)


GIT_COMMIT = re.compile(r"\bgit\b[^;&|\n]*?\bcommit\b")
# -m / --message / -am followed by a quoted message.
COMMIT_MESSAGE_ARG = re.compile(
    r"""(?<!\S)(-[a-zA-Z]*m|--message)(=|\s+)('[^']*'|"(?:[^"\\]|\\.)*")"""
)
# <<EOF ... EOF  /  <<'EOF' ... EOF  (body = group 3)
HEREDOC = re.compile(r"""<<-?\s*(['"]?)(\w+)\1[^\n]*\n(.*?)\n\s*\2\b""", re.DOTALL)


def _strip_commit_message(command: str) -> str:
    """Drop a git commit's message text, so prose mentioning `.env` isn't read as access.

    Only text bash passes through literally is dropped: single-quoted strings, quoted
    heredocs, and double-quoted strings or bare heredocs with no `$`/backtick. Anything
    that could run a command (e.g. "$(cat .env)") stays and is still checked.
    """
    if not GIT_COMMIT.search(command):
        return command

    def message(m):
        text = m.group(3)
        if text.startswith('"') and re.search(r"[$`]", text):
            return m.group(0)
        return f"{m.group(1)}{m.group(2)}''"

    def heredoc(m):
        quoted, body = m.group(1), m.group(3)
        if not quoted and re.search(r"[$`]", body):
            return m.group(0)
        return m.group(0).replace(body, "", 1)

    return HEREDOC.sub(heredoc, COMMIT_MESSAGE_ARG.sub(message, command))


def is_secret_access(tool_name: str, tool_input: dict) -> bool:
    """True if the call would reach a credential — by file OR by environment."""
    # File tools: check the path argument.
    if tool_name in ("Read", "Edit", "MultiEdit", "Write", "NotebookEdit"):
        path = tool_input.get("file_path", "").replace("\\", "/")
        return bool(SECRET_PATH.search(path)) and not _is_template(path)

    # Grep: only the searched path can reach a secret file. The regex itself may
    # legitimately mention `process.env`, and .env is gitignored so a project-wide
    # grep skips it.
    if tool_name == "Grep":
        target = tool_input.get("path", "").replace("\\", "/")
        return bool(SECRET_PATH.search(target)) and not _is_template(target)

    # Glob: a pattern like `**/.env*` would list the secret files.
    if tool_name == "Glob":
        target = f"{tool_input.get('pattern', '')} {tool_input.get('path', '')}".replace("\\", "/")
        return bool(SECRET_PATH.search(target)) and ".env.example" not in target

    # Bash: the command may name a credential file OR dump the environment.
    if tool_name == "Bash":
        command = _strip_commit_message(tool_input.get("command", "")).replace("\\", "/")
        if any(p.search(command) for p in ENV_DUMP):
            return True
        return bool(SECRET_PATH.search(command)) and ".env.example" not in command

    return False


def server_secret_in_client(tool_name: str, tool_input: dict):
    """Name of a server secret the edit would put in a "use client" file, else None."""
    path = tool_input.get("file_path", "")
    if not path.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs")):
        return None

    try:
        with open(path, encoding="utf-8") as f:
            current = f.read()
    except OSError:
        current = ""  # new file

    if tool_name == "Write":
        added, after = tool_input.get("content", ""), tool_input.get("content", "")
    elif tool_name == "Edit":
        added = tool_input.get("new_string", "")
        after = current.replace(tool_input.get("old_string", ""), added, 1)
    elif tool_name == "MultiEdit":
        added, after = "", current
        for e in tool_input.get("edits", []):
            added += e.get("new_string", "") + "\n"
            after = after.replace(e.get("old_string", ""), e.get("new_string", ""), 1)
    else:
        return None

    if not USE_CLIENT.match(after):
        return None
    # Check the whole resulting file, so adding "use client" on top of an existing
    # secret reference is caught too, not just new secret references.
    m = SERVER_SECRETS.search(added) or SERVER_SECRETS.search(after)
    return m.group(1) if m else None


# Order.status may only change inside lib/orders.ts (idempotent transitions; the
# verify route and the webhook can both report the same payment). Tests may seed it.
ORDER_STATUS_OWNER = "lib/orders.ts"
ORDER_WRITE_CALL = re.compile(
    r"\b\w+\.order\.(update|updateMany|updateManyAndReturn|upsert|create|createMany|createManyAndReturn)\s*\("
)
RAW_ORDER_STATUS_SQL = re.compile(r"""UPDATE\s+["']?Order["']?\s+SET\b[^;`]*\bstatus\b""", re.IGNORECASE)

BLOCKED_ORDER_STATUS_MESSAGE = (
    "BLOCKED: Order.status written outside lib/orders.ts ({path}).\n"
    "Change order status only through the idempotent transition functions in lib/orders.ts "
    "(add one there if you need a new transition) and call it from here."
)


def _call_args(text: str, open_paren: int) -> str:
    """Text inside the parentheses starting at text[open_paren] (balanced)."""
    depth = 0
    for i in range(open_paren, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return text[open_paren + 1 : i]
    return text[open_paren + 1 :]


def _drop_where(args: str) -> str:
    """Remove `where: {...}` — filtering on status is a read, not a write."""
    m = re.search(r"\bwhere\s*:\s*\{", args)
    if not m:
        return args
    depth = 0
    for i in range(m.end() - 1, len(args)):
        if args[i] == "{":
            depth += 1
        elif args[i] == "}":
            depth -= 1
            if depth == 0:
                return args[: m.start()] + args[i + 1 :]
    return args[: m.start()]


def writes_order_status(tool_name: str, tool_input: dict) -> bool:
    """True if the edit leaves a file (other than lib/orders.ts) that writes Order.status."""
    path = tool_input.get("file_path", "").replace("\\", "/")
    if not path.endswith((".ts", ".tsx", ".js", ".mjs")):
        return False
    if path.endswith(ORDER_STATUS_OWNER) or re.search(r"\.(test|spec)\.\w+$", path):
        return False

    try:
        with open(path, encoding="utf-8") as f:
            after = f.read()
    except OSError:
        after = ""  # new file

    if tool_name == "Write":
        after = tool_input.get("content", "")
    elif tool_name == "Edit":
        after = after.replace(tool_input.get("old_string", ""), tool_input.get("new_string", ""), 1)
    elif tool_name == "MultiEdit":
        for e in tool_input.get("edits", []):
            after = after.replace(e.get("old_string", ""), e.get("new_string", ""), 1)
    else:
        return False

    if RAW_ORDER_STATUS_SQL.search(after):
        return True
    for m in ORDER_WRITE_CALL.finditer(after):
        args = _drop_where(_call_args(after, m.end() - 1))
        if re.search(r"\bstatus\s*:", args):
            return True
    return False


def is_dangerous_rm(tool_name: str, tool_input: dict) -> bool:
    """True if a Bash command is a recursive-force delete (rm -rf and variants)."""
    if tool_name != "Bash":
        return False
    command = " ".join(tool_input.get("command", "").lower().split())
    # rm with both recursive and force flags, in any order / spelling.
    return bool(
        re.search(r"\brm\b.*-[a-z]*r[a-z]*f", command)
        or re.search(r"\brm\b.*-[a-z]*f[a-z]*r", command)
        or re.search(r"\brm\b.*--recursive.*--force", command)
        or re.search(r"\brm\b.*--force.*--recursive", command)
    )


def main() -> None:
    try:
        data = json.load(sys.stdin)
        tool_name = data.get("tool_name", "")
        tool_input = data.get("tool_input", {})

        if is_secret_access(tool_name, tool_input):
            # exit 2 = block the tool; stderr goes back to the agent as the reason.
            print(BLOCKED_ENV_MESSAGE, file=sys.stderr)
            sys.exit(2)

        secret = server_secret_in_client(tool_name, tool_input)
        if secret:
            print(
                BLOCKED_CLIENT_SECRET_MESSAGE.format(name=secret, path=tool_input.get("file_path", "")),
                file=sys.stderr,
            )
            sys.exit(2)

        if writes_order_status(tool_name, tool_input):
            print(BLOCKED_ORDER_STATUS_MESSAGE.format(path=tool_input.get("file_path", "")), file=sys.stderr)
            sys.exit(2)

        if is_dangerous_rm(tool_name, tool_input):
            print(BLOCKED_RM_MESSAGE, file=sys.stderr)
            sys.exit(2)

        sys.exit(0)  # allow

    except Exception:
        # Fail open — never let a hook error stop the agent from working.
        sys.exit(0)


if __name__ == "__main__":
    main()
