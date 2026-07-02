---
description: "Iterative Figma→pixel-perfect loop: audit + fix + verify (max 3 rounds)"
---

# /figma-perfect

Iterative correction loop: runs `/figma-audit` (tokens + visual screenshots), applies fixes, verifies — repeats until pixel-perfect or max iterations reached.

## Usage
```
/figma-perfect {company} --figma-url=URL [--type=TYPES] [--max=N]
```

## Arguments
- `{company}` — REQUIRED. Company name (dds, minimal, avito, pik)
- `--figma-url=URL` — REQUIRED. Figma file URL with node-id
- `--type=TYPES` — Comma-separated section types (default: all)
- `--max=N` — Max iterations, 1-3 (default: 3)
- `--sections-map=PATH` — Pre-built sections-map.json (from figma-extractor)

## How it works

```
┌─────────────────────────────────────────┐
│  ITERATION 1..N (max 3)                 │
│                                         │
│  1. /figma-audit {company}              │
│     --figma-url=... --fix --no-commit   │
│     --output-json                       │
│     → token mismatches + visual scores  │
│                                         │
│  2. Analyze results                     │
│     token_mismatches == 0               │
│     AND all visual scores >= B?         │
│     → YES: EXIT SUCCESS                 │
│     → NO:  continue to fix              │
│                                         │
│  3. Fix remaining issues                │
│     - DS token fixes (ds.json, .tpl)    │
│     - Visual issues (ds-fixer agent)    │
│                                         │
│  4. Regenerate CSS                      │
│     generate-ds-results + render-ds-css │
│                                         │
│  5. Loop back to step 1                 │
└─────────────────────────────────────────┘
          │
          ▼
  FINALIZE: commit all changes
```

## Phase 0: SETUP

1. Parse `$ARGUMENTS`:
   ```
   company = first token
   figma_url = --figma-url value
   types = --type value (or "all")
   max_iterations = --max value (default 3, cap at 3)
   sections_map = --sections-map value (optional)
   ```

2. Validate:
   ```bash
   ls app/src/companies-components-scope/{company}/style/ds.json
   ```

3. Check dev server:
   ```bash
   curl -s http://localhost:5173/{company} > /dev/null || pnpm -C app dev &
   ```

4. Create output directory:
   ```bash
   OUTPUT_DIR=docs/reports/$(date +%Y-%m-%dT%H-%M-%S)/figma-perfect
   mkdir -p $OUTPUT_DIR
   ```

5. Print start banner:
   ```
   ══════════════════════════════════════════════
   Figma Perfect — {company}
   Max iterations: {max_iterations}
   Sections: {types}
   ══════════════════════════════════════════════
   ```

## Phase 1: ITERATION LOOP

```
for iteration = 1 to max_iterations:
```

### Step 1: Run Figma Audit (tokens + visual)

Execute the `/figma-audit` command inline (NOT as subagent — run the full flow in this context):

```
/figma-audit {company} \
  --figma-url={figma_url} \
  --type={types} \
  --fix \
  --no-commit \
  --output-json \
  {--sections-map={sections_map} if provided}
```

This runs:
- Phase 1: Extract Figma data + screenshots (cached after first run)
- Phase 2: Browser computed styles + per-section screenshots
- Phase 3: Token comparison (browser vs Figma computed styles)
- Phase 3.5: Visual screenshot comparison (Figma vs browser per section)
- Phase 4: Report with both token and visual results
- Phase 5: Apply fixes (--fix --no-commit)

Read the generated reports:
- `audit-report.json` — token mismatches and matches
- `visual-comparison.json` — per-section visual scores (A-F)
- `proposed-fixes.json` — applied fixes

Copy all to `{OUTPUT_DIR}/iteration-{N}/`.

### Step 2: Analyze Results

Parse both reports:

```
token_mismatches = audit-report.json → count where status == "✗"
visual_bad = visual-comparison.json → count where score in ["C", "D", "F"]
visual_scores = visual-comparison.json → map of section → score
```

Print iteration summary:
```
── Iteration {N} Results ──────────────────
Token audit:  {matches} ✓  {acceptable} ~  {mismatches} ✗
Visual audit: {A_count} A  {B_count} B  {C_count} C  {D_count} D
Status: {PERFECT | NEEDS_WORK | PARTIAL}
───────────────────────────────────────────
```

### Step 3: Check Exit Conditions

**EXIT SUCCESS** if ALL of:
- `token_mismatches === 0`
- `visual_bad === 0` (no C/D/F scores)

→ Go to Phase 2 (Finalize)

**EXIT PARTIAL** if:
- `iteration === max_iterations`

→ Write `{OUTPUT_DIR}/remaining-issues.md`
→ Go to Phase 2 (Finalize)

**CONTINUE** otherwise:
→ Proceed to Step 4

### Step 4: Fix Remaining Issues

**Token mismatches** should already be fixed by `--fix` in figma-audit.
If any remain unfixed (skipped or complex):
- For DS-global tokens: edit ds.json directly
- For template-specific: dispatch ds-fixer agent
- For twig changes: dispatch twig-sync agent after

**Visual-only issues** (score C/D/F not caught by token audit):
- For each bad section, dispatch ds-fixer:
  ```
  Agent: ds-fixer
  company: {company}
  problem: "{section} visual score {score}: {differences description}"
  expected: "Match Figma screenshot at {viewport}px"
  target: {section type/variant}
  ```

### Step 5: Regenerate CSS

```bash
# Always run after any fix
node app/scripts/generate-ds-results.mjs {company}
node app/scripts/render-ds-css.mjs {company} --production-ds \
  --out app/src/generated-css-from-twig/{company}-ds.css
```

If twig was modified → dispatch twig-sync agent.

**Continue to next iteration.**

## Phase 2: FINALIZE

### Summary

Print final summary:
```
══════════════════════════════════════════════
Figma Perfect — {company} — DONE
Iterations: {N}
Status: {SUCCESS | PARTIAL}

Token audit:  {final_matches} ✓  {final_mismatches} ✗
Visual audit: {scores summary}

{if PARTIAL:}
Remaining: {count} token mismatches, {count} visual issues
See: {OUTPUT_DIR}/remaining-issues.md
══════════════════════════════════════════════
```

### Write correction-result.json

```json
{
  "company": "{company}",
  "iterations": N,
  "status": "success|partial",
  "resolved": ["list of fixed issues"],
  "remaining": ["list of unfixed issues"],
  "token_summary": { "matches": N, "mismatches": N },
  "visual_summary": { "A": N, "B": N, "C": N, "D": N, "F": N },
  "reports": ["iteration-1/audit-report.json", ...]
}
```

### Commit

```bash
git add app/src/companies-components-scope/{company}/
git commit -m "fix({company}): figma-perfect — {N} iteration(s), {fixes_count} fixes

Token: {matches}✓ {mismatches}✗
Visual: {A}A {B}B {C}C {D}D"
```

## Key Rules

1. **Both checks required** — token computed styles AND visual screenshot comparison must pass
2. **Exit conditions** — token_mismatches === 0 AND no C/D/F visual scores = SUCCESS
3. **Max 3 iterations** — never exceed, exit partial if issues remain
4. **No commit during loop** — all fixes on disk only, single commit at end
5. **Figma cache reuse** — Phase 1 extract runs once, subsequent iterations use cache
6. **Rubber pipeline after every fix** — generate-ds-results + render-ds-css between iterations
7. **Section overrides** — when fixing global token, grep sections.* for same token
8. **Content ≠ mismatch** — different placeholder text is NOT a visual issue
9. **Score B is acceptable** — only C/D/F trigger fixes (B = minor ≤2px differences)
