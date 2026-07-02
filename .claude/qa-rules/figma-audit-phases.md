# Figma Audit — Mandatory Phase Checklist

## CRITICAL: This rule is BLOCKING

When executing `/figma-audit`, you MUST create a task checklist at the START and verify ALL phases completed before writing the report.

## Phase Checklist (create via TaskCreate at start)

```
[ ] Phase 0: Setup — validate company, dev server, cache, create RUN_DIR
[ ] Phase 1: Extract — Figma data + figma-map.json (or use cache)
[ ] Phase 1.1b: Frame discovery — list ALL Figma viewport frames (not just 1440/768/375)
[ ] Phase 1.1c: Viewport mapping — auto-map Figma frames to CSS breakpoints (cross-validate tablet)
[ ] Phase 1.4: Figma screenshots — fetch from REST API (or use cache)
[ ] Phase 2: Browser audit — computed styles at 1440, 768, 375
[ ] Phase 2.1: Browser screenshots — per-section element screenshots at ALL 3 viewports
[ ] Phase 3: Token compare — browser vs Figma using MAPPED frames (not raw frame names!)
[ ] Phase 3.1: Rubber sanity check — for pik/avito only
[ ] Phase 3.5: Visual comparison — pixelmatch + agent analysis
[ ] Phase 4: Report — ONLY after ALL above phases are completed
[ ] Phase 5: Fix — only with --fix flag
```

## Phase Gate Rule

**You CANNOT write Phase 4 (report) until you verify:**

1. `{RUN_DIR}/screenshots/` contains browser screenshots for EACH section at EACH viewport
2. Phase 3.5 pixelmatch was executed (or `--no-visual` flag was passed)
3. ALL sections from figma-map.json were audited (not just a subset)
4. Footer section was included in the audit

**If any phase was skipped or failed, STOP and fix it before proceeding.**

## Error Resilience

### Bash multi-section reads
Never chain multiple `cat` commands with `&&`. Use `|| true` per section:

```bash
# WRONG — one missing file cancels everything
for s in section1 section2 section3; do cat "$s/data.json"; done

# CORRECT — continues even if one section has no data
for s in section1 section2 section3; do
  cat "$s/data.json" 2>/dev/null || echo "SKIP: $s"
done
```

### Parallel bash calls
Never rely on parallel bash calls where one depends on the other. If the first fails, the second gets cancelled.

```bash
# WRONG — two parallel calls, second cancelled if first fails
Bash("cat 768/*.json")  # exit code 1 → cancels below
Bash("cat 375/*.json")  # CANCELLED

# CORRECT — single bash with both, using || true
Bash("cat 768/*.json 2>/dev/null || true; echo '---'; cat 375/*.json 2>/dev/null || true")
```

### After any error
If a bash command fails during audit:
1. Do NOT skip the phase — retry with fixed command
2. Do NOT proceed to next phase until current phase data is collected
3. Mark the phase as FAILED in the task checklist and note what's missing

## Section Completeness Check

Before writing the report, verify audited sections against figma-map.json:

```
figma-map sections: [hero, benefits, split-content, 3d, video, facts, hero2, features, faq, footer]
audited sections:   [hero, benefits, split-content, 3d, video, facts, hero2, features, faq, footer]
missing:            [] ← must be empty
```

If ANY section is missing from the audit, go back and collect its data.

## Footer Is NOT Optional

Footer is a complex section with:
- CTA strip (buttons, links)
- Navigation columns (font sizes, colors, spacing)
- App download section
- Legal text (small font, muted color)

It MUST be audited with the same rigor as other sections at ALL 3 viewports.
