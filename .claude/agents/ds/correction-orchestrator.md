---
name: correction-orchestrator
description: >
  Iterates the audit → fix → visual review correction loop until pixel-perfect
  or max 3 iterations. Orchestrates figma-audit, test-company, and ds-fixer.
color: purple
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Correction Orchestrator

Runs the correction loop: audit → fix → visual review, up to 3 iterations.
Delegates to existing commands and agents, aggregates results, commits once at the end.

## Input Parameters

Extract from the prompt:
- `company` — REQUIRED. Company name
- `figma_url` — REQUIRED. Figma file URL
- `sections` — REQUIRED. Comma-separated section types to audit (e.g. "hero,features,cta")
- `sections_map` — (optional) Path to sections-map.json
- `max_iterations` — (optional) Max correction iterations. Default: 3
- `output_dir` — (optional) Pipeline output directory for artifacts

## Iteration Loop

```
for iteration = 1 to max_iterations:

  ## Step 1: Run Figma Audit (tokens + visual screenshots)

  /figma-audit {company} \
    --figma-url={figma_url} \
    --type={sections} \
    --fix \
    --no-commit \
    --output-json \
    {--sections-map={sections_map} if provided}

  This runs the full figma-audit including:
  - Token audit (Phase 3): browser computed styles vs Figma extracted styles
  - Visual audit (Phase 3.5): Figma screenshots vs browser screenshots per section
  - Fixes (Phase 5): auto-apply with --no-commit

  Read the generated reports from the run directory:
  - `audit-report.json` — token matches/mismatches per viewport
  - `visual-comparison.json` — per-section visual scores (A-F)

  Copy to `{output_dir}/audit-report-{iteration}.json`.
  Copy to `{output_dir}/visual-comparison-{iteration}.json`.

  ## Step 2: Run Visual Review (AI screenshot analysis)

  /test-company {company} --visual --type={sections} --output-json

  Read the latest `visual-review.json` from the run directory.
  Copy to `{output_dir}/visual-review-{iteration}.json`.

  ## Step 3: Analyze Results

  Parse all reports:

  token_mismatches = count of mismatches from audit-report.json (status == "✗")
  visual_screenshot_bad = count from visual-comparison.json where score in ["C","D","F"]
  visual_ai_issues = count from visual-review.json where confidence >= 0.7

  total_issues = token_mismatches + visual_screenshot_bad + visual_ai_issues

  ### Exit conditions:

  IF total_issues === 0:
    → EXIT SUCCESS
    → Write correction-result.json with status: "success"

  IF iteration === max_iterations:
    → EXIT PARTIAL
    → Write correction-result.json with status: "partial"
    → Write remaining-issues.md with unresolved issues

  ### Fix visual-only issues:

  If there are visual issues NOT caught by token audit (overflow, broken layout, etc.):
  - For each visual issue, dispatch ds-fixer agent:
    ```
    Agent: ds-fixer
    company: {company}
    problem: {issue.description}
    expected: {describe expected visual result}
    target: {issue.variant if specific, else issue.type}
    ```

  ## Step 4: Regenerate CSS

  After fixes are applied:

  ```bash
  # Update rubber values
  node app/scripts/generate-ds-results.mjs {company}

  # Regenerate CSS
  node app/scripts/render-ds-css.mjs {company} --production-ds \
    --out app/src/generated-css-from-twig/{company}-ds.css
  ```

  If ds-fixer modified the company twig (`style/index.ds.css.twig`):
  - Dispatch twig-sync agent to ensure consistency

  Continue to next iteration.
```

## Output

### correction-result.json

```json
{
  "iterations": 2,
  "status": "success",
  "resolved": [
    "h1-font-size mismatch @1440 (64px → 85.33px in ds.json)",
    "btn-radius mismatch (8px → 12px)",
    "features overflow @375px (fixed padding)"
  ],
  "remaining": [],
  "token_summary": { "matches": 42, "mismatches": 0 },
  "visual_summary": { "A": 5, "B": 3, "C": 0, "D": 0, "F": 0 },
  "audit_reports": ["audit-report-1.json", "audit-report-2.json"],
  "visual_comparisons": ["visual-comparison-1.json", "visual-comparison-2.json"],
  "visual_reviews": ["visual-review-1.json", "visual-review-2.json"]
}
```

### remaining-issues.md (only if status = "partial")

```markdown
# Remaining Issues — {company}

After {max_iterations} correction iterations, the following issues remain:

## Token Mismatches
- token: {token}, viewport: {viewport}, browser: {value}, figma: {value}

## Visual Screenshot Issues (score C/D/F)
- {section}: score {score} at {viewport}px — {differences}

## Visual AI Issues
- {description} at {viewport}px ({screenshot})

## Suggested Manual Actions
- {specific guidance on what to fix and where}
```

## Important Constraints

- **Max 3 iterations** — do not exceed. If issues remain → exit partial.
- **Three-layer verification** — token audit (computed styles) + visual screenshots (Figma vs browser) + AI visual review (test-company). All three must pass.
- **Visual confidence filter** — ignore AI visual issues with confidence < 0.7 (likely hallucination)
- **Visual score threshold** — scores A and B are acceptable. Only C/D/F trigger fixes.
- **No commit during loop** — all fixes applied to disk only. Final commit at FINALIZE phase.
- **Rubber pipeline** — always run generate-ds-results.mjs + render-ds-css.mjs --production-ds between iterations.
- **Section override gotcha** — when fixing a global token, grep `sections.*` in ds.json for the same token name and update those too.
- **Content ≠ mismatch** — different placeholder text between Figma and browser is NOT a visual issue. Focus on styling only.
- **Figma cache reuse** — first iteration fetches Figma data + screenshots. Subsequent iterations reuse cache (no --refresh).
