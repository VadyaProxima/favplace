---
name: figma-extractor
description: >
  Extracts design tokens and section map from a Figma URL.
  Outputs tokens.json (colors, typography, radii, spacing, fonts) and
  sections-map.json (section types, per-viewport styles, elements list).
  All values are RAW Figma px — no rubber conversion.
color: blue
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
---

# Figma Extractor

Extracts design tokens and section map from a Figma file. Works autonomously:
fetches Figma data via REST API, parses the node tree, extracts tokens,
classifies sections, downloads screenshots, writes structured JSON artifacts.

## Input Parameters

Extract from the prompt:
- `figma_url` — REQUIRED. Figma file URL (format: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y`)
- `company` — REQUIRED. Company name for output directory
- `output_dir` — (optional) Output directory path. Default: `app/src/companies-components-scope/{company}/figma-pipeline/`

## Step 0 — Parse URL & Setup

Parse the Figma URL:
- Extract `fileKey` from path segment after `/design/`
- Extract `nodeId` from `?node-id=X-Y` query param → convert `X-Y` to `X:Y`
- If no `node-id` → use root of file

Read Figma token:
```bash
TOKEN=$(cat ~/.claude/figma.token)
```

Test token validity:
```bash
curl -s -H "X-Figma-Token: $TOKEN" "https://api.figma.com/v1/me" | head -c 200
```

If 403 or invalid → abort with: "Figma token expired. Refresh ~/.claude/figma.token"

Create output directory:
```bash
mkdir -p {output_dir}/screenshots
```

## Step 1 — Fetch Figma File Structure

Get top-level structure to find viewport frames:

```bash
curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}?ids={nodeId}&depth=2" \
  -o {output_dir}/figma-structure.json
```

Parse the response. Find viewport frames — children of the target node with:
- Name containing "1440" or width ≈ 1440 → desktop frame
- Name containing "768" or width ≈ 768 → tablet frame
- Name containing "375" or width ≈ 375 → mobile frame

Record which viewports are available:
```json
{
  "1440": { "available": true, "node_id": "XX:YY" },
  "768":  { "available": true, "node_id": "XX:ZZ" },
  "375":  { "available": true, "node_id": "XX:WW" }
}
```

If NO viewport frames found → use the first child frame as 1440, warn:
"⚠️ No viewport frames found. Using first frame as 1440px reference."

## Step 2 — Fetch Deep Node Data

For each available viewport, fetch the full node tree:

```bash
curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/files/{fileKey}?ids={viewport_node_id}&depth=12" \
  -o {output_dir}/figma-viewport-{width}.json
```

**Rate limiting:** If HTTP 429, wait 60s and retry (max 3 retries). The `/v1/files` endpoint has a separate rate bucket from `/v1/nodes` — prefer it.

Save raw response to `{output_dir}/figma-raw.json` (merge all viewports).

## Step 3 — Extract Global Tokens (from 1440px frame)

Walk the 1440px viewport node tree and extract:

### 3.1 Colors

Collect ALL unique `fills[].color` from all nodes (where `fills[].type === "SOLID"`).

Convert Figma RGBA (0-1 range) to hex: `r*255, g*255, b*255`.

Cluster colors:
1. **Achromatic** (HSL saturation < 10%): sort by lightness → neutral palette
   - Map to: `neutral-50` (lightest) through `neutral-900` (darkest)
2. **Chromatic**: cluster by hue (±30°)
   - Most frequent cluster → primary color
   - Pick the mid-lightness color as `primary-500`
   - Generate shades 50-950 algorithmically:
     - 50: mix with white 95%
     - 100: mix with white 90%
     - 200: mix with white 75%
     - 300: mix with white 50%
     - 400: mix with white 25%
     - 500: base color
     - 600: mix with black 15%
     - 700: mix with black 30%
     - 800: mix with black 45%
     - 900: mix with black 60%
     - 950: mix with black 75%
   - Second most frequent cluster → accent (if exists, >3 usages)

### 3.2 Typography

Collect all TEXT nodes. Group by `fontSize` (descending). Map to hierarchy:
- Largest → h1 (typically 48-80px)
- Second largest → h2 (typically 32-48px)
- Third → h3 (typically 20-32px)
- Fourth → h4 (typically 16-24px)
- Most frequent mid-size → body (typically 14-18px)
- Smallest frequent → caption/small

For each level, record: `fontSize`, `fontWeight`, `lineHeightPx` (convert to unitless: lineHeightPx / fontSize), `letterSpacing`, `fontFamily`.

**Repeat for 768px and 375px viewports** (if available):
- Extract the same TEXT node hierarchy from each viewport frame
- Write to `typography_tablet` and `typography_mobile` keys in tokens.json
- Only include values that DIFFER from the 1440px frame (smaller font-size, different line-height, etc.)

### 3.3 Fonts

Collect unique `fontFamily` values. Most frequent = primary, second = secondary (if different).

**Font availability check:** Search Google Fonts API:
```bash
curl -s "https://fonts.google.com/download/list?family={fontFamily}" | head -c 100
```
If not found → warn: "⚠️ Font '{fontFamily}' not found on Google Fonts. Fallback: system-ui, sans-serif"

### 3.4 Radii

Collect `cornerRadius` from all FRAME/RECTANGLE nodes. Cluster by frequency:
- Most common on large containers → `card-radius`
- Most common on small interactive elements → `btn-radius`
- Most common on inputs → `input-radius`

### 3.5 Spacing

From the 1440px frame:
- Container padding: `paddingLeft` of the first section frame → `container-padding-inline`
- Section gap: `itemSpacing` between top-level sections → `section-gap`

### 3.6 Buttons

Find nodes that look like buttons (small FRAME with TEXT child + fills + cornerRadius):
- Extract: height, paddingLeft/Right (→ `btn-padding-inline`), paddingTop/Bottom (→ `btn-padding-block`), fontSize (→ `btn-font-size`), cornerRadius (→ `btn-radius`), fontWeight (→ `btn-font-weight`)

## Step 4 — Classify & Map Sections

For each viewport frame, list its top-level children. These are sections.

For the 1440px frame (primary), for each section child:

1. **Slug from name:** `"Hero Section"` → `hero`, `"Часто задаваемые вопросы"` → `faq`
   - Lowercase, strip "section", "block", "секция", "блок"
   - Transliterate Russian if needed

2. **Type classification** (by name + content heuristics):
   | Heuristic | Type |
   |---|---|
   | Name contains "hero" or is first section | `hero` |
   | Name contains "header" or "nav" | `header` |
   | Name contains "footer" | `footer` |
   | Has accordion-like structure (multiple expandable items) | `faq` |
   | Has pricing cards with prices | `pricing` |
   | Has form inputs | `contact` |
   | Has testimonial/quote structure | `testimonials` |
   | Has numbered steps | `how-it-works` |
   | Has team member cards with avatars | `team` |
   | Has stat numbers | `stats` |
   | Name contains "cta" or "call to action" | `cta` |
   | Has feature cards/icons | `features` |
   | Has blog post cards | `blog` |
   | Has portfolio/gallery images | `portfolio` |
   | Has download buttons/app store badges | `download` |
   | Has timeline/chronological items | `timeline` |
   | Has job listings | `job-board` |
   | Default with cards | `cards` |
   | Default with text blocks | `about` |

   Assign `type_confidence`: name match → 0.9+, content heuristic → 0.6-0.8, fallback → 0.3

3. **Elements list** using shared vocabulary:
   - `h1`/`h2` → `heading`
   - `p` below heading → `subheading` (first) or `paragraph`
   - Button-like with primary fill → `button-primary`
   - Button-like with outline → `button-outline`
   - `img` or image fill → `image`
   - Accordion structure → `accordion`
   - Card grid → `card` + `grid-{N}`
   - etc. (see element vocabulary in spec)

4. **Section-specific overrides:** Compare section's typography/colors/spacing against global tokens. Differences → section overrides.

   Format per-viewport:
   ```json
   "section_overrides": {
     "1440": { "h1-font-size": "80px" },
     "768": { "h1-font-size": "56px" },
     "375": { "h1-font-size": "36px" }
   }
   ```

5. **Order:** Y position of section in viewport → `order: 0, 1, 2...`

## Step 5 — Download Section Screenshots

Batch download Figma screenshots for all sections across all viewports:

```bash
# Collect all node IDs (comma-separated)
NODE_IDS="{section1_id},{section2_id},..."

curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/images/{fileKey}?ids={NODE_IDS}&format=png&scale=2" \
  -o {output_dir}/image-urls.json
```

Parse response, download each image:
```bash
curl -s -o {output_dir}/screenshots/{safe_name}-{viewport}.png "{image_url}"
```

## Step 6 — Write Output Artifacts

### tokens.json

```json
{
  "colors": {
    "primary-50": "#eff6ff",
    "primary-100": "#dbeafe",
    "primary-500": "#3b82f6",
    "primary-900": "#1e3a5a",
    "neutral-50": "#fafafa",
    "neutral-900": "#171717"
  },
  "typography": {
    "h1": { "font-size": "64px", "font-weight": 500, "line-height": "1.1", "letter-spacing": "-0.02em" },
    "h2": { "font-size": "48px", "font-weight": 600, "line-height": "1.2", "letter-spacing": "-0.01em" },
    "h3": { "font-size": "24px", "font-weight": 600, "line-height": "1.3" },
    "h4": { "font-size": "20px", "font-weight": 600, "line-height": "1.4" },
    "body": { "font-size": "16px", "font-weight": 400, "line-height": "1.5" }
  },
  "typography_tablet": {
    "h1": { "font-size": "48px", "font-weight": 500, "line-height": "1.15" },
    "h2": { "font-size": "36px", "font-weight": 600, "line-height": "1.2" },
    "body": { "font-size": "15px", "font-weight": 400, "line-height": "1.5" }
  },
  "typography_mobile": {
    "h1": { "font-size": "32px", "font-weight": 500, "line-height": "1.2" },
    "h2": { "font-size": "26px", "font-weight": 600, "line-height": "1.25" },
    "body": { "font-size": "15px", "font-weight": 400, "line-height": "1.5" }
  },
  "radii": { "card": "12px", "btn": "8px", "input": "8px" },
  "spacing": {
    "container-padding-inline": "60px",
    "container-padding-block": "80px",
    "section-gap": "0px"
  },
  "buttons": {
    "font-size": "15px",
    "font-weight": 600,
    "padding-block": "10px",
    "padding-inline": "20px",
    "radius": "8px"
  },
  "fonts": {
    "primary": { "family": "Inter", "available": true },
    "secondary": null
  },
  "viewports": {
    "1440": { "available": true, "node_id": "XX:YY" },
    "768": { "available": true, "node_id": "XX:ZZ" },
    "375": { "available": true, "node_id": "XX:WW" }
  }
}
```

**All values are RAW Figma px. No rubber conversion.**

### sections-map.json

```json
[
  {
    "figma_name": "Hero Section",
    "type": "hero",
    "type_confidence": 0.95,
    "node_id": "123:456",
    "order": 0,
    "viewports": {
      "1440": { "styles": { "h1-font-size": "64px", "h1-font-weight": 500 }, "screenshot": "screenshots/hero-1440.png" },
      "768":  { "styles": { "h1-font-size": "48px" }, "screenshot": "screenshots/hero-768.png" },
      "375":  { "styles": { "h1-font-size": "32px" }, "screenshot": "screenshots/hero-375.png" }
    },
    "section_overrides": {
      "1440": { "h1-font-size": "80px" },
      "768": { "h1-font-size": "56px" },
      "375": { "h1-font-size": "36px" }
    },
    "elements": ["heading", "subheading", "button-primary", "button-outline", "image"]
  }
]
```

### status.json

```json
{
  "current_phase": 1,
  "completed_phases": [0, 1],
  "phase_results": {
    "1": {
      "status": "ok",
      "timestamp": "2026-04-02T12:00:00Z",
      "artifacts": ["tokens.json", "sections-map.json"],
      "sections_count": 8,
      "viewports": ["1440", "768", "375"]
    }
  }
}
```

## Validation

Before writing output, verify:
- ≥1 primary color extracted
- ≥1 font family found
- ≥1 section identified
- tokens.json is valid JSON
- sections-map.json is valid JSON array

If any threshold not met → abort with descriptive error.

## Important Constraints

- **Output RAW px** — never convert to rubber values. Phase 2 (scaffold) handles conversion.
- **REST API preferred** — use `/v1/files` endpoint (separate rate bucket from `/v1/nodes`)
- **Rate limit budget** — estimate calls before starting: 1 structure + N viewport fetches + 1 batch screenshot
- **depth=12** — for deeply nested auto-layout components
- **Do not modify any project files** — only write to the output directory
