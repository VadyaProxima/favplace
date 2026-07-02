---
allowed-tools: Bash, Read, Write, Task, Glob
description: Visual test of company templates with parallel AI analysis by section types
---

Run visual QA for company `$ARGUMENTS`.

## Launch Modes

```
/test-company minimal                  # desktop + code checks + AI for issues
/test-company minimal --responsive     # + tablet/mobile viewports
/test-company minimal --full           # --responsive + AI for ALL types
/test-company minimal --visual         # AI looks at ALL screenshots of all types
/test-company minimal --visual --type=hero  # visual AI scan of a single type
/test-company minimal --type=hero      # only one section type
/test-company avito --full-sections    # + all minimal sections in company styling
/test-company minimal --output-json          # + structured JSON output
/test-company minimal --severity-threshold=error  # only errors, no warnings
```

## Input

Argument string: `$ARGUMENTS`

Parsing:
- First token — company name: `minimal`, `avito`, `pik`, `jti`, `yandex`
- Flag `--responsive` — add tablet (768px) and mobile (375px) viewports
- Flag `--full` — enables `--responsive` + analyze all types (even without Phase 1 issues)
- Flag `--visual` — AI actively looks at ALL screenshots of each type and finds visual issues independently of Phase 1. Compatible with `--responsive` and `--type=X`
- Flag `--type=X` — analyze only one specific type (e.g. `--type=hero`)
- Flag `--full-sections` — use `{company}-full` page: tests the company's own sections + all minimal sections in that company's styling (requires `app/src/pages/{company}-full/index.html`)
- Flag `--output-json` — Write structured JSON report to `{runDir}/visual-review.json` alongside `analysis.md`. Format suitable for machine consumption by correction-orchestrator.
- Flag `--severity-threshold=LEVEL` — Filter AI analysis output. `error` = only errors, `warning` = errors + warnings (default: all)

If the company is not specified or not from the list — report an error and stop.

---

## Step 0 — Static Lint (.tpl)

Run before the server (no browser required):

```bash
node app/scripts/lint-tpl.mjs --company={company}
```

Save output to variable `lintOutput`. The script exits with code 0 even with warnings — do not stop the process.

If there are warnings — add them to the "Static Lint" section of the final report.

---

## Step 0.5 — Twig Sync Check

Checks that company-specific twig files (if any) are synchronized with `app/src/index.ds.css.twig`.
Runs **always** — regardless of the company being tested. This is a global DS health check.

```bash
node app/scripts/check-twig-sync.mjs
```

Save output to `syncOutput`.

**Interpretation rules:**
- `✅` — all good, not mentioned in the report
- `⚠️` — there is a desync: add to the report in "Twig Sync" section, explain the risk
- `ℹ️` — no custom twig for companies: skip

**Important:** desync means the company-specific twig **lags behind** the main one. This may cause changes in `app/src/index.ds.css.twig` not being applied to the company with a custom twig (usually `minimal`). Do not auto-fix — only signal.

---

## Step 1 — Dev Server

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

If not `200`:
```bash
pnpm -C app dev &
sleep 8
```

---

## Step 2 — Playwright: Screenshots (Phase 1)

Build the run command:

```bash
node app/tests/visual-check.mjs --company={company}
```

Add flags conditionally:
- If `--responsive` or `--full`: add `--responsive`
- If `--type=X`: add `--type={X}`
- If `--full-sections`: add `--full-sections`

Example for `--full`:
```bash
node app/tests/visual-check.mjs --company={company} --responsive
```

After — find the latest run folder:
```bash
ls -t app/docs/reports/ | head -1
```

Remember `runDir = app/docs/reports/{datetime}`.

---

## Step 3 — Read report.json

Read `{runDir}/report.json`.

From `allResults` build a type map:
```
{
  "hero":    { total: 18, issues: 2 },
  "cta":     { total: 12, issues: 0 },
  "footer":  { total: 8,  issues: 1 },
  ...
}
```

Section type — first part of `sectionId` up to `/`.

A section is considered problematic (`issues > 0`) if `ok: false` — this includes:
- Mechanical errors (overflow, broken-image, empty, height)
- Code errors (banned-typography, dark-mode, missing-alt)
- Responsive errors (mobile-overflow, tablet-overflow) — if `--responsive` was used

Warning-only (`hardcoded-colors`, `missing-cms-attr`, `min-font-size` etc.) do not affect `ok`.

> **Rule min-font-size**: with `--responsive`, checks that on mobile viewport (375px) no text element has computed `font-size < 12px`. Flagged as a warning in `mobileIssues` with type `min-font-size`. Violation occurs when using raw rem values in component styles without `max(Xrem, 12px)` — in the rubber_root architecture `html { font-size: 1vw }` such text becomes unreadable.

**Worker filtering:**
- Default: run workers only for types where `issues > 0`
- `--full`: run workers for all types with `mode: full`
- `--visual`: run workers for all types with `mode: visual`
- `--type=X`: run worker only for this type

Types without issues are immediately marked ✅ in the final report — without calling AI (only if `--full` and `--visual` flags were not passed).

---

## Step 4 — Parallel Analysis of Problematic Types

For each selected type, **simultaneously** launch a Task:

```
subagent_type: type-analyzer
model: haiku            ← REQUIRED, saves ~20× tokens
prompt: "company: {company}, type: {type}, runDir: {runDir}"
```

If `--full`:
```
prompt: "company: {company}, type: {type}, runDir: {runDir}, mode: full"
```

If `--visual`:
```
prompt: "company: {company}, type: {type}, runDir: {runDir}, mode: visual"
```

**All selected types — in one message**, in parallel.

---

## Step 5 — Final Report

Write `{runDir}/analysis.md`:

```markdown
# Visual QA: {company} — {datetime}

**Mode:** {desktop / desktop + responsive}
**Static lint:** {✅ OK / ⚠️ N warnings}
**Twig sync:** {✅ synchronized / ⚠️ desync / ℹ️ no custom twig}
**Phase 1:** {total} sections — ✅ {ok} OK, ❌ {issues} issues, avg score: {N}/100
**AI analysis:** {N} types out of {M} (the rest passed Phase 1 without issues)

{if twig sync ⚠️:}
## Twig Sync

{insert syncOutput}

> ⚠️ Desync means the company-specific twig lags behind `app/src/index.ds.css.twig`.
> Changes in the main twig may not be applied. See `.claude/rules/twig-sync.md`.

---

{if lint warnings:}
## Static Lint

{insert lintOutput}

---

## Problematic Types

{insert blocks from type-analyzer workers, first types with ❌, then ⚠️}

---

## Types Without Issues

✅ {type} ({N} variants), {type} ({N} variants), ...
```

If `--output-json`:
Write `{runDir}/visual-review.json`:
```json
{
  "timestamp": "{datetime}",
  "company": "{company}",
  "mode": "{desktop/responsive/full/visual}",
  "sections": {
    "hero": {
      "status": "pass",
      "phase1_score": 95,
      "issues": []
    },
    "features": {
      "status": "fail",
      "phase1_score": 72,
      "issues": [
        {
          "severity": "error",
          "type": "overflow",
          "description": "Text overflows container on mobile 375px",
          "viewport": 375,
          "variant": "grid",
          "screenshot": "features-grid-375.png",
          "confidence": 0.9
        }
      ]
    }
  },
  "summary": {
    "total_types": 26,
    "passed": 24,
    "failed": 2,
    "issues_count": 3
  }
}
```

If `--severity-threshold`:
- `error`: filter out issues where `severity !== "error"` from the JSON
- `warning`: keep `error` and `warning`, filter out `info`

---

## Step 6 — Summary for User

```
✅ Visual QA complete: {company}

📄 app/docs/reports/{datetime}/analysis.md

Mode:                  {desktop / desktop + responsive (tablet + mobile)}
Phase 1 (Playwright):  {total} sections, {issues} issues, avg score: {N}/100
AI analysis (Haiku):   {N} types with issues

{if there are issues:}
Types with issues: hero (2 ❌), footer (1 ⚠️)

{if all OK:}
All sections passed Phase 1 ✅ — AI analysis not required

💡 For responsiveness check: /test-company {company} --responsive
💡 For full analysis of all types: /test-company {company} --full
💡 For AI analysis of all screenshots: /test-company {company} --visual
```

(Show hints only if the corresponding flag was not passed)
