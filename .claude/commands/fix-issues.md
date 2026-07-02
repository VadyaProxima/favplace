---
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent
description: Automated pipeline — diagnose issues, fix in parallel, verify, commit
---

Automated fix pipeline for company design system issues.

## Arguments

`$ARGUMENTS` — format: `{company} "{problem description}"`

Examples:
```
/fix-issues minimal "buttons too small, cards have no shadow, h2 in FAQ too large"
/fix-issues avito "accordion icons invisible on dark bg, chip text not readable"
/fix-issues minimal --from-report app/docs/reports/20260319-143022/analysis.md
```

## Parsing

From `$ARGUMENTS` extract:
- `company` — first token (minimal, avito, pik, jti, yandex)
- `problems` — quoted string with issue list, OR `--from-report {path}` to read from a QA report

If `--from-report` — read the report file and extract all problem descriptions from "Problematic Types" section. Ignore types marked ✅.

---

## Phase 1 — Pre-flight

### 1.1 Dev server check

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

If not `200`:
```bash
pnpm -C app dev &
sleep 8
```

### 1.2 Git check

```bash
git status --short
```

If there are uncommitted changes — warn the user: "There are uncommitted changes. Fixes will be on top of them. Continue? (y/n)". If user says no — stop.

---

## Phase 2 — Diagnosis (ds-inspector)

Launch a single ds-inspector agent to diagnose ALL problems at once:

```
Agent:
  subagent_type: ds-inspector
  prompt: |
    company: {company}
    problem: {full problems text}

    Diagnose all listed problems. For each one determine:
    - Is it DS-level or section-level?
    - What file needs to change?
    - What specific CSS variable or class is involved?

    Return the structured task list as documented in your instructions.
```

Wait for the agent to complete. Read the diagnostic report.

### Parse the diagnostic output

From the inspector's report extract two lists:

**DS-level tasks** — problems to fix in `ds.json`, `index.ds.css.twig`, or company twig:
```
{ scope: "global", problem: "...", expected: "...", variable: "--var-name" }
```

**Section-level tasks** — problems to fix in specific `.tpl` files:
```
{ target: "type/variant", problem: "...", expected: "..." }
```

### Decision checkpoint

Present the parsed task list to the user:

```
## Diagnosis complete

### DS-level fixes ({N}):
1. {variable} — {problem} → {expected}
2. ...

### Section-level fixes ({N}):
1. {type/variant} — {problem} → {expected}
2. ...

Total: {N} fixes. Proceed? (y/n/edit)
```

- `y` — proceed to Phase 3
- `n` — stop
- `edit` — user modifies the list, then proceed

If the user doesn't respond within the same turn — proceed automatically (the command is designed to be autonomous).

---

## Phase 3 — Parallel Fixes (ds-fixer)

### 3.1 Group tasks

Group fixes for efficient parallel execution:

1. **All DS-level fixes** → combine into ONE ds-fixer agent (they touch the same files: ds.json, twig)
2. **Section-level fixes** → one ds-fixer agent per section type (different types = different files = safe parallelism)
3. **Same type, different variants** → combine into one agent (e.g. all `cta/*` fixes in one agent)

### 3.2 Launch parallel agents

In a **single message**, launch all ds-fixer agents simultaneously:

**DS-level agent (if any):**
```
Agent:
  subagent_type: ds-fixer
  prompt: |
    company: {company}
    scope: global
    problem: |
      Fix these DS-level issues:
      1. {problem1} — expected: {expected1}
      2. {problem2} — expected: {expected2}
    expected: All listed DS properties corrected
```

**Section-level agents (one per type group):**
```
Agent:
  subagent_type: ds-fixer
  prompt: |
    company: {company}
    target: {type}/*
    problem: |
      Fix these issues in {type} sections:
      1. {variant1}: {problem} — expected: {expected}
      2. {variant2}: {problem} — expected: {expected}
    expected: All listed visual issues resolved
```

### 3.3 Collect results

After all agents finish, collect their reports:
- ✅ — fix verified, looks correct
- ⚠️ — partially fixed, needs attention
- ❌ — fix failed

For ⚠️ results — launch ONE more ds-fixer agent with refined prompt (max 1 retry per task).
For ❌ results — report to user, do not retry automatically.

---

## Phase 4 — Verification

### 4.1 Regenerate CSS (if DS-level fixes were made)

If any agent touched `ds.json` or twig:

```bash
node app/scripts/render-ds-css.mjs {company} --out app/src/generated-css-from-twig/{company}-ds.css
```

For avito/pik (rubber companies):
```bash
node app/scripts/render-ds-css.mjs {company} --production-ds --out app/src/generated-css-from-twig/{company}-ds.css
```

### 4.2 Full visual verification

Run the visual check on affected section types:

```bash
node app/tests/visual-check.mjs --company={company} --type={type1},{type2},...
```

If `--type` doesn't support multiple types, run for each type:
```bash
node app/tests/visual-check.mjs --company={company} --type={type}
```

### 4.3 Compare results

Read the new report.json. Compare with the baseline:

For each section that was fixed:
- Was `ok: false` before → `ok: true` now? → ✅ Fixed
- Still `ok: false`? → ⚠️ Not fully resolved
- New `ok: false` sections that were ok before? → ❌ Regression

---

## Phase 5 — Report & Commit

### 5.1 Summary

```
## Fix Pipeline Complete: {company}

### Results
- ✅ Fixed: {N} issues
- ⚠️ Partial: {N} issues (need manual attention)
- ❌ Failed: {N} issues
- 🔄 Regressions: {N} (new issues introduced)

### DS-level changes
- {file}: {what changed}

### Section-level changes
- {type/variant}: {what changed}

### Files modified
{list of all changed files}
```

### 5.2 Commit

If there are ✅ fixes and no ❌ regressions:

```
Shall I commit these fixes? (y/n)
```

If yes — create a commit:
```bash
git add {list of changed files}
git commit -m "fix({company}): {brief summary of fixes}"
```

If there are regressions — warn the user and do NOT auto-commit.

---

## Mass Replacement Optimization

If the inspector identifies the **same mechanical fix** needed in 6+ files (e.g., "replace `span` with `h3` in all FAQ questions", "add `text-muted` class to all disclaimer texts"):

**Do NOT launch 6+ separate ds-fixer agents.** Instead:

1. Use `Grep` to find all occurrences
2. Apply the fix via `Edit` tool with `replace_all` or via `Bash` with `sed`
3. Take a verification screenshot of 2-3 representative sections
4. If verification passes — include in the commit

This handles the pattern from the insights report where identical changes across 10+ files are faster with sed than with individual agents.

---

## Error Handling

- If ds-inspector fails → report the error, suggest manual diagnosis
- If a ds-fixer agent hangs (>5 min) → skip it, report to user
- If CSS regeneration fails → check for twig syntax errors, report
- If visual-check crashes → take manual Playwright screenshots instead
- **Never force-commit** if there are unresolved regressions

## Important Constraints

- **Do not modify `minimal` files** when fixing another company
- **Do not change container padding** without explicit user request (see container-stability.md)
- **Do not change `max-w-*` on inner containers** without explicit request
- **Do not touch `templates.json` or `template.json`** — only `.tpl` and `ds.json`
- After fixing `index.ds.css.twig` — remind about twig-sync for company twigs
