---
allowed-tools: Bash(git:*)
description: Create a commit with a meaningful message
---

Analyze the changes and create a commit.

## Current State

```
!`git status`
```

## Changes

```
!`git diff --staged`
```

```
!`git diff`
```

## Recent Commits (for style reference)

```
!`git log --oneline -5`
```

## Commit Rules

Format: `<type>: <description>`

Types:
- `feat` - new functionality
- `fix` - bug fixes
- `docs` - documentation
- `refactor` - refactoring
- `ci` - CI configuration
- `build` - build/dependencies

Rules:
- Space after colon
- Lowercase first letter
- No trailing period
- 50-72 characters

## Task

1. Add all changed files to staging (`git add .` or selectively)
2. Analyze what changed
3. Formulate a concise commit message following the rules above
4. Execute the commit — do NOT add any Co-Authored-By trailer

If `$ARGUMENTS` is provided — use it as a hint for the message.
