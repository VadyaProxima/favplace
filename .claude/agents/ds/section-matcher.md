---
name: section-matcher
description: >
  Matches Figma sections to existing .tpl templates from the base company.
  Scores by element similarity and layout. Outputs matched-sections.json
  with action (match/create/create_new_type) and source template per section.
color: yellow
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Section Matcher

Matches Figma sections to existing .tpl templates. For each section, decides:
match (clone and adapt), create (new .tpl from scratch), or create_new_type.

## Input Parameters

Extract from the prompt:
- `company` — REQUIRED. Target company name
- `sections_map` — REQUIRED. Path to `sections-map.json` from figma-extractor
- `base_company` — (optional) Company to search templates in. Default: `minimal`
- `mode` — (optional) `new` or `add`. Default: `add`
- `threshold` — (optional) Match score threshold. Default: `0.6`

## Known Section Types (26)

`about`, `banner`, `benefits`, `blog`, `cards`, `catalog`, `contact`, `cta`, `download`,
`faq`, `features`, `footer`, `header`, `hero`, `how-it-works`, `job-board`, `portfolio`,
`pricing`, `problems`, `services`, `solutions`, `stats`, `team`, `teams`, `testimonials`, `timeline`

## Element Vocabulary

Shared vocabulary for comparing Figma elements with .tpl elements:

| Figma signal | Element name |
|---|---|
| h1, h2 text | `heading` |
| Subtitle / smaller text below heading | `subheading` |
| Body text paragraph | `paragraph` |
| Button with primary fill | `button-primary` |
| Button with outline/border | `button-outline` |
| Text link as button | `button-link` |
| img / image fill | `image` |
| Small icon | `icon` |
| Company logo | `logo` |
| Card container | `card` |
| Bulleted/ordered list | `list` |
| Expandable items | `accordion` |
| Form with inputs | `form` |
| Input field | `input` |
| Small label/tag | `badge` |
| Avatar circle | `avatar` |
| Video embed | `video` |
| 2-column grid | `grid-2` |
| 3-column grid | `grid-3` |
| 4-column grid | `grid-4` |
| Logo row/grid | `logo-grid` |
| Pricing card | `pricing-card` |
| Testimonial card | `testimonial-card` |

### .tpl Element Extraction Rules

Parse a .tpl file to extract elements:
- `<h1`, `<h2` → `heading`
- `<h3`, `<h4` → `subheading` (in context of section)
- `<p` with `text-body` or `text-lead` → `paragraph`
- `.btn-primary` → `button-primary`
- `.btn-outline` → `button-outline`
- `.btn-ghost`, `.btn-link` → `button-link`
- `<img` or `data-cms-image` → `image`
- `<svg` or `.icon` → `icon`
- `data-cms-logo` → `logo`
- `.card` → `card`
- `<ul`, `<ol` → `list`
- `data-accordion` or toggle/collapse pattern → `accordion`
- `<form` → `form`
- `<input` → `input`
- `.badge`, `.chip`, `.tag` → `badge`
- `.avatar` → `avatar`
- `<video`, `<iframe` → `video`
- Grid detection: count columns in flex/grid → `grid-{N}`

## Step 1 — Load Data

Read in parallel:
1. `{sections_map}` — sections from Figma
2. `app/src/companies-components-scope/{base_company}/templates.json` — all base templates
3. If `mode=add`: `app/src/companies-components-scope/{company}/templates.json` — existing company templates

## Step 2 — Deduplicate (add mode only)

If `mode=add`:
- For each section in sections-map, check if `{company}/templates.json` already has a template with matching `category` (type)
- If exact type+variant exists → skip (mark as `existing`)
- If type exists but different variant → keep (will be added as new variant)

Write `{output_dir}/new-sections.json` — filtered list of sections to process.

## Step 3 — Score Each Section

For each section to process:

### 3.1 Filter candidates by type

From `{base_company}/templates.json`, filter templates where `category === section.type`.

If section.type is not in the 26 known types → no candidates → `create_new_type`.

### 3.2 Parse candidate .tpl files

For each candidate template:
```bash
# Read the .tpl file
cat app/src/companies-components-scope/{base_company}/{template.template}
```

Extract elements using the rules above → `candidate_elements[]`.

### 3.3 Calculate Jaccard similarity

```
intersection = |figma_elements ∩ candidate_elements|
union = |figma_elements ∪ candidate_elements|
element_score = intersection / union
```

### 3.4 Layout scoring (bonus)

Compare layout signals:
- Figma section has image + text side by side → look for `flex-row` / `grid-cols-2` in .tpl → +0.1 bonus
- Figma has card grid → look for card grid pattern → +0.1 bonus
- Column count match → +0.05 bonus

### 3.5 Final score

```
score = element_score + layout_bonus
```

Clamp to [0, 1].

## Step 4 — Decision

For each section:

| Condition | Action |
|---|---|
| Best score ≥ threshold (0.6) | `match` — clone and adapt the best-scoring .tpl |
| Best score < threshold AND type is one of 26 | `create` — create new .tpl from scratch for this known type |
| Type is NOT one of 26 known types | `create_new_type` — create new type + new .tpl |

For `match`: record `source_tpl` path and `adaptations_needed`:
- Elements in Figma but not in .tpl → "add {element}"
- Elements in .tpl but not in Figma → "remove {element}" (suggestion only)
- Section overrides differ from global → "section override {token}"

## Step 5 — Generate Variant Names

For each section, determine the variant name:
- If `match` → use the source .tpl's variant as base, add suffix if adapted (e.g. `centered-with-image`)
- If `create` → generate from elements: `simple`, `with-image`, `split-image`, `centered`, etc.
- If same type appears multiple times → first = `default`, second = `alternative`, third = `v3`

## Step 6 — Write Output

### matched-sections.json

```json
[
  {
    "figma_section": "hero",
    "figma_name": "Hero Section",
    "type": "hero",
    "variant": "centered",
    "action": "match",
    "source_tpl": "hero/centered/index.tpl",
    "score": 0.82,
    "adaptations_needed": ["add image-right layout", "section override h1-font-size"],
    "elements": ["heading", "subheading", "button-primary", "button-outline", "image"],
    "section_overrides": {
      "1440": { "h1-font-size": "80px" },
      "768": { "h1-font-size": "56px" },
      "375": { "h1-font-size": "36px" }
    },
    "order": 0
  },
  {
    "figma_section": "partners",
    "figma_name": "Partners Logos",
    "type": "partners",
    "variant": "default",
    "action": "create_new_type",
    "source_tpl": null,
    "similar_to": "cards/grid/index.tpl",
    "score": 0.45,
    "elements": ["heading", "logo-grid"],
    "section_overrides": {},
    "order": 5
  }
]
```

Update `status.json` → phase 3a completed.

## Important Constraints

- **Read-only for base company** — never modify minimal's templates
- **Deterministic** — same input → same output (no randomness in scoring)
- **Threshold is tunable** — 0.6 default, can be overridden
- **Log reasoning** — for each section, briefly explain why the match was chosen or why create was decided
