#!/usr/bin/env python3
"""
Permission Guard Hook for Claude Code (PreToolUse).

Policy (per user): full autonomous access to everything EXCEPT git commits
and pushes. Commits/pushes are deferred to the user via a native permission
prompt ("ask"); catastrophic system commands are hard-denied; everything
else is auto-allowed with no prompt.

Output uses the modern `permissionDecision` format. The legacy
`PermissionRequest` / `decision.behavior` shape is silently ignored by the
harness — do not revert to it.
"""

import json
import re
import sys

# Git operations deferred to the user (native permission prompt).
# Only commits and pushes are excluded from autonomy per user policy.
# The `(?<!["'\w])` prefix avoids false positives where the phrase appears
# inside a quoted argument (e.g. grep "git push") rather than as a command.
_PRE = r"(?<![\"'\w])"
ASK_GIT_PATTERNS = [
    rf"{_PRE}git\s+push\b",
    rf"{_PRE}git\s+commit\b",
]

# Catastrophic system commands — hard-blocked regardless of policy.
CATASTROPHIC_SYSTEM_PATTERNS = [
    r"\brm\s+-rf?\s+/",
    r"\brm\s+-rf?\s+~",
    r"\brm\s+-rf?\s+\$HOME",
    r"\bsudo\b",
    r"\bchmod\s+777\b",
    r"\bchown\b.*-R\s+/",
    r"\bmkfs\b",
    r"\bdd\b.*of=/dev/",
    r">\s*/dev/sd",
    r"\bkill\s+-9\s+-1\b",
    r"\breboot\b",
    r"\bshutdown\b",
    r"\binit\s+[0-6]\b",
]


def check_bash_command(command: str) -> tuple[str, str]:
    """Return (permission_decision, reason)."""
    for pattern in CATASTROPHIC_SYSTEM_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return "deny", f"Catastrophic system command blocked: matched /{pattern}/"
    for pattern in ASK_GIT_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return "ask", f"Commit/push deferred to user: matched /{pattern}/"
    return "allow", ""


def decide(input_data: dict) -> tuple[str, str]:
    """Return (permission_decision, reason)."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        return check_bash_command(command)

    # Read / Edit / Write / NotebookEdit / Glob / Grep / all other tools: allow.
    return "allow", ""


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # Cannot parse → fall back to the harness default (do not block).
        sys.exit(0)

    decision, reason = decide(input_data)

    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason or "Auto-approved by permission-guard.",
        }
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
