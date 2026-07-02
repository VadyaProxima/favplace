---
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
description: Autonomous DS QA pipeline — scan, analyze, fix, verify in iterative loop
---

Autonomous DS QA pipeline for company templates.

## Arguments

`$ARGUMENTS` — format: `{company} [flags]`

Examples:
```
/ds-qa minimal
/ds-qa minimal --type=hero,cta
/ds-qa minimal --quick
/ds-qa minimal --dry-run
/ds-qa minimal --theme=dark
/ds-qa minimal --viewport=375
/ds-qa minimal --no-ai
/ds-qa minimal --max-iterations=5
/ds-qa minimal --from-report=docs/reports/2026-03-30T08-20-27
```

## Parsing

From `$ARGUMENTS` extract:
- `company` — first token (minimal, avito, pik, jti, yandex)
- `--type=X` — comma-separated section types to check (default: all)
- `--quick` — light theme + desktop only (fast baseline)
- `--dry-run` — scan + analyze only, no fixes
- `--theme=X` — specific theme(s) (default: light,dark,accent)
- `--viewport=X` — specific viewport(s) (default: 1440,768,375)
- `--no-ai` — skip AI visual analysis (automated checks only)
- `--max-iterations=N` — fix loop iterations (default: 3)
- `--from-report=PATH` — skip scan, reuse existing report data

If company is missing or invalid — report error and stop.

---

## Phase 0 — Setup

### 0.1 Parse arguments and set defaults

```
company     = first token
themes      = --theme or "light,dark,accent"
viewports   = --viewport or "1440,768,375"
maxIter     = --max-iterations or 3
types       = --type or all
dryRun      = --dry-run flag
noAI        = --no-ai flag
fromReport  = --from-report path
```

If `--quick`: override themes=`light`, viewports=`1440`.

### 0.2 Dev server check

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

If not `200`:
```bash
pnpm -C app dev &
sleep 10
```

Re-check. If still not 200 — report error and stop.

### 0.3 Create run directory

```bash
RUN_DIR="app/docs/reports/$(date +%Y-%m-%dT%H-%M-%S)"
mkdir -p "${RUN_DIR}/screenshots/{company}/" "${RUN_DIR}/computed/{company}/"
```

Remember `RUN_DIR` for all subsequent phases.

### 0.4 Read QA rules

Read all 3 rule files (needed for Phases 2-3):
- `.claude/qa-rules/automated-checks.md`
- `.claude/qa-rules/visual-review-rules.md`
- `.claude/qa-rules/fix-rules.md`

Store their contents in variables for agent prompts.

### 0.5 Define section groups

6 groups for parallel execution:

| Group | Types |
|-------|-------|
| 1 | about, banner, benefits, blog |
| 2 | cards, catalog, contact, cta |
| 3 | download, faq, features, footer |
| 4 | header, hero, how-it-works, job-board |
| 5 | portfolio, pricing, problems, services |
| 6 | solutions, stats, team, teams, testimonials, timeline |

If `--type` specified: filter groups to only include the specified types. Skip empty groups entirely.

---

## Phase 1 — SCAN (parallel)

If `--from-report` is set: skip to Phase 2. Use `{fromReport}/scan-report.json` as scan data.

Launch **6 parallel Bash calls in a SINGLE message** (one per group):

```
For each group N (1-6) that has types after filtering:

  Bash (run_in_background):
    cd /Users/andrey/Documents/projects/chulakov/deeep-app-templates/app && \
    node tests/scan-group.mjs \
      --company={company} \
      --types={group_types_comma_separated} \
      --themes={themes} \
      --viewports={viewports} \
      --out=docs/reports/{runDirRelative}/group-{N}.json \
      --screenshots=docs/reports/{runDirRelative}/screenshots/{company}/ \
      --computed=docs/reports/{runDirRelative}/computed/{company}/
```

Where `{runDirRelative}` is the path relative to `app/` (strip `app/` prefix from RUN_DIR).

After **ALL** background tasks complete, merge results:

```bash
cd /Users/andrey/Documents/projects/chulakov/deeep-app-templates/app && \
node -e "
const fs = require('fs');
const dir = '{runDirRelative}';
const groups = [];
for (let i = 1; i <= 6; i++) {
  const p = dir + '/group-' + i + '.json';
  if (fs.existsSync(p)) groups.push(JSON.parse(fs.readFileSync(p, 'utf-8')));
}
const merged = {
  sections: groups.flatMap(g => g.sections || []),
  summary: {
    total: groups.reduce((s,g) => s + (g.summary?.total || 0), 0),
    scanned: groups.reduce((s,g) => s + (g.summary?.scanned || 0), 0),
    issues: groups.reduce((s,g) => s + (g.summary?.issues || 0), 0),
    themeUnaware: groups.reduce((s,g) => s + (g.summary?.themeUnaware || 0), 0)
  }
};
fs.writeFileSync(dir + '/scan-report.json', JSON.stringify(merged, null, 2));
console.log('Merged:', JSON.stringify(merged.summary));
"
```

Print scan summary: total sections, scanned, issues found, theme-unaware count.

If summary.issues === 0 and `--no-ai`: skip to Phase 5 (nothing to fix).

---

## Phase 2 — ANALYZE (parallel AI review)

If `--no-ai`: skip AI analysis. Use only automated check results from scan-report.json. Build issues-1.json from scan-report.json automated issues (severity: error) and proceed to Phase 3.

Read `visual-review-rules.md` content (already loaded in Phase 0).

Launch **6 parallel Agent calls in a SINGLE message** (one per group with sections):

```
For each group N that has scanned sections:

  Agent (run_in_background):
    prompt: |
      You are a DS QA visual reviewer for the deeep-app-templates project.
      Analyze screenshots and computed data for sections: {types_in_group}.
      Company: {company}.

      Screenshots directory: {RUN_DIR}/screenshots/{company}/
      Computed data directory: {RUN_DIR}/computed/{company}/
      Scan report path: {RUN_DIR}/scan-report.json

      REVIEW RULES (follow exactly):
      {visual-review-rules.md content}

      For each section in your group, look at ALL available screenshots
      (themes: {themes}, viewports: {viewports}).
      Cross-reference with computed data JSON to confirm visual observations.

      Output a JSON array (and NOTHING else outside the array):
      [
        {
          "section": "type/variant",
          "theme": "dark",
          "viewport": 768,
          "issue": "description of the problem",
          "severity": "error|warning",
          "category": "contrast|layout|rubber|component|overflow|typography",
          "recommendation": "specific fix suggestion"
        }
      ]

      Only report REAL problems. Do NOT duplicate issues already found in
      scan-report.json automated checks. Return [] if no new issues found.
```

After ALL agents complete, merge AI findings + automated issues into `issues-1.json`:

1. Read scan-report.json — extract all automated issues (from each section's checks).
2. Parse each agent's JSON output — extract AI-found issues.
3. Deduplicate: same section + same category + similar description = keep one.
4. Write merged result to `{RUN_DIR}/issues-{iteration}.json`.

Print analysis summary: N automated issues, M AI-found issues, total unique.

If total issues === 0: skip to Phase 5.

---

## Phase 3 — FIX

If `--dry-run`: skip to Phase 5 (report only, no fixes).

### 3.1 Classify issues

Read `issues-{iteration}.json`. For each issue:
- Count occurrences across sections by category.
- Same issue in **>= 3 sections of different types** -> `ds-level`
- Same issue in **>= 3 sections of same type** -> `section-type`
- 1-2 sections -> `section-variant`
- Content/placeholder issues -> `skip` (unfixable by code changes)

### 3.2 DS-level fixes (sequential, with blast-radius check)

For each DS-level fix, one at a time:

**Step A — Stash DS files:**
```bash
git stash push -m "ds-qa-blast-check" -- app/src/companies-components-scope/{company}/style/
```

**Step B — Launch ds-fixer agent:**
```
Agent (ds-fixer):
  prompt: |
    company: {company}
    scope: global
    problem: |
      {description of the DS-level issue}
      Affected sections: {list}
    expected: {expected outcome}

    FIX RULES (follow exactly):
    {fix-rules.md content}
```

**Step C — Regenerate CSS:**
```bash
# For minimal:
node app/scripts/render-ds-css.mjs {company} --out app/src/generated-css-from-twig/{company}-ds.css

# For avito/pik (rubber):
node app/scripts/render-ds-css.mjs {company} --production-ds --out app/src/generated-css-from-twig/{company}-ds.css
```

**Step D — Re-scan affected sections:**
```bash
cd /Users/andrey/Documents/projects/chulakov/deeep-app-templates/app && \
node tests/scan-group.mjs \
  --company={company} \
  --sections={affected_sections_comma_separated} \
  --themes={themes} \
  --viewports={viewports} \
  --out=docs/reports/{runDirRelative}/blast-check.json \
  --screenshots=docs/reports/{runDirRelative}/screenshots/{company}/ \
  --computed=docs/reports/{runDirRelative}/computed/{company}/
```

**Step E — Compare:**
- Parse blast-check.json. If new issues appeared that weren't there before:
  ```bash
  git stash pop
  ```
  Downgrade this fix to section-level. Log the regression in the report.
- If no new issues:
  ```bash
  git stash drop
  ```
  Mark fix as applied.

### 3.3 Section-level fixes (parallel)

Read `fix-rules.md` content (already loaded). Group remaining issues by section type.

Launch **parallel ds-fixer agents in a SINGLE message** (one per type with issues):

```
For each type that has section-level issues:

  Agent (ds-fixer, run_in_background):
    prompt: |
      company: {company}
      target: {type}/*
      problem: |
        Fix these issues in {type} sections:
        {list of issues: section, theme, viewport, description, recommendation}
      expected: All listed issues resolved

      FIX RULES (follow exactly):
      {fix-rules.md content}
```

Wait for all agents to complete. Collect results.

### 3.4 Post-fix CSS regeneration

If any agent touched `ds.json` or twig files:
```bash
# For minimal:
node app/scripts/render-ds-css.mjs {company} --out app/src/generated-css-from-twig/{company}-ds.css

# For avito/pik (rubber):
node app/scripts/render-ds-css.mjs {company} --production-ds --out app/src/generated-css-from-twig/{company}-ds.css
```

---

## Phase 4 — VERIFY

### 4.1 Identify changed sections

```bash
git diff --name-only | grep '\.tpl$'
```

Map each changed `.tpl` file path to its section ID (`type/variant`).

### 4.2 Re-scan changed sections

```bash
cd /Users/andrey/Documents/projects/chulakov/deeep-app-templates/app && \
node tests/scan-group.mjs \
  --company={company} \
  --sections={changed_sections_comma_separated} \
  --themes={themes} \
  --viewports={viewports} \
  --out=docs/reports/{runDirRelative}/verify-{iteration}.json \
  --screenshots=docs/reports/{runDirRelative}/screenshots/{company}/ \
  --computed=docs/reports/{runDirRelative}/computed/{company}/
```

### 4.3 Compare with previous iteration

For each section:
- Was issue, now clean -> Fixed
- Still has issue -> remaining
- New issue not in previous iteration -> Regression

### 4.4 Decide: iterate or stop

**Stop** if ANY of:
- All issues resolved (remaining === 0)
- iteration >= maxIter
- Issues unchanged between iterations (fixer cannot resolve them)
- Only unfixable/skip issues remain

**Continue** if:
- remaining > 0 AND iteration < maxIter AND issues changed from previous iteration
- Increment iteration, GOTO Phase 3 with the remaining + regression issues

---

## Phase 5 — REPORT + COMMIT

### 5.1 Generate iteration-summary.md

Write `{RUN_DIR}/iteration-summary.md`:

```markdown
# DS QA Report: {company} — {datetime}

**Mode:** {themes} x {viewports} | iterations: {N} | dry-run: {yes/no} | AI: {yes/no}

## Scan Summary
- Total sections: {N}
- Scanned: {N}
- Theme-unaware: {N}

## Issues by Iteration
| Iteration | Total | Fixed | Remaining | Regressions |
|-----------|-------|-------|-----------|-------------|
| 1         | {N}   | {N}   | {N}       | {N}         |
| 2         | ...   | ...   | ...       | ...         |

## Fixes Applied
{list of fixes: file, what changed, which issues resolved}

## Remaining Issues
{list of issues that could not be fixed}

## Regressions
{list of new issues introduced by fixes, if any}

## Runtime
- Phase 1 (Scan): ~{N} min
- Phase 2 (Analyze): ~{N} min
- Phase 3-4 (Fix+Verify): ~{N} min per iteration
- Total: ~{N} min
```

### 5.2 Update rule files (max 5 auto-additions per run)

Read `.claude/qa-rules/auto-additions.md`.

For each new pattern discovered during this run (max 5):
- New fix recipe that worked -> append to auto-additions.md
- Regression discovered -> append DON'T rule to auto-additions.md

Format:
```markdown
## [AUTO-ADDED {date}] {Category}: {Problem}
Source: ds-qa iteration {N}, section {type/variant}
Scope: {ds-level | section-type | section-variant}
Fix: {what was done}
{Gotcha: what went wrong, if regression}
```

### 5.3 Commit

If fixes were applied AND no regressions:
```bash
git add app/src/companies-components-scope/{company}/ \
       .claude/qa-rules/auto-additions.md \
       {RUN_DIR}/iteration-summary.md
git commit -m "$(cat <<'EOF'
fix({company}): ds-qa pipeline — {N} issues fixed across {M} sections
EOF
)"
```

If regressions exist — do NOT commit. Warn the user about regressions and suggest manual review.

If `--dry-run` — do not commit (no fixes were made).

### 5.4 Print summary to user

```
DS QA Complete: {company}

Report:  {RUN_DIR}/iteration-summary.md
Mode:    {themes} x {viewports}, {N} iterations
Scan:    {total} sections, {issues} issues found
Fixed:   {N} issues across {M} sections
Remaining: {N} issues
Regressions: {N}

{if fixes committed:}
Committed: fix({company}): ds-qa pipeline — {N} issues fixed across {M} sections

{if dry-run:}
Dry run — no fixes applied. Review issues in {RUN_DIR}/issues-1.json

{if regressions:}
WARNING: {N} regressions detected. Changes NOT committed. Manual review needed.
See {RUN_DIR}/iteration-summary.md for details.
```

---

## Error Handling

- **Dev server not running** -> start it, wait 10s, re-check. If still down -> stop.
- **scan-group.mjs crashes** -> report which group failed, skip it, continue with remaining groups.
- **ds-fixer agent hangs (>5 min)** -> skip that fix, report to user. Use `timeout: 300000` for TaskOutput.
- **CSS regeneration fails** -> check twig syntax error in output, report. Do not proceed with verify.
- **Git stash pop conflict** -> report conflict, suggest manual intervention. Do not force-resolve.
- **No sections found for company** -> report error and stop.
- **Never force-commit** with regressions.

## Important Constraints

- **Do not modify files of other companies** when fixing one company.
- **Do not change container padding** without explicit user request.
- **Do not change `max-w-*` on inner containers** without explicit request.
- **Do not touch `templates.json` or `template.json`** — only `.tpl`, `ds.json`, and twig files.
- After fixing `index.ds.css.twig` — trigger twig-sync for company twigs.
- Rubber conversion: desired_px@1440 / 0.75 = N for `calc(N / 19.2 * 1vw)`.
- For avito/pik always use `--production-ds` flag when regenerating CSS.
