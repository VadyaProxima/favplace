---
description: "Build a design system from a Figma mockup URL — full autopilot pipeline"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# /figma-to-ds

Automated pipeline: Figma URL → design system with sections → pixel-perfect result.

## Usage

```
/figma-to-ds <figma-url> <company> [--new] [--from-phase=N] [--no-rubber]
             [--base=minimal] [--type=hero,cta] [--dry-run]
```

## Arguments

- `<figma-url>` — REQUIRED. Figma file URL (`https://figma.com/design/...`)
- `<company>` — REQUIRED. Company name (lowercase kebab-case)
- `--new` — Create new company (Phase 2 scaffold). Without this flag, adds sections to existing company.
- `--from-phase=N` — Restart from phase N (0-6). Reads artifacts from previous phases in cache.
- `--no-rubber` — Disable rubber typography (default: rubber ON with 3-breakpoint system)
- `--base=minimal` — Base company for template matching (default: minimal)
- `--type=hero,cta` — Only process these section types from the Figma mockup
- `--dry-run` — Run Phases 0-3a only (preflight, extract, match). Preview without creating files.

## Arguments Parsing

```
ARGS = "$ARGUMENTS"
```

Extract:
- `figma_url` — first token that starts with `http`
- `company` — first token that is NOT a URL and NOT a flag
- Flags: parse `--flag` and `--flag=value` patterns

## Phase 0: PREFLIGHT

1. **Validate Figma URL:**
   - Must match `https://figma.com/design/` or `https://www.figma.com/design/`
   - Extract fileKey from path
   - Extract nodeId from `?node-id=X-Y` → `X:Y`

2. **Validate company name:**
   - Format: `[a-z0-9-]+`, not starting with digit or hyphen
   - If `--new`: company dir must NOT exist
   - If NOT `--new`: company dir MUST exist with `style/ds.json`

3. **Check Figma token:**
   ```bash
   test -f ~/.claude/figma.token && echo "OK" || echo "MISSING"
   ```

4. **Check dev server:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
   ```
   If not 200: start it:
   ```bash
   pnpm -C app dev &
   sleep 8
   ```

5. **Determine mode:**
   - `--new` flag → mode = `new`
   - Company exists → mode = `add`

6. **Create cache directory:**
   ```bash
   PIPELINE_DIR=app/src/companies-components-scope/{company}/figma-pipeline
   mkdir -p $PIPELINE_DIR/screenshots
   ```

7. **Write config.json:**
   ```json
   {
     "figma_url": "{url}",
     "company": "{company}",
     "mode": "new|add",
     "rubber": true,
     "base": "minimal",
     "type_filter": null,
     "started_at": "{ISO timestamp}"
   }
   ```

8. **Write status.json:**
   ```json
   { "current_phase": 0, "completed_phases": [0], "phase_results": {} }
   ```

If `--from-phase=N` (N > 0):
- Verify `$PIPELINE_DIR/status.json` exists
- Verify all artifacts from phases < N exist
- Skip to Phase N

---

## Phase 1: EXTRACT

Dispatch figma-extractor agent:

```
Agent: figma-extractor
prompt: "figma_url: {figma_url}, company: {company}, output_dir: {PIPELINE_DIR}"
```

Wait for completion. Verify artifacts:
- `{PIPELINE_DIR}/tokens.json` exists and has ≥1 color, ≥1 font
- `{PIPELINE_DIR}/sections-map.json` exists and has ≥1 section

Update status.json → phase 1 completed.

Print summary:
```
Phase 1 ✅ EXTRACT
  Tokens: {N} colors, {N} typography levels, {N} radii
  Sections: {N} found ({list of types})
  Viewports: {list of available viewports}
```

---

## Phase 2: SCAFFOLD (only with --new)

If mode = `add` → skip to Phase 3.

Run `/new-company`:
```
/new-company {company} --from-tokens={PIPELINE_DIR}/tokens.json --base={base}
```

Wait for completion. Verify:
- `style/ds.json` exists
- `style.json` exists with `designPreset: "style/result-generation-ds.json"`
- `generated-css-from-twig/{company}-ds.css` exists

Update status.json → phase 2 completed.

Print summary:
```
Phase 2 ✅ SCAFFOLD
  Created: ds.json, style.json, twig, templates.json
  Rubber: {enabled/disabled}
  CSS: generated-css-from-twig/{company}-ds.css
```

---

## Phase 3: MATCH & BUILD

### Phase 3a: Section Matching

Dispatch section-matcher agent:

```
Agent: section-matcher
prompt: "company: {company}, sections_map: {PIPELINE_DIR}/sections-map.json, base_company: {base}, mode: {mode}"
```

If `--type` specified → filter sections-map to only include specified types before passing.

Wait for completion. Read `{PIPELINE_DIR}/matched-sections.json`.

Print summary:
```
Phase 3a ✅ MATCH
  Matched: {N} sections ({list})
  Create new: {N} sections ({list})
  New types: {N} ({list})
```

If `--dry-run` → print matched-sections.json summary and STOP.

### Phase 3b: Template Creation (parallel)

For each section in matched-sections.json, dispatch template-creator agent **in parallel**:

```
# For "match" action:
Agent: template-creator
prompt: "company: {company}, type: {section.type}, variant: {section.variant}, source_tpl: {base}/{section.source_tpl}, adaptations: {section.adaptations_needed}"

# For "create" or "create_new_type" action:
Agent: template-creator
prompt: "company: {company}, type: {section.type}, variant: {section.variant}, html: Generate a {section.type} section with elements: {section.elements}. Create clean HTML from scratch following DS patterns."
```

**IMPORTANT:** Tell each template-creator agent to ONLY create the `.tpl` + `template.json` files. Do NOT update shared files (templates.json, index.html). This prevents parallel conflicts.

Wait for ALL agents to complete.

### Phase 3c: Batch Post-Processing (sequential)

After all template-creator agents finish:

1. **Register in templates.json:**
   Read each new `template.json`, merge all into `{company}/templates.json`.

2. **Add @imports to index.html:**
   For each new template, add `@import` line to `app/src/pages/{company}/index.html`.

3. **Update categories.json:**
   For any `create_new_type` sections, add the new type to `{company}/categories.json`.

4. **Write section overrides to ds.json:**
   For each section with `section_overrides`:
   - Read current ds.json
   - Add `sections.{type}` object with override values
   - If rubber enabled: desktop values ÷ 0.75, tablet/mobile values direct
   - If `--no-rubber`: all values as-is (raw Figma px)
   - Write back ds.json

5. **Regenerate CSS:**
   If rubber enabled (default):
   ```bash
   node app/scripts/generate-ds-results.mjs {company}
   node app/scripts/render-ds-css.mjs {company} --production-ds \
     --out app/src/generated-css-from-twig/{company}-ds.css
   ```
   If `--no-rubber`:
   ```bash
   node app/scripts/render-ds-css.mjs {company} \
     --out app/src/generated-css-from-twig/{company}-ds.css
   ```

6. **Biome check:**
   ```bash
   pnpm -C app check
   ```
   Fix any errors.

Update status.json → phase 3 completed.

Print summary:
```
Phase 3 ✅ BUILD
  Templates created: {N}
  Registered in templates.json: {N}
  Section overrides in ds.json: {N}
  New types created: {list or "none"}
```

---

## Phase 4-6: CORRECTION LOOP

Collect the list of section types that were just created/matched:
```
SECTIONS = comma-separated list of section types from matched-sections.json
```

Dispatch correction-orchestrator agent:

```
Agent: correction-orchestrator
prompt: "company: {company}, figma_url: {figma_url}, sections: {SECTIONS}, sections_map: {PIPELINE_DIR}/sections-map.json, max_iterations: 3, output_dir: {PIPELINE_DIR}"
```

Wait for completion. Read `{PIPELINE_DIR}/correction-result.json`.

Update status.json → phase 6 completed.

---

## FINALIZE

1. **Commit all changes:**
   ```bash
   git add app/src/companies-components-scope/{company}/
   git add app/src/pages/{company}/
   git add app/src/generated-css-from-twig/{company}-ds.css
   ```

   If `--new`:
   ```bash
   git add app/src/pages/index.html  # navigation link
   ```

   ```bash
   git commit -m "feat({company}): build DS from Figma — {N} sections, {iterations} correction iterations"
   ```

2. **Print final summary:**

```
═══════════════════════════════════════════
  /figma-to-ds COMPLETE — {company}
═══════════════════════════════════════════

Mode:       {new / add}
Figma:      {figma_url}
Rubber:     {enabled / disabled}
Viewports:  {1440, 768, 375}

Sections:   {N} total
  Matched:  {N} (from {base} templates)
  Created:  {N} (from scratch)
  New types: {list or "none"}

Correction: {N} iterations → {success / partial}
  Resolved: {N} issues
  Remaining: {N} issues {→ see remaining-issues.md}

Files:
  {PIPELINE_DIR}/tokens.json
  {PIPELINE_DIR}/sections-map.json
  {PIPELINE_DIR}/matched-sections.json
  {PIPELINE_DIR}/correction-result.json

Commit: {hash}
═══════════════════════════════════════════
```

If status = "partial":
```
⚠️ {N} issues remain after {max_iterations} iterations.
See: {PIPELINE_DIR}/remaining-issues.md
```
