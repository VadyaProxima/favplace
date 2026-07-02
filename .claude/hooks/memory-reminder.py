#!/usr/bin/env python3
"""
Memory Reminder Hook — reminds to update MEMORY.md if important files have changed.
Hook type: Stop (runs at the end of each Claude response).
"""

import json
import os
import subprocess
import sys

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

IMPORTANT_PATHS = [
    '.claude/agents',
    '.claude/rules',
    'scripts/',
]


def get_changed_files():
    try:
        r1 = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD'],
            capture_output=True, text=True, cwd=PROJECT_DIR
        )
        r2 = subprocess.run(
            ['git', 'ls-files', '--others', '--exclude-standard'],
            capture_output=True, text=True, cwd=PROJECT_DIR
        )
        files = []
        if r1.stdout.strip():
            files += r1.stdout.strip().split('\n')
        if r2.stdout.strip():
            files += r2.stdout.strip().split('\n')
        return [f for f in files if f]
    except Exception:
        return []


def main():
    try:
        json.load(sys.stdin)
    except Exception:
        pass

    changed = get_changed_files()
    important = [f for f in changed if any(p in f for p in IMPORTANT_PATHS)]

    if important:
        files_str = ', '.join(important[:4])
        if len(important) > 4:
            files_str += f' (+{len(important) - 4})'
        print(
            f"[memory] Changed: {files_str} — if you found a new gotcha, update MEMORY.md",
            file=sys.stderr
        )


if __name__ == "__main__":
    main()
