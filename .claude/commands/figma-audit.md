---
description: "Figma audit — validate DS conformance against Figma mockups and tokens"
---

# /figma-audit

## Usage
```
/figma-audit {company} [--figma-url=URL] [--refresh] [--phase=PHASE] [--type=TYPES]
             [--fix] [--dry-run] [--map=PATH]
             [--output-json] [--sections-map=PATH] [--no-commit]
             [--no-visual] [--visual-only]
```

## Arguments
- `{company}` — REQUIRED. Company name (pik, avito, minimal)
- `--figma-url=URL` — Figma file URL. Required on first run, stored in cache for subsequent runs
- `--refresh` — Force re-extract from Figma (ignores cache)
- `--phase=PHASE` — Run only specific phase: `extract`, `browser-audit`, `compare`, `visual`, `report`, `fix`
- `--type=TYPES` — Comma-separated section types to audit (default: all)
- `--fix` — Enable fix phase with confirmation
- `--dry-run` — Scan + report only, no fixes
- `--map=PATH` — Path to manual figma-map.json (skip auto-discovery)
- `--output-json` — Write structured JSON report to `{RUN_DIR}/audit-report.json` alongside the markdown report. Format: `{ "viewports": { "1440": { "matches": [...], "mismatches": [...] }, ... }, "proposed_fixes": [...], "visual_comparison": [...] }`
- `--sections-map=PATH` — Use pre-built sections-map.json (from figma-extractor) instead of auto-discovery in Phase 1.2. The file provides section node IDs, types, and per-viewport styles. Phase 1.1 (Figma data fetch) still runs, but section mapping is skipped.
- `--no-commit` — Apply fixes to files (ds.json, .tpl) but suppress the git commit in Phase 5.4. Fixes are written to disk, just not committed. Used by correction-orchestrator which commits once at the end.
- `--no-visual` — Skip visual screenshot comparison (Phase 1.4 + Phase 3.5). Only run token-based audit. Useful for faster runs.
- `--visual-only` — Run ONLY visual screenshot comparison (Phase 1.4 + Phase 2 screenshots + Phase 3.5). Skip token extraction and comparison.

## CRITICAL RULE: Browser-First

**Never fix ds.json based on formula `ds_value * 0.75 ≠ figma_px`.**

The rubber pipeline has nuances that make formula-based comparison unreliable:
- `max()` clamp — e.g. `max(32px, calc(32/19.2*1vw))` = 32px@1440 (not 24px)
- Some tokens aren't rubber-ized (card-radius, some fixed values)
- Section overrides may use different formulas
- Twig-specific logic (grmq vs direct substitution)

**Source of truth = computed styles in browser at each target viewport.**
Fix ds.json ONLY when browser computed ≠ Figma rendered.

## 3-Breakpoint Rubber System

Audit compares **3 CSS breakpoints** by default, each with its own browser audit viewport and Figma reference frame.

### CSS breakpoints and Figma frame mapping

| CSS breakpoint | Range | Browser audit at | Figma reference frame | Denominator | ds value formula |
|-------------|-------|------------|-----------------|-----------------|-----------------|
| Desktop | `≥1024px` | **1440px** | Figma frame closest to 1440 | `19.2` (1920÷100) | `figma_value ÷ 0.75` |
| Tablet | `768px–1023px` | **768px** | **See auto-mapping below** | `7.68` (768÷100) | `figma_value` (direct) |
| Mobile | `<768px` | **375px** | Figma frame closest to 375 | `3.75` (375÷100) | `figma_value` (direct) |

**CRITICAL: Figma frame ≠ CSS breakpoint.** Designers often create frames at widths that don't directly map to our CSS breakpoints. Common example:
- Figma has frames: 1440, **1024**, 768, 375
- CSS breakpoints: desktop(≥1024), tablet(768-1023), mobile(<768)
- The **1024** frame falls in the desktop CSS range, but its values often match our **tablet DS tokens** (because the designer used 1024 as "tablet reference")
- The **768** frame may represent a separate design intent (small tablet) with different font sizes

CSS output per breakpoint:
```css
/* Desktop ≥1024px */
@media (min-width: 1024px) { :root { --h2-font-size: calc(43 / 19.2 * 1vw); } }
/* → @1440: 43 × 0.75 = 32.25px ≈ Figma 32px ✓ */

/* Tablet 768–1023px */
@media (min-width: 768px) and (max-width: 1023px) { :root { --h2-font-size: calc(24 / 7.68 * 1vw); } }
/* → @768: 24 × 1.0 = 24px = Figma 24px ✓ */

/* Mobile <768px */
@media (max-width: 767px) { :root { --h2-font-size: calc(24 / 3.75 * 1vw); } }
/* → @375: 24 × 1.0 = 24px = Figma 24px ✓ */
```

### Fix methodology

When a mismatch is found at a specific viewport:
1. Identify which breakpoint the mismatch belongs to (desktop / tablet / mobile)
2. Calculate the correct ds value for that breakpoint using its formula
3. Add/update the value in ds.json under the appropriate breakpoint key
4. Run rubber pipeline to regenerate CSS
5. Verify browser matches Figma at that viewport

**This is the standard method for fixing responsive mismatches.** Do not use ad-hoc clamps or hardcoded breakpoint overrides in templates.

### Figma frame discovery

**Step 1: Discover ALL viewport frames** as children of the root section node. List all frames with their widths:

```
Example: "1440" (w=1440), "1024" (w=1024), "768" (w=768), "375" (w=375)
```

**Step 2: Map Figma frames to CSS breakpoints** using the auto-mapping algorithm:

1. **Desktop**: frame with width matching 1440 (standard, always present)
2. **Mobile**: frame with width matching 375 (or closest <768)
3. **Tablet** (requires heuristic — see below)

**Tablet frame auto-mapping (CRITICAL):**

The tablet Figma frame is ambiguous when multiple frames exist near the tablet range. Use this algorithm:

```
tablet_candidates = all frames with width in range [768, 1024]
if len(tablet_candidates) == 1:
    tablet_frame = tablet_candidates[0]  # only one option
elif len(tablet_candidates) > 1:
    # Multiple candidates (e.g. 768 AND 1024).
    # Cross-validate: compare browser@768 computed values with each candidate.
    # Pick the frame whose token values best match browser computed values.
    for candidate in tablet_candidates:
        score = count_matching_tokens(browser_768_values, figma_candidate_values)
    tablet_frame = candidate with highest score
else:
    # No tablet frame — skip tablet audit, warn user
```

**Cross-validation example:**
```
Browser@768: h3=20px, body=16px, h2=32px
Figma@1024:  h3=20px, body=16px, h2=32px → score=3 ✓ BEST MATCH
Figma@768:   h3=15px, body=12px, h2=24px → score=0
→ Use Figma@1024 as tablet reference
```

**Step 3: Write mapping to meta.json:**
```json
{
  "viewport_mapping": {
    "desktop": { "browser_width": 1440, "figma_frame": "1440", "figma_width": 1440 },
    "tablet":  { "browser_width": 768,  "figma_frame": "1024", "figma_width": 1024 },
    "mobile":  { "browser_width": 375,  "figma_frame": "375",  "figma_width": 375 }
  },
  "all_figma_frames": ["1440", "1024", "768", "375"],
  "unmapped_frames": ["768"]
}
```

**Step 4: Report unmapped frames** — if any Figma frame was not mapped to a CSS breakpoint, include it in the report as informational. These may represent intermediate design intents that our 3-breakpoint system doesn't cover.

Extract styles from ALL mapped frames during Phase 1. Unmapped frames can be extracted but are NOT used for mismatch comparison.

## Phase 0: SETUP

1. Parse arguments. Validate company exists:
   ```bash
   ls app/src/companies-components-scope/{company}/style/ds.json
   ```

2. Define paths:
   ```
   COMPANY_DIR = app/src/companies-components-scope/{company}
   CACHE_DIR = {COMPANY_DIR}/figma-audit
   DS_JSON = {COMPANY_DIR}/style/ds.json
   ```

3. Check cache validity:
   - If `{CACHE_DIR}/meta.json` exists AND no `--refresh`:
     - Read meta.json timestamp
     - Check ds.json mtime: if ds.json is newer, WARN:
       "⚠️ ds.json changed since last Figma extract. Use --refresh to re-extract."
     - Use cache → skip Phase 1
   - Else: Phase 1 required

4. If Phase 1 needed and no `--figma-url`: check meta.json for stored URL. If none → ERROR: "--figma-url required for first run"

5. Check dev server:
   ```bash
   curl -s http://localhost:5173/{company} > /dev/null || pnpm -C app dev &
   ```
   Wait for server ready (retry curl 5 times with 2s sleep).

6. Create run directory:
   ```bash
   RUN_DIR=docs/reports/$(date +%Y-%m-%dT%H-%M-%S)/figma-audit
   mkdir -p $RUN_DIR/screenshots
   ```

## Phase 1: EXTRACT

**Skip if cache is valid and no --refresh.**

### 1.1 Extract Figma data

Extract fileKey and node-id from `--figma-url`.
URL format: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y` → nodeId = `X:Y`

**Strategy: try Figma REST API first (faster, no Desktop needed), fall back to MCP.**

#### 1.1a REST API path (preferred)

Read token from `~/.claude/figma.token`.

```bash
TOKEN=$(cat ~/.claude/figma.token)
# Test token
curl -s -H "X-Figma-Token: $TOKEN" "https://api.figma.com/v1/me"
```

If token works:
```bash
# Get node tree with depth=8 (enough for section internals)
curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}?ids={nodeId}&depth=8" \
  -o {CACHE_DIR}/figma-full-data.json
```

Parse the response to find **all viewport frames** (children of root). List ALL frames — do not hardcode "1440", "768", "375". Common layouts include 4 frames (1440, 1024, 768, 375) or 3 frames (1440, 768, 375).

#### Style extraction per section

For each viewport frame, for each section child, extract:
- **Typography:** TEXT nodes → fontFamily, fontSize, fontWeight, lineHeightPx, letterSpacing, color
- **Colors:** SOLID fills → rgb values
- **Spacing:** paddingLeft/Right/Top/Bottom, itemSpacing (gap) — on ALL named frames including:
  - Container, section wrappers
  - Card/item frames (accordion, fact cards, feature cards)
  - Button frames (CTA, icon buttons, round buttons)
  - Icon containers (Buttons/round, icon boxes)
  - Tab containers
- **Radii:** cornerRadius — on ALL named frames (containers, cards, buttons, icons, tabs)
- **Sizes:** width, height — on icon boxes, round buttons, and other fixed-size elements

**Important:** Extract padding/radius for ALL named child frames, not just top-level. Figma names like "Buttons/round", "accordion / desktop", "item", "icon", "tabs / medium" contain sizing data critical for responsive audit. The `name` field in the JSON output identifies the Figma component → maps to CSS class in browser.

#### Two-pass extraction strategy (CRITICAL)

The `/files` API with `depth=8` often does NOT resolve children of INSTANCE nodes in non-1440 viewport frames. This causes **silently empty** figma-styles.json for entire sections at 768/375 — which then get reported as "no mismatches" (false negatives).

**Pass 1 — Bulk extract:**
```bash
curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}?ids={nodeId}&depth=8" \
  -o {CACHE_DIR}/figma-full-data.json
```
Parse and write per-section per-viewport cache.

**Pass 2 — Per-section completeness validation and re-fetch:**

After Pass 1, iterate ALL sections × ALL discovered viewport frames (not just 768/375):

```python
for section in figma_map:
    for vp in all_non_desktop_frames:  # e.g. ["1024", "768", "375"]
        path = f"{CACHE_DIR}/viewports/{vp}/{section['safe_name']}/figma-styles.json"
        if not exists(path) or file_is_empty_or_no_texts(path):
            # Find section node ID in the viewport frame
            vp_section_id = find_section_in_viewport(vp, section['figma_name'])
            # Re-fetch with /nodes endpoint (resolves INSTANCE children)
            fetch_and_extract(fileKey, vp_section_id, depth=5, output=path)
```

**Validation criteria** — a section's figma-styles.json is considered incomplete if:
1. File doesn't exist
2. File exists but `texts` array is empty (every section has at least one text node)
3. File exists but has fewer `texts` entries than expected (compare with 1440 data)

**Re-fetch via `/nodes` endpoint:**
```bash
curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}/nodes?ids={sectionNodeId}&depth=5" \
  -o /tmp/section-refetch.json
```
The `/nodes` endpoint resolves INSTANCE children fully regardless of the parent depth. Extract styles from the response and overwrite the cache file.

**Rate limiting:** batch up to 10 IDs per `/nodes` request. If 429, wait 60s and retry.

#### Cache layout

```
{CACHE_DIR}/sections/{safe-name}/figma-styles.json          # 1440px (default, desktop)
{CACHE_DIR}/viewports/1024/{safe-name}/figma-styles.json     # 1024px (if present)
{CACHE_DIR}/viewports/768/{safe-name}/figma-styles.json      # 768px
{CACHE_DIR}/viewports/375/{safe-name}/figma-styles.json      # 375px
```

Extract ALL discovered frames into cache. The `viewport_mapping` in meta.json determines which cache directory is used for each CSS breakpoint comparison.

**Rate limiting:** If 429, wait 60s and retry. `/files` endpoint has separate rate bucket from `/nodes`.

#### 1.1b MCP fallback (requires Figma Desktop)

If REST API fails (expired token, 403):
1. `mcp__figma__get_metadata` with nodeId → structure
2. `mcp__figma__get_screenshot` per section → screenshots
3. `mcp__figma__get_design_context` per section → computed styles

### 1.2 Auto-discover section mapping

From the node tree, identify the 1440px viewport frame (child named "1440").
List its children — these are the Figma sections.

For each section, match against `{COMPANY_DIR}/templates.json`:
- Normalize name: lowercase, strip "blocks / ", transliterate Russian
- Match by: exact name, partial match, or type keyword overlap

Write `{CACHE_DIR}/figma-map.json`:
```json
[{
  "figma_id": "166:48399",
  "figma_name": "hero",
  "safe_name": "hero",
  "template_type": "hero",
  "template_variant": "background-image",
  "confidence": "high"
}]
```

Verify that ALL non-desktop frames have the same sections (same names/order).

Also store viewport section node IDs in figma-map.json for Pass 2 re-fetch. Include ALL discovered frames, not just 768/375:
```json
[{
  "figma_id": "166:48399",
  "figma_name": "hero",
  "safe_name": "hero",
  "template_type": "hero",
  "template_variant": "background-image",
  "confidence": "high",
  "viewport_ids": { "1024": "166:48420", "768": "166:48425", "375": "495:7967" }
}]
```

If `--map` provided, use that file instead.

If `--sections-map` is provided:
- Read the sections-map JSON file
- Convert to figma-map.json format:
  ```
  sections-map entry → figma-map entry:
    figma_id: entry.node_id
    figma_name: entry.figma_name
    safe_name: entry.type
    template_type: entry.type
    template_variant: (find from company templates.json or use "default")
    confidence: "high" if type_confidence > 0.8, else "medium"
  ```
- Skip auto-discovery (name matching / transliteration)
- Use viewports from sections-map entries instead of re-discovering from Figma tree

### 1.3 Write meta.json

```json
{
  "timestamp": "{ISO timestamp}",
  "figma_url": "{--figma-url value}",
  "figma_file": "{fileKey}",
  "root_node": "{nodeId}",
  "sections_extracted": {count},
  "all_figma_frames": ["1440", "1024", "768", "375"],
  "viewport_mapping": {
    "desktop": { "browser_width": 1440, "figma_frame": "1440", "figma_width": 1440 },
    "tablet":  { "browser_width": 768,  "figma_frame": "1024", "figma_width": 1024 },
    "mobile":  { "browser_width": 375,  "figma_frame": "375",  "figma_width": 375 }
  },
  "unmapped_frames": ["768"],
  "company": "{company}"
}
```

The `viewport_mapping` is determined by the auto-mapping algorithm in "Figma frame discovery". The `unmapped_frames` array lists Figma frames that don't correspond to any CSS breakpoint.

### 1.4 Fetch Figma screenshots (per section)

**Skip if `--no-visual`.**

Use the Figma REST API Images endpoint to fetch rendered screenshots of each section.

#### Batch request

Collect all section node IDs from `figma-map.json`. For COMPONENT_SET nodes, use the default variant's ID (first child or the `pick_child` variant).

```bash
TOKEN=$(cat ~/.claude/figma.token)
# Batch up to 15 node IDs per request (API limit)
curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/images/{fileKey}?ids={id1},{id2},...&format=png&scale=2" \
  -o {CACHE_DIR}/figma-images-response.json
```

**scale=2** for retina quality (matches Playwright deviceScaleFactor=2).

#### Download images

Parse the response `images` object. For each section:
```bash
curl -s "{image_url}" -o {CACHE_DIR}/screenshots/{safe-name}-figma.png
```

Save to `{CACHE_DIR}/screenshots/` (cached, not per-run).

#### Rate limiting
- `/v1/images` has its own rate bucket (separate from `/v1/files`)
- If 429: wait 60s, retry once
- If batch too large (>15 IDs): split into multiple requests

#### Viewport-specific screenshots
Fetch screenshots for ALL discovered Figma viewport frames (not just 1440/768/375):
```
{CACHE_DIR}/screenshots/{safe-name}-figma-1440.png
{CACHE_DIR}/screenshots/{safe-name}-figma-1024.png   # if 1024 frame exists
{CACHE_DIR}/screenshots/{safe-name}-figma-768.png
{CACHE_DIR}/screenshots/{safe-name}-figma-375.png
```

This ensures the pixelmatch script can find the correct Figma screenshot when using `--viewport-map` (e.g., `--viewport-map=768:1024` will look for `{section}-figma-1024.png`).

If no viewport frames (components only), fetch the component's default variant:
```
{CACHE_DIR}/screenshots/{safe-name}-figma.png   # single screenshot
```

## Phase 2: BROWSER AUDIT (all 3 viewports)

**This phase collects the actual rendered values — the source of truth.**

Run audit at **3 viewports sequentially**: 1440×900, 768×1024, 375×812.

For each viewport:
1. `page.setViewportSize({ width, height })`
2. `page.goto('http://localhost:5173/{company}')`
3. `page.evaluate()` to collect computed styles from ALL `[data-section]` elements

For each section, extract:

**Typography:**
- **Headings (h1-h4):** fontSize, fontWeight, lineHeight, letterSpacing, color
- **Body text (first p):** fontSize, fontWeight, lineHeight, color
- **Lead text (.text-lead):** fontSize, fontWeight, color
- **Nav links (nav a):** fontSize, fontWeight, color

**Interactive elements:**
- **Button (.btn, .hero-btn-accent, .btn-ghost):** fontSize, fontWeight, borderRadius, height, paddingInline, paddingBlock, backgroundColor, color, width (if fixed)
- **Accordion trigger:** fontSize, fontWeight, color, padding, gap (between text and icon)
- **Tab (.tab):** fontSize, height, paddingInline, paddingBlock, borderRadius

**UI components (size + spacing):**
- **Card (.card, .accordion-card, .facts-row-card, [class*="card"]):** borderRadius, backgroundColor, paddingInline, paddingBlock, borderWidth, gap (internal)
- **Icon box (.icon-box, .icon-box-ghost, .accordion-icon, [class*="icon"]):** width, height, borderRadius, padding
- **Icon SVG (icon container > svg):** width, height (inner SVG size separate from container)
- **Arrow/round buttons (.viewer-zoom-btn, carousel arrows):** width, height, borderRadius

**Layout:**
- **Container:** paddingInline, paddingBlock, borderRadius, backgroundColor
- **Section:** paddingBlock, paddingInline, marginTop, gap
- **Grid/flex gaps:** gap on card grids, accordion lists, button groups

**Colors (collect ALL computed colors per section):**
- **Heading colors (h1-h4):** color — compare with Figma text color for each heading level
- **Body/lead/muted text:** color — secondary text often uses neutral-500/600
- **Link color:** color on `a:not(.btn)` — default link, hover state not needed (static audit)
- **Nav link color:** color on `.nav-list-wrapper a` — Figma shows default nav text color
- **Button text + bg:** color, backgroundColor on each button variant (primary, ghost, outline, light)
- **Icon container color:** color on `.accordion-icon`, `.icon-box-ghost` — SVG stroke/fill inherits this
- **Icon container bg:** backgroundColor — e.g. FAQ accordion icon has white bg circle
- **Card bg:** backgroundColor on `.accordion-card`, `.facts-row-card`, `.card` — neutral-100/200 variants
- **Section bg:** backgroundColor — transparent for most, colored for some (hero, CTA)
- **Container bg:** backgroundColor — white containers on hero, video sections
- **Divider/border color:** borderColor on `hr`, separator elements

**Important color matching rules:**
- Compare rgb() values directly — do NOT compare CSS variable names
- Figma exports colors as `rgb(R,G,B)` — browser returns `rgb(R, G, B)` with spaces
- Strip spaces before comparing: `rgb(20,20,20)` = `rgb(20, 20, 20)`
- For alpha colors: compare rgba() with tolerance ±0.05 on alpha channel
- Button bg colors: match Figma fill on "buttons" named elements to browser `.btn` bg
- Ghost button: check both text color AND bg color — common mismatch source (hardcoded hex vs var)

**Media:**
- **Images (hero bg):** objectFit, objectPosition

Save to `{RUN_DIR}/browser-computed-{viewport}.json`.

### 2.1 Browser screenshots (per section, per viewport)

**Skip if `--no-visual`.**

After collecting computed styles at each viewport, take per-section screenshots.

For each `[data-section]` element on the page:

```js
// Use Playwright snapshot to find the section ref, then screenshot
const sections = await page.$$('[data-section]');
for (const section of sections) {
  const name = await section.getAttribute('data-section');
  await section.screenshot({
    path: `{RUN_DIR}/screenshots/${name}-browser-${viewport}.png`,
    scale: 'device'  // matches deviceScaleFactor
  });
}
```

**Implementation via Playwright MCP:**
1. `browser_snapshot` to get element refs for all `[data-section]` elements
2. For each section ref: `browser_take_screenshot` with `ref` and `element` params
3. Save as `{RUN_DIR}/screenshots/{section-name}-browser-{viewport}.png`

**Naming convention:**
```
{section-name}-browser-1440.png   # Browser at 1440px
{section-name}-browser-768.png    # Browser at 768px
{section-name}-browser-375.png    # Browser at 375px
{section-name}-figma-1440.png     # Figma (from Phase 1.4 cache)
{section-name}-figma.png          # Figma (single, no viewports)
```

If `--phase=browser-audit` → print summary for all viewports and stop here.

## Phase 3: COMPARE (Browser vs Figma, per viewport) — Token Audit

**Direct px-to-px comparison at each viewport. No rubber conversion formulas.**

**CRITICAL: Use viewport_mapping from meta.json to select the correct Figma cache directory.**

For each CSS breakpoint, load Figma data from the **mapped** frame:
```python
mapping = meta["viewport_mapping"]
# Desktop: browser@1440 vs figma from {CACHE_DIR}/sections/ (always 1440)
# Tablet:  browser@768  vs figma from {CACHE_DIR}/viewports/{mapping["tablet"]["figma_frame"]}/
# Mobile:  browser@375  vs figma from {CACHE_DIR}/viewports/{mapping["mobile"]["figma_frame"]}/
```

For example, if `mapping.tablet.figma_frame = "1024"`, load Figma data from `viewports/1024/` NOT `viewports/768/`.

Compare in **four groups**: typography tokens, button audit, UI element sizing, and colors.

### 3.0 Semantic Element Mapping (CRITICAL)

**Never compare elements by array position.** Map by `name` field in Figma data to CSS selector in browser.

#### Button mapping (Figma → Browser)

Each section may contain **two types of buttons**:
1. **Inline buttons** (hero CTA, split-content CTA) — typically the first 1-2 buttons in the section
2. **Section CTA button** (bottom action) — typically the LAST button, often `.btn-ghost` or `.btn-outline`

**Figma `name` → Browser selector mapping:**

| Figma element `name` | Browser selector | What to compare |
|----------------------|-----------------|-----------------|
| `"buttons"` (in fills) | `.btn`, `.hero-btn-accent`, `.btn-ghost` | bg color |
| `"buttons"` (in paddings) | `.btn`, `.btn-ghost` | paddingInline, paddingBlock |
| `"buttons"` (in radii) | `.btn`, `.btn-ghost` | borderRadius |
| `"Label"` (in texts, inside button context) | `.btn`, `.btn-ghost` | fontSize, fontWeight, color |
| `"Buttons/round"` | `.accordion-icon` | size, bg, radius |

**Matching rules:**
- Match Figma fills/paddings/radii named `"buttons"` to browser buttons **by order**: first Figma "buttons" → first browser `.btn`/`.hero-btn-accent`, second → second `.btn`/`.btn-ghost`
- If section has a CTA button (Figma `texts` with `name="Label"` and `characters="Кнопка"`), it's the section-bottom `.btn-ghost`
- **Compare ALL properties**: fontSize, fontWeight, height, paddingInline, paddingBlock, borderRadius, backgroundColor, color
- **A button check is FAILED if ANY property mismatches** — not just color

#### Inner container mapping

| Figma element `name` | Browser selector | What to compare |
|----------------------|-----------------|-----------------|
| `"container"` (FRAME type) | Section-specific inner container (`.hero-centered-buttons-inner`, `.card`, etc.) | padding, borderRadius, bg |
| Section-level (INSTANCE type) | Outer `.container` class | paddingInline only |

**CRITICAL:** Do NOT compare Figma `"container"` FRAME padding/radius with browser `.container` class — they are different elements. Figma "container" is the inner content box.

### 3.1 Rubber Sanity Check (for pik/avito)

**Run this AFTER collecting browser values, BEFORE the standard comparison.**

For rubber companies (pik, avito), cross-check that ds.json values produce correct browser output at 1440px:

```
For each btn/typography DS token with a px value in ds.json:
  expected_browser = ds_value × 0.75   (rubber formula at 1440)

  If abs(browser_computed - figma_value) > tolerance BUT
     abs(expected_browser - browser_computed) ≤ 0.5px:
    → The DS value is NOT rubber-adjusted!
    → Flag: "ds.json '{token}' = {ds_value} renders {browser}@1440 but Figma expects {figma_value}.
             Likely needs rubber conversion: {figma_value} / 0.75 = {corrected_value}"
```

**Tokens to check:** `btn-font-size`, `btn-height`, `btn-padding-inline`, `btn-padding-block`, `body-font-size`, `text-lead-font-size`, `h1-font-size`, `h2-font-size`, `h3-font-size`, `h4-font-size`, `accordion-trigger-font-size`

**Example detection:**
```
ds.json: btn-font-size = 16px
browser@1440: 14px (= max(14, 16×0.75=12) — clamped)
figma@1440:   16px
→ RUBBER MISMATCH: 16px is raw Figma value, not rubber-adjusted.
  Fix: btn-font-size = 21.33px (16/0.75) → renders 16px@1440
```

**Exception:** Values with `max()` clamps, `var()` references, `rem`/`em` units, or values explicitly marked as non-rubber in ds.json — skip these.

### 3.2 Token Comparison Tables

```
## 1440px — Typography
| Role              | Browser | Figma | Delta  | Status |
| hero-title        | 80px    | 80px  | 0      | ✓      |
| h2                | 32.25px | 32px  | 0.25px | ✓      |

## 1440px — Buttons (FULL audit per button)
| Section.Button    | Prop           | Browser        | Figma          | Delta | Status |
| hero.btn-primary  | fontSize       | 16px           | 16px           | 0     | ✓      |
| hero.btn-primary  | height         | 56px           | 56px           | 0     | ✓      |
| hero.btn-primary  | paddingInline  | 32px           | 32px           | 0     | ✓      |
| hero.btn-primary  | borderRadius   | 32px           | 32px           | 0     | ✓      |
| hero.btn-primary  | backgroundColor| rgb(252,76,2)  | rgb(252,76,2)  | 0     | ✓      |
| hero.btn-ghost    | fontSize       | 16px           | 16px           | 0     | ✓      |
| hero.btn-ghost    | height         | 56px           | 56px           | 0     | ✓      |
| hero.btn-ghost    | paddingInline  | 32px           | 32px           | 0     | ✓      |
| hero.btn-ghost    | borderRadius   | 32px           | 32px           | 0     | ✓      |
| hero.btn-ghost    | backgroundColor| rgb(238,237,235)| rgb(238,237,235)| 0    | ✓      |
| faq.btn-ghost     | fontSize       | 16px           | 16px           | 0     | ✓      |
| faq.btn-ghost     | height         | 56px           | 56px           | 0     | ✓      |
| faq.btn-ghost     | paddingInline  | 32px           | 32px           | 0     | ✓      |
| faq.btn-ghost     | borderRadius   | 32px           | 32px           | 0     | ✓      |
| faq.btn-ghost     | backgroundColor| rgb(238,237,235)| rgb(238,237,235)| 0    | ✓      |

## 1440px — UI Elements
| Role                    | Prop       | Browser | Figma | Delta | Status |
| faq.accordion-icon      | size       | 40px    | 40px  | 0     | ✓      |
| faq.accordion-icon svg  | size       | 24px    | 24px  | 0     | ✓      |
| faq.accordion-card      | radius     | 8px     | 8px   | 0     | ✓      |
| faq.accordion-card      | padding    | 32px    | 32px  | 0     | ✓      |
| stats.card              | radius     | 8px     | 8px   | 0     | ✓      |
| stats.card              | padding    | 24px    | 24px  | 0     | ✓      |
| benefits.icon-box       | size       | 64px    | 64px  | 0     | ✓      |

## 1440px — Colors
| Section           | Element          | Prop  | Browser              | Figma              | Status |
| hero              | h1               | color | rgb(20,20,20)        | rgb(20,20,20)      | ✓      |
| hero              | lead             | color | rgb(20,20,20)        | rgb(20,20,20)      | ✓      |
| faq               | accordion-icon   | bg    | rgb(255,255,255)     | rgb(255,255,255)    | ✓      |
| faq               | card             | bg    | rgb(247,247,245)     | rgb(247,247,245)    | ✓      |
| footer            | nav-link         | color | rgb(90,90,90)        | rgb(90,90,90)      | ✓      |
```

**Tolerance rules:**

| Property | ✓ Match | ~ Acceptable | ✗ Mismatch |
|----------|---------|-------------|------------|
| fontSize | ≤0.5px | ≤1px | >1px |
| fontWeight | exact | — | any diff |
| lineHeight | ≤0.5px | ≤1px | >1px |
| letterSpacing | ≤0.1px | ≤0.3px | >0.3px |
| borderRadius | ≤0.5px | ≤1px | >1px |
| color | ±1/channel | ±3/channel | >3/channel |
| padding/spacing | ≤1px | ≤2px | >2px |
| height/width | ≤1px | ≤2px | >2px |
| gap | ≤1px | ≤2px | >2px |
| **icon-box size** | ≤1px | ≤2px | >2px |
| **icon SVG size** | exact | ≤1px | >1px |
| **card padding** | ≤1px | ≤2px | >2px |
| **card radius** | ≤0.5px | ≤1px | >1px |
| **tab height** | ≤1px | ≤2px | >2px |
| **btn height** | ≤1px | ≤2px | >2px |

Save `{RUN_DIR}/comparison-results.json` with all matches and mismatches per viewport.

If `--phase=compare` → stop here.

## Phase 3.5: VISUAL COMPARISON (pixelmatch diff)

**Skip if `--no-visual`. Run exclusively if `--visual-only`.**

This phase performs pixel-level visual comparison using pixelmatch, then optionally uses Claude Vision to analyze the diff images.

### 3.5.1 Run pixelmatch diff

Execute the diff script. **Pass `--viewport-map` if tablet Figma frame differs from browser viewport:**

```bash
# Read viewport_mapping from meta.json to build the map arg
# Example: if tablet maps to Figma frame "1024" → pass --viewport-map=768:1024
node app/tests/figma-pixel-diff.mjs \
  --run-dir={RUN_DIR} \
  --cache-dir={CACHE_DIR} \
  --threshold=0.1 \
  --viewport-map=768:{tablet_figma_frame}
```

The `--viewport-map=768:1024` tells the script: for browser@768 screenshots, compare against `{section}-figma-1024.png` instead of `{section}-figma-768.png`.

This produces:
- `{RUN_DIR}/screenshots/{section}-diff-{viewport}.png` — red pixels = differences
- `{RUN_DIR}/visual-comparison.json` — scores and mismatch percentages

### 3.5.2 Auto-scoring thresholds

| Score | Mismatch % | Meaning |
|-------|-----------|---------|
| `A` | ≤0.5% | Pixel-perfect |
| `B` | ≤2% | Minor (anti-aliasing, subpixel rounding) |
| `C` | ≤5% | Notable differences |
| `D` | ≤15% | Major differences |
| `F` | >15% | Broken |

### 3.5.3 Skip Claude analysis for A/B scores

Sections with score A or B are automatically passed — no Claude Vision needed. This saves time and tokens.

### 3.5.4 Parallel agent analysis (visual-diff-analyzer)

For sections scoring C or worse, dispatch **one `visual-diff-analyzer` agent per section** in parallel. Each agent independently analyzes all viewports for its assigned section.

**Agent:** `visual-diff-analyzer` (`.claude/agents/ds/visual-diff-analyzer.md`)

**Dispatch pattern:**

```python
# 1. Group pixelmatch results by section
sections_to_analyze = {}
for result in visual_comparison["results"]:
    if result["score"] in ("C", "D", "F"):
        sections_to_analyze.setdefault(result["section"], []).append(result)

# 2. Dispatch one agent per section — ALL IN PARALLEL
for section, viewport_data in sections_to_analyze.items():
    Agent(
        subagent_type="visual-diff-analyzer",
        model="sonnet",
        prompt=f"""
Analyze visual differences for section "{section}" of company "{company}".

## Viewport data
{json.dumps(viewport_data, indent=2)}

## Screenshot paths
For each viewport above:
- Diff: {RUN_DIR}/screenshots/{section}-diff-{{viewport}}.png
- Figma: {CACHE_DIR}/screenshots/{section}-figma-{{viewport}}.png
- Browser: {RUN_DIR}/screenshots/{section}-browser-{{viewport}}.png

IMPORTANT: Figma uses placeholder text and images. Browser uses real content.
IGNORE all text/image differences. Focus ONLY on structural issues:
element positioning, sizing, spacing, background colors, border-radius, alignment.
If all differences are from different content → verdict CONTENT_ONLY.

Classify each red zone per the visual-diff-analyzer spec.
Return JSON.
"""
    )
```

**Important:** All agents launch in a single message (parallel tool calls). Do NOT wait for one agent before launching the next.

### 3.5.5 Merge agent results

After all agents complete:

1. Parse each agent's JSON response
2. For each section, update `visual-comparison.json` with the analysis:

```json
{
  "section": "hero-centered-buttons",
  "viewports": [
    {
      "width": 1440,
      "score": "C",
      "mismatchPercent": 3.45,
      "verdict": "HAS_BUGS",
      "realBugs": [
        {
          "type": "typography",
          "element": "h1",
          "description": "Title font-size ~48px vs ~56px in Figma",
          "severity": "major"
        }
      ],
      "contentDiffs": ["Background image differs"]
    },
    {
      "width": 768,
      "score": "D",
      "mismatchPercent": 12.5,
      "verdict": "CONTENT_ONLY",
      "realBugs": [],
      "contentDiffs": ["All differences from different text and images"]
    }
  ],
  "summary": { "totalBugs": 1, "critical": 0, "major": 1, "minor": 0 }
}
```

3. **Score upgrade:** Sections where ALL viewports have `verdict: "CONTENT_ONLY"` → upgrade to `B` (not a real visual bug)
4. Write updated `visual-comparison.json`

### 3.5.6 Different aspect ratios

pixelmatch handles size differences by resizing (sharp) to match dimensions before comparison. The script crops to the smaller height from top. Width is normalized to the smaller width.

Content differences (placeholder text vs template text) will appear as mismatch — agents classify these as `content` noise, not bugs.

### 3.5.7 Full execution flow

```
1. Run pixelmatch script (all pairs, sequential, fast <1s per pair)
          ↓
2. Read visual-comparison.json, group results by section
          ↓
3. Sections with ALL viewports A/B → auto-pass (no agent needed)
          ↓
4. Sections with ANY C/D/F viewport → dispatch visual-diff-analyzer agent
          ↓  ↓  ↓  ... (ALL in parallel, one per section)
          hero    faq    cta    features ...
          ↓  ↓  ↓  ...
5. Collect agent results, merge into visual-comparison.json
          ↓
6. CONTENT_ONLY sections → upgrade to B
          ↓
7. Print summary table:
   | Section | 1440 | 768 | 375 | Verdict | Bugs |
```

**Important:** Step 6 prevents false positives from placeholder content — a section with 72% pixel diff but zero real bugs gets upgraded to B.

If `--phase=visual` → print visual comparison summary and stop here.

## Phase 4: REPORT

Generate `{RUN_DIR}/report.md`:

```markdown
# Figma Audit Report — {company}
Date: {timestamp}
Viewports: 1440px, 768px, 375px

## Token Audit Summary
| Viewport | ✓ Match | ~ Acceptable | ✗ Mismatch |
|----------|---------|-------------|------------|
| 1440px   | N       | N           | N          |
| 768px    | N       | N           | N          |
| 375px    | N       | N           | N          |

## Visual Comparison Summary
| Section | 1440px | 768px | 375px | Avg Mismatch% | Issues |
|---------|--------|-------|-------|---------------|--------|
| hero    | A (0.3%)| B (1.2%)| C (3.5%)| 1.7% | Mobile subtitle overflow |
| faq     | B (1.1%)| A (0.4%)| B (1.8%)| 1.1% | Desktop heading size     |
| ...     | ...    | ...   | ...   | ...           | ...                      |

## Token Mismatches by viewport
### 1440px
...
### 768px
...
### 375px
...

## Visual Differences by section
### hero-center-showcase
**1440px: Score B**
- Figma: `screenshots/hero-center-showcase-figma.png`
- Browser: `screenshots/hero-center-showcase-browser-1440.png`
- Differences: subtitle font 15.75px vs 16px (minor)

### faq-two-column-cards
...

## Proposed Fixes
For each mismatch:
1. Identify breakpoint (desktop / tablet / mobile)
2. Current ds value → browser renders → Figma expects
3. Proposed ds value using breakpoint formula:
   - Desktop: figma_1440 ÷ 0.75
   - Tablet: figma_768 (direct)
   - Mobile: figma_375 (direct)
```

Generate `{RUN_DIR}/proposed-fixes.json`:
```json
[
  {
    "type": "ds-global",
    "breakpoint": "tablet",
    "token": "h2-font-size",
    "current_browser": "17.2px",
    "figma_expects": "24px",
    "proposed_ds": "24px",
    "reasoning": "@768: need calc(24/7.68*1vw) = 24px"
  },
  {
    "type": "tpl-responsive",
    "breakpoint": "tablet",
    "section": "faq.simple-button",
    "element": ".accordion-icon",
    "props": { "width": "30px", "height": "30px", "min-width": "30px", "padding": "6px" },
    "current_browser": "40px",
    "figma_expects": "30px",
    "reasoning": "Figma Buttons/round: padding 6px each → box 30px. Template hardcodes 40px."
  },
  {
    "type": "tpl-responsive",
    "breakpoint": "tablet",
    "section": "faq.simple-button",
    "element": ".accordion-card",
    "props": { "border-radius": "6px", "padding": "24px" },
    "current_browser": "radius:8px, pad:32px",
    "figma_expects": "radius:6px, pad:24px",
    "reasoning": "Figma accordion/desktop @768: radius 6, padding 24"
  },
  {
    "type": "ds-rubber-mismatch",
    "breakpoint": "desktop",
    "token": "btn-font-size",
    "ds_value": "16px",
    "current_browser": "14px",
    "figma_expects": "16px",
    "proposed_ds": "21.33px",
    "reasoning": "ds.json 16px is raw Figma value. Rubber: 16/19.2*14.4=12px, max-clamped to 14px. Fix: 16/0.75=21.33px → renders 16px@1440"
  },
  {
    "type": "ds-rubber-mismatch",
    "breakpoint": "desktop",
    "token": "btn-height",
    "ds_value": "56px",
    "current_browser": "42px",
    "figma_expects": "56px",
    "proposed_ds": "74.67px",
    "reasoning": "ds.json 56px rubber-shrinks to 42px@1440. Fix: 56/0.75=74.67px"
  }
]
```

**IMPORTANT:** Only propose fixes where browser ≠ figma. If browser matches figma but ds.json looks "wrong" by formula — it's NOT a real issue.

**ALSO IMPORTANT:** For rubber companies (pik/avito), if browser ≠ figma AND `ds_value × 0.75 ≈ browser_computed`, this is a **rubber mismatch** — the ds.json value was not converted. Propose `figma_px / 0.75` as the corrected value. This is a common and high-impact bug class.

If `--output-json`:
Write `{RUN_DIR}/audit-report.json`:
```json
{
  "timestamp": "{ISO}",
  "company": "{company}",
  "viewports": {
    "1440": {
      "matches": [{ "role": "h1", "browser": "64px", "figma": "64px", "delta": "0px" }],
      "mismatches": [{ "role": "btn-radius", "browser": "8px", "figma": "12px", "delta": "4px" }],
      "ui_elements": {
        "matches": [
          { "section": "faq", "element": "accordion-icon", "prop": "size", "browser": "40px", "figma": "40px" },
          { "section": "faq", "element": "accordion-card", "prop": "radius", "browser": "8px", "figma": "8px" },
          { "section": "stats", "element": "card", "prop": "padding", "browser": "24px", "figma": "24px" }
        ],
        "mismatches": []
      }
    },
    "768": { ... },
    "375": { ... }
  },
  "proposed_fixes": [
    { "type": "ds-global", "breakpoint": "desktop", "token": "btn-radius", "current": "8px", "proposed": "12px" }
  ],
  "summary": { "total_checks": 45, "matches": 42, "mismatches": 3 }
}
```

Print report summary. If `--dry-run` or no `--fix` → stop here.

## Phase 5: FIX (only with --fix)

### 5.1 Present fixes to user

For each proposed fix:
- Diff preview of what changes
- Breakpoint affected (desktop / tablet / mobile)
- Blast radius (how many sections affected)
- Ask: **[apply / skip / modify]**

### 5.2 Apply approved fixes

**DS-global fixes:**
1. Edit ds.json values for the appropriate breakpoint
2. If sections.{type} overrides have same token → update those too (grep!)
3. Run rubber pipeline:
   ```bash
   # For pik/avito (rubber):
   node app/scripts/generate-ds-results.mjs {company}
   node app/scripts/render-ds-css.mjs {company} --production-ds \
     --out app/src/generated-css-from-twig/{company}-ds.css

   # For minimal:
   node app/scripts/render-ds-css.mjs minimal \
     --out app/src/generated-css-from-twig/minimal-ds.css
   ```

**Section-variant fixes:**
Delegate to ds-fixer agent with specific constraints.

**Template-level UI element fixes (icon sizes, card padding/radius, tab sizing):**

These are NOT DS tokens — they're hardcoded in `.tpl` files. Fix strategy:

1. **Identify the .tpl file** for the section (e.g. `faq/simple-button/index.tpl`)
2. **Add `@media` blocks** in the `<style>` section of the `.tpl`:
   - `@media (min-width: 768px) and (max-width: 1023px) { ... }` for tablet
   - `@media (max-width: 767px) { ... }` for mobile
3. **Common patterns:**
   - **Icon box resize:** change `width`, `height`, `min-width`, `padding` + inner SVG `width`/`height`
   - **Card responsive:** change `border-radius`, `padding`
   - **Button responsive:** change `border-radius`, `height`, `padding-inline`
   - **Tab responsive:** change `height`, `padding-inline`, `font-size`
4. **Important:** Use exact media query syntax — Tailwind responsive classes don't work in `.tpl` due to parser.js scoping
5. **Verify** both the target viewport AND desktop to catch regressions (media queries must not leak)

Example fix for accordion icon at tablet:
```css
@media (min-width: 768px) and (max-width: 1023px) {
  .accordion-icon { width: 30px; height: 30px; min-width: 30px; padding: 6px; }
  .accordion-icon svg { width: 18px; height: 18px; }
}
```

**DS-twig fixes:**
Edit company twig, then delegate to twig-sync agent.

### 5.3 Verify token fixes

Re-run Phase 2 + Phase 3 for changed viewports/sections only:
1. Reload page in Playwright at each affected viewport
2. Collect browser computed styles for affected sections
3. Compare with Figma values

Show per viewport:
```
## 1440px: Fixed: N | Remaining: N | Regressions: N
## 768px:  Fixed: N | Remaining: N | Regressions: N
## 375px:  Fixed: N | Remaining: N | Regressions: N
```

If regressions → warn, do NOT auto-commit.

### 5.4 Fix visual bugs (from Phase 3.5 analysis)

**Skip if `--no-visual` was used or no visual bugs found.**

This step takes `realBugs` from visual-diff-analyzer results and dispatches parallel ds-fixer agents.

#### 5.4.1 Build fix tasks from visual analysis

Read `visual-comparison.json` and collect all sections with `verdict: "HAS_BUGS"`:

```python
fix_tasks = []
for section in visual_comparison:
    for vp in section["viewports"]:
        if vp["verdict"] == "HAS_BUGS":
            for bug in vp["realBugs"]:
                fix_tasks.append({
                    "section": section["section"],
                    "viewport": vp["width"],
                    "bug": bug
                })
```

Group by section — each section's bugs go to ONE ds-fixer agent.

#### 5.4.2 Present visual fixes to user

Before dispatching fixers, show the summary:

```
## Visual bugs to fix:

| # | Section | Viewport | Type | Element | Description | Severity |
|---|---------|----------|------|---------|-------------|----------|
| 1 | hero    | 1440     | typography | h1 | font-size 48px vs 56px | major |
| 2 | hero    | 375      | spacing | buttons | gap 16px vs 24px | minor |
| 3 | faq     | 1440     | radius | card | border-radius 4px vs 8px | major |

Proceed with fixes? [yes / skip / select]
```

If user says "select" → let them pick which bugs to fix.

#### 5.4.3 Dispatch parallel ds-fixer agents

For each section with approved bugs, dispatch a ds-fixer agent:

```
For each section with bugs to fix:
  → Agent(subagent_type="ds-fixer", prompt=...)
```

**All fixers launch in parallel** (one per section). Each fixer receives:

```
Fix visual bugs for section "{section}" of company "{company}".

## Bugs to fix
{JSON array of realBugs for this section, all viewports}

## Rules
- DS-First: try fixing in ds.json before touching .tpl
- For typography bugs: check if the token exists in ds.json (font-size, line-height, etc.)
- For spacing bugs: check container-padding, section-padding, card-gap tokens
- For radius bugs: check card-border-radius, button-border-radius tokens
- For color bugs: check theme tokens, section overrides
- After editing ds.json: run rubber pipeline to regenerate CSS
- After editing .tpl: take a screenshot to verify

## Rubber pipeline (run after ds.json changes)
For pik/avito: node app/scripts/generate-ds-results.mjs {company} && node app/scripts/render-ds-css.mjs {company} --production-ds --out app/src/generated-css-from-twig/{company}-ds.css
For minimal: node app/scripts/render-ds-css.mjs minimal --out app/src/generated-css-from-twig/minimal-ds.css

## Verification
After fixing, take a browser screenshot of the section at the affected viewport(s)
and compare visually with the Figma screenshot.
```

#### 5.4.4 Verify visual fixes with pixelmatch

After all ds-fixer agents complete:

1. Re-take browser screenshots for fixed sections (all 3 viewports)
2. Re-run pixelmatch for those sections only:
   ```bash
   node app/tests/figma-pixel-diff.mjs \
     --run-dir={RUN_DIR}/verify \
     --cache-dir={CACHE_DIR} \
     --threshold=0.1 \
     --viewport-map=768:{tablet_figma_frame}
   ```
3. Compare before/after scores:

```
## Visual Fix Verification
| Section | Viewport | Before | After | Status |
|---------|----------|--------|-------|--------|
| hero    | 1440     | C (3.5%) | A (0.4%) | ✓ Fixed |
| hero    | 375      | D (12%)  | B (1.8%) | ✓ Fixed |
| faq     | 1440     | C (4.2%) | C (3.9%) | ~ Marginal |
```

4. If a section's score improved (moved closer to A/B) → accept fix
5. If a section's score worsened → **revert that section's changes**, warn user

### 5.5 Commit

**If `--no-commit` is NOT set:**

If user approves and no regressions:
```bash
git add app/src/companies-components-scope/{company}/
git commit -m "fix({company}): figma audit — N token fixes, M visual fixes across 3 viewports"
```

**If `--no-commit` IS set:**
Skip git commit. Print: "Fixes applied to disk. Commit deferred (--no-commit mode)."

## Key Rules

1. **Browser = source of truth** — compare computed styles vs Figma, not ds.json formulas
2. **Never fix based on formula** — `ds_value * 0.75 ≠ figma` is NOT a valid reason to change ds.json
3. **3 viewports always** — audit 1440px, 768px, 375px by default (matching Figma frames)
4. **3-breakpoint rubber** — each viewport has its own rubber system (19.2 / 7.68 / 3.75 denominators)
5. **Confirmation required** — always ask before applying fixes
6. **Rubber pipeline is mandatory** — after ds.json changes for pik/avito: `generate-ds-results.mjs` then `render-ds-css.mjs --production-ds`
7. **sections.{type} overrides** — when fixing a global token, grep all `sections.*` for the same token
8. **No regressions** — do not commit if verification shows new issues
9. **REST API first** — try Figma REST API before MCP (faster, no Desktop needed)
10. **Visual + Token audit** — both analyses run by default. Use `--no-visual` to skip screenshots, `--visual-only` for screenshots-only mode
11. **Figma screenshots via REST API** — `GET /v1/images/{fileKey}?ids={nodeIds}&format=png&scale=2`. Batch up to 15 IDs per request. Images are cached in `{CACHE_DIR}/screenshots/`
12. **Browser screenshots via Playwright** — per-section element screenshots at each viewport. Use `element.screenshot()` with `scale: 'device'` for retina match
13. **Visual scoring** — A (pixel-perfect) through F (broken). Score C+ triggers visual-diff-analyzer, bugs from analyzer feed into ds-fixer
14. **Content differences are NOT mismatches** — Figma uses placeholder text, browser uses template text. Focus on styling (font, color, spacing, layout), NOT on text content or image content
15. **Visual fix loop** — Phase 3.5 (analyze) → Phase 5.4 (fix) → Phase 5.4.4 (verify with pixelmatch). Score must improve, never worsen
16. **Parallel agents per section** — visual-diff-analyzer (analysis) and ds-fixer (fixes) both run one-agent-per-section in parallel
17. **UI element sizing is REQUIRED** — always audit icon boxes, cards, buttons, tabs, and accordion elements at all 3 viewports. These are commonly different per-breakpoint in Figma but hardcoded at single size in templates
18. **UI element fixes go in .tpl** — icon sizes, card padding/radius, tab sizing are template-level, not DS tokens. Use `@media` blocks in `<style>` section. Never use Tailwind responsive classes in .tpl (parser.js scoping conflict)
19. **Figma padding → element size** — icon box size = inner_icon_size + (padding × 2). Compute expected box size from Figma padding data. Compare with browser computed width/height
20. **Three comparison groups** — Typography (DS tokens), UI Elements (template-level), and Colors (DS tokens + template overrides). Each group has its own fix strategy
21. **Color audit is REQUIRED** — always compare text colors, button bg/text, icon colors, card bg, container bg for every section. Common bugs: hardcoded hex instead of `var(--color-*)`, ghost button bg using wrong neutral shade
22. **Color fix priority** — if color mismatch is in ds.json (e.g. `btn-ghost-bg: "#f4f4f3"` vs Figma `#f7f7f5`) → fix ds.json to use `var(--color-neutral-200)`. If in .tpl (e.g. hero text `color: #ffffff` vs Figma dark) → fix in template CSS
23. **Figma fill names map to CSS** — Figma "buttons" fill → `.btn` bg, "accordion / desktop" fill → `.accordion-card` bg, "Buttons/round" fill → `.accordion-icon` bg, "icon" fill → `.icon-box-ghost` bg, "container" fill → `.container` bg, "item" fill → `.facts-row-card` bg
24. **Button audit is FULL-PROPERTY** — for EVERY button in every section, compare ALL of: fontSize, fontWeight, height, paddingInline, paddingBlock, borderRadius, backgroundColor, color. A button with correct color but wrong size is still a bug. Never skip sizing just because color matches
25. **Rubber sanity check is MANDATORY for pik/avito** — after browser audit, cross-check ds.json px values against rubber formula. If `ds_value × 0.75 ≈ browser_computed` but `browser_computed ≠ figma_value`, the ds.json value was not rubber-adjusted. Fix: `figma_px / 0.75`. Common offenders: `btn-font-size`, `btn-height`, `btn-padding-inline`, `body-font-size`, `text-lead-font-size`
26. **Semantic mapping, not positional** — match Figma elements to browser elements by `name` field, not by array index. Figma `fills[name="buttons"]` → browser `.btn-ghost`, not "the Nth fill → the Nth browser element"
27. **Section CTA button** — many sections (FAQ, features, CTA) have a bottom action button (`.btn-ghost`/`.btn-outline`). In Figma this appears as the LAST "buttons" element with text "Кнопка"/"Label". Always check it — common source of missed mismatches
28. **Inner container ≠ page container** — Figma "container" (FRAME type) is the inner white box (padding, radius, bg). Browser `.container` is the outer page wrapper. Compare Figma "container" with the section-specific inner element (`.hero-centered-buttons-inner`, `.card`, etc.), NOT with `.container`
29. **Layout structure audit (responsive)** — Token comparison catches value mismatches but NOT structural differences (grid vs accordion, expanded vs collapsed, flex-direction row vs column). For each section at EACH viewport, compare the **layout pattern** between Figma and browser: (a) Is the Figma layout a grid/list/accordion/stacked? (b) Does the browser use the same pattern? Common structural mismatches: nav as expanded grid in browser but accordion in Figma at mobile; CTA strip as row in Figma but stacked column in browser. These require .tpl changes (HTML + CSS), not DS token fixes. Flag them as `type: "layout-structure"` in proposed-fixes.json.
30. **Viewport frame mapping is MANDATORY** — never assume Figma frame names match CSS breakpoints. Always run the auto-mapping algorithm (see "Figma frame discovery") and use `viewport_mapping` from meta.json. Pass `--viewport-map` to pixelmatch script. Common trap: Figma has 4 frames (1440/1024/768/375), tablet DS tokens match frame 1024, NOT 768.
