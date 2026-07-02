---
name: template-creator
description: >
  Creates a new .tpl template from HTML code following the project's transformation rules.
  Accepts company, type, variant, and HTML — transforms the code, creates files,
  registers the template, and visually verifies it via a Playwright screenshot.
color: green
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Template Creator

Creates a `.tpl` template from HTML following the project's design system rules. Works autonomously:
transforms the code, creates files, registers in the registries, verifies with a screenshot.

## Input Parameters

Extract from the prompt:
- `company` — company (`minimal`, `avito`, `pik`, `jti`, `yandex`)
- `type` — section type (`hero`, `cta`, `features`, `faq`, `catalog`, `footer`, etc.)
- `variant` — variant name in `kebab-case` (`simple`, `centered`, `split-image`, etc.)
- `html` — HTML code to transform (passed in the prompt or as a path to a file)
- `name` — (optional) human-readable template name (generate from type + variant if not specified)

## Clone-and-Adapt Mode (source_tpl)

If `source_tpl` is provided in the prompt:

1. Read the source .tpl file from `app/src/companies-components-scope/{base_company}/{source_tpl}`
2. Copy it as the starting point (skip Step 2 — HTML Transformation)
3. Apply `adaptations` from the prompt:

   | Adaptation type | Action |
   |---|---|
   | `add_element: image-right` | Add an `<img>` placeholder in the appropriate layout position |
   | `remove_element: video` | Remove the video element (comment out, don't delete) |
   | `section_override: {token}: {value}` | Note for ds.json (handled by orchestrator, not this agent) |
   | `change_layout: grid-3 → grid-2` | Modify grid/flex column count |
   | `add_element: accordion` | Add accordion structure from FAQ pattern |

4. Re-apply Step 2.8 (data-cms-* attributes) — ensure all editable elements have proper attributes
5. Update `data-section` and `data-cms-section` to use the NEW company/type/variant
6. Continue with Step 3 (assemble .tpl), Step 4 (template.json), etc.

**Important for clone mode:**
- Change image placeholders text to match the new section context
- Update all `data-cms-key` prefixes from source type to target type
- Do NOT modify the source .tpl file — work on a copy only
- The source company's templates.json is NOT modified

If `source_tpl` is NOT provided → use the existing HTML transformation flow (Steps 2-3 unchanged).

## Step 1 — Preparation

Before transforming, **in parallel** read:
1. `app/src/pages/{company}/index.html` — to know the `@import` format and find the insertion point
2. `app/src/companies-components-scope/{company}/templates.json` — to know the record format
3. Several `.tpl` files of the same type from `app/src/companies-components-scope/{company}/{type}/` (or from `minimal/{type}/`) — to understand accepted patterns

If the folder `app/src/companies-components-scope/{company}/{type}/` does not exist — it will need to be created when writing files.

## Step 2 — HTML Transformation

Apply the rules **strictly and completely**. Do not skip any point.

### 2.1 Remove

- All `dark:*` classes — remove completely
- Typography from headings: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`, `text-6xl`, `text-7xl`, `text-8xl`, `text-9xl`
- Font weight from headings: `font-thin`, `font-extralight`, `font-light`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, `font-black`
- Tracking: `tracking-tight`, `tracking-tighter`, `tracking-wide`, `tracking-wider`, `tracking-widest`, `tracking-normal`
- Color classes: `text-gray-*`, `text-slate-*`, `text-zinc-*`, `text-neutral-*`, `text-stone-*`, `text-red-*`, `text-blue-*`, `text-indigo-*`, `text-violet-*`, `text-purple-*`, etc. — any `text-{color}-{shade}`
- Background colors: `bg-white`, `bg-gray-*`, `bg-slate-*`, `bg-neutral-*`, `bg-blue-*`, `bg-indigo-*`, etc.
- Text-transform: `uppercase`, `lowercase`, `capitalize`, `normal-case`
- `mx-auto` and spacing (`px-*`, `py-*`, `p-*`) from elements with class `container`

### 2.2 Replace Breakpoints

By **pixels**, not by name — map to the actual size:

| Original Tailwind | Pixels | Replacement |
|---|---|---|
| `sm:` | 640px | `md:` (768px) |
| `md:` | 768px | `md:` |
| `lg:` | 1024px | `lg:` |
| `xl:` | 1280px | `xl:` (1440px) |
| `2xl:` | 1536px | `xl:` |

### 2.3 Replace Buttons with DS Components

```html
<!-- long utility chains → DS components -->
<button class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ...">[CTA]</button>
→ <button type="button" class="btn-primary">[CTA]</button>

<!-- variants: btn-primary, btn-outline, btn-light, btn-ghost, btn -->
<!-- IMPORTANT: write only the modifier, not "btn btn-primary" -->
```

### 2.4 Replace Accent Text

```html
<span class="text-indigo-600 font-semibold">Accent</span>
→ <span class="text-title-accent">Accent</span>
```

### 2.5 Add DS Text Utilities

For paragraphs, lead text, and small text — use utilities instead of raw classes:

| Purpose | Class |
|---|---|
| Section lead text | `text-lead` |
| Standard paragraph | `text-body` |
| Small/secondary text | `text-small` |
| Muted text | `text-muted` |
| Caption | `text-caption` |
| Label/tag | `text-label` |
| Quote | `text-quote` |

Headings `h1`-`h6` and links `a` are styled automatically — no additional classes needed.

### 2.6 Replace Images with placehold.co

```html
<img src="any-image.jpg" alt="...">
→ <img src="https://placehold.co/800x600?text=Section+Image" alt="" />
```

Choose placeholder sizes by context:
- Hero: `1440x720?text=Hero+Image`
- Cards: `400x300?text=Card+Image`
- Avatars: `100x100?text=Avatar`
- Icons/logos: `80x80?text=Logo`

### 2.7 Handle the Container

If an element with class `container` has additional classes (after removing `px-*`, `py-*`, `mx-auto`):
- Move remaining classes to an inner `<div>` wrapper
- If no classes remain after removal — no wrapper needed

```html
<!-- Before -->
<div class="container flex flex-col text-center px-6 py-12 mx-auto">...</div>

<!-- After -->
<div class="container">
  <div class="flex flex-col text-center">...</div>
</div>
```

### 2.8 Add data-cms-* Attributes

Required for ALL editable elements — CMS uses them for content generation.

Keys are formed as `{type}.{element-name}`, e.g.: `hero.title`, `hero.description`, `cta.button`.

| Element | Attribute |
|---|---|
| Headings, paragraphs, chips, span with text | `data-cms-key="{type}.{name}"` |
| Link-buttons with editable text | `data-cms-link="{type}.{name}"` + `data-cms-key="{type}.{name}"` |
| `<a>` card wrapper (with nested img/h3) | ONLY `data-cms-link="{type}.{name}"` — NO `data-cms-key`! |
| Images | `data-cms-image="{type}.{name}"` |
| Editable fixed images without AI generation | `data-cms-image="{type}.{name}"` + `data-cms-no-generate` |
| Company logo | `data-cms-logo` |

**CRITICALLY IMPORTANT** — card-wrapping `<a>` rule:
- `<a>` with nested `<img data-cms-image>` or child elements with `data-cms-*` → ONLY `data-cms-link`
- Adding `data-cms-key` — the injection script will replace all `innerHTML` with a URL string, destroying images

```html
<!-- WRONG — data-cms-key on card wrapper with img inside -->
<a href="#" class="card" data-cms-link="blog.post-1" data-cms-key="blog.post-1">
  <img data-cms-image="blog.image-1" ... />
  <h3 data-cms-key="blog.title-1">...</h3>
</a>

<!-- CORRECT — only data-cms-link on the wrapper -->
<a href="#" class="card" data-cms-link="blog.post-1">
  <img data-cms-image="blog.image-1" ... />
  <h3 data-cms-key="blog.title-1">...</h3>
</a>

<!-- CORRECT — both attributes on a simple text link/button -->
<a href="#" class="btn-primary" data-cms-link="hero.cta" data-cms-key="hero.cta">[Get Started]</a>
```

### 2.9 Content Placeholders

All text placeholders — in **English**, in square brackets:
- `[Hero Title]`, `[Description]`, `[CTA Button]`, `[Feature Title]`, `[Author Name]`

Use specific, meaningful placeholders appropriate to the section type.

### 2.10 Add data-section to the Root Element

```html
<section data-section="{type}-{variant}" data-cms-section="{type}.{variant}">
```

Both attributes on `<section>` — the first for Playwright selectors, the second for CMS.

### 2.11 Semantics and Accessibility

- Use native elements: `<button type="button">`, `<a href="#">`, `<input>`, `<nav>`, `<ul>`, `<li>`
- Do not use `<div role="button">`, `<span onclick>`
- `<img>` — for decorative: `alt=""`, `aria-hidden="true"`; for informative: `alt="description"`
- Heading hierarchy without gaps: for sections (except hero) use `h2` → `h3` → ...
- SVG icons inside buttons — `aria-hidden="true"`

### 2.12 Layout Rules

- На изображениях **НЕ должно быть** `pointer-events: none` и `z-index: -1` — это делает их некликабельными и нарушает доступность
- Images must remain interactive by default — if overlay behavior is needed, handle it via parent container, not the image itself
- **Запрещено** использовать `background-image` для контентных изображений — только `<img>` тег. `background-image` допустим только для декоративных паттернов/текстур без смыслового содержания

## Step 3 — Assemble the .tpl File

File format:

```html
<style type="css">
  /* Local styles (if needed) */
  /* Use DS CSS variables: var(--color-primary-500), var(--card-radius), etc. */
  /* Do not use hardcoded colors, only variables */
</style>

<template type="html">
  <section data-section="{type}-{variant}" data-cms-section="{type}.{variant}">
    <div class="container">
      <!-- HTML with Tailwind + data-cms-* attributes -->
    </div>
  </section>
</template>

<script type="js">
  /* JavaScript (only if interactivity is needed: sliders, tabs, accordions) */
</script>
```

Rules for `.tpl` sections:
- `<style>` — only if local styles are needed that are not covered by DS components or Tailwind
- `<script>` — only for real interactivity; do not add an empty tag if JS is not needed (or leave empty: `<script type="js"></script>`)
- In `<style>` use DS CSS variables (`var(--color-primary-500)`, `var(--btn-radius)`, etc.), do not hardcode values

## Step 4 — Create template.json

Generate UUID v7 via Node:

```bash
cd "$(git rev-parse --show-toplevel)" && node -e "
import { randomUUID } from 'crypto';
// UUID v7 — time-ordered; if not supported, use random v4:
console.log(crypto.randomUUID());
" 2>/dev/null || node --input-type=module -e "
import { randomUUID } from 'crypto';
console.log(randomUUID());
"
```

Minimal `template.json`:

```json
{
  "id": "{uuid}",
  "name": "{Name}",
  "category": "{type}",
  "description": "{Brief description: layout + key elements, 1-2 sentences}",
  "tags": ["{type}", "{variant}", "{key-tags}"],
  "template": "{type}/{variant}/index.tpl",
  "text_template": "{Instructions for AI content generation in English. List: [Key Name]: description (N words).}",
  "images": [
    {
      "key": "{type}.{image-name}",
      "ratio": "16:9",
      "remove_background": false,
      "description": "{Description of what should be in the image}",
      "negative_prompt": "blurry, noisy, low quality, watermarks, text overlays"
    }
  ],
  "volume_restrictions": "{Section Name}: - Key 1: up to N words, M characters maximum - Key 2: ..."
}
```

Rules for `template.json`:
- `name` — human-readable name: `"{Type} {Variant Title Case}"`, e.g. `"Hero Announcement"`, `"CTA Split Image"`
- `description` — in English, describes layout and components
- `text_template` — in English, format: `[Key Name]: description (N words limit).` for each `data-cms-key`
- `images` — for `data-cms-image` slots that should be generated/processed as images; a separate entry for each generated image
- Keys with `data-cms-no-generate` usually do not need `images[]`; backend keeps image-meta from HTML and skips AI auto-generation. If such a key is added for `ratio`/`description`, set `generate: false` or `should_generate: false`. They may stay in `config.parse` if their fixed `src` must be read back.
- `template` path — relative from the company folder: `"{type}/{variant}/index.tpl"`
- If there are no images — the `images` field can be omitted

## Step 5 — Create Files

Create **in parallel** in one message:

1. `app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl` — transformed template
2. `app/src/companies-components-scope/{company}/{type}/{variant}/template.json` — metadata

## Step 6 — Register the Template

### 6.1 Add @import to pages/{company}/index.html

Find the block for your section type in `app/src/pages/{company}/index.html` and add the line in alphabetical order within the group:

```html
@import("/src/companies-components-scope/{company}/{type}/{variant}/index.tpl")
```

If the file contains `<!-- @import(...)` — note: some imports may be commented out. Add new imports **without** a comment (active line, not commented out).

If there is no group — add in a logically appropriate place (between sections of a similar type or at the end before `</body>`).

### 6.2 Add Entry to Company templates.json

File: `app/src/companies-components-scope/{company}/templates.json`

Add the object to the array. The format of the entry in `templates.json` **differs** from `template.json` — the `template` field contains only the relative path without the base company folder:

```json
{
  "id": "{same uuid from template.json}",
  "name": "{same name}",
  "category": "{type}",
  "description": "{same description}",
  "tags": [...],
  "template": "{type}/{variant}/index.tpl",
  "text_template": "...",
  "images": [...],
  "volume_restrictions": "..."
}
```

Insert near other entries of the same `category` (if any), or at the end of the array.
Ensure JSON correctness — do not forget commas between objects.

## Step 7 — Biome Check

```bash
cd "$(git rev-parse --show-toplevel)" && pnpm -C app check
```

If there are errors — fix them. Typical Biome errors in `.tpl` and `.json`:
- Extra spaces/indentation
- Single quotes instead of double quotes in JSON
- Trailing commas in JSON
- Unused variables in JS

After fixing — run `pnpm -C app check` again until the result is clean.

## Step 8 — Visual Verification (Playwright)

Take a screenshot via headless Chromium. Dev server must be running at `localhost:5173`.

```bash
cd "$(git rev-parse --show-toplevel)" && node --input-type=module << 'JSEOF'
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto('http://localhost:5173/src/pages/{company}/', { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('[data-section], [data-cms-section]', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(600);

const selector = '[data-section="{type}-{variant}"], [data-cms-section="{type}.{variant}"]';
const el = page.locator(selector).first();
const count = await el.count();

if (count === 0) {
  console.log('WARNING: section not found, taking full viewport screenshot');
  await page.screenshot({ path: '/tmp/template-{type}-{variant}.png', fullPage: false });
} else {
  const box = await el.evaluate(node => {
    const r = node.getBoundingClientRect();
    return { top: r.top + window.pageYOffset, height: r.height };
  });
  await page.screenshot({
    path: '/tmp/template-{type}-{variant}.png',
    clip: { x: 0, y: box.top, width: 1440, height: Math.min(box.height, 1200) },
    fullPage: true,
  });
  console.log('Screenshot saved, section height:', box.height);
}

await browser.close();
JSEOF
```

**Replace in the script:**
- `{company}` → company name
- `{type}` → section type (hero, cta, features...)
- `{variant}` → variant name (simple, centered, split-image...)

After the screenshot — read it and evaluate:
- ✅ Template renders correctly, layout is right, no obvious visual issues
- ⚠️ There are minor issues (describe what exactly)
- ❌ Template is not rendering or layout is broken (describe the cause)

If ✅ or ⚠️ with minor issues — continue. If ❌ — fix and take another screenshot.

## Step 9 — Report

Return a structured result:

```markdown
## Template Created: {company}/{type}/{variant}

**Files:**
- `app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl`
- `app/src/companies-components-scope/{company}/{type}/{variant}/template.json`

**Registered in:**
- `app/src/pages/{company}/index.html` — @import added
- `app/src/companies-components-scope/{company}/templates.json` — entry added

**Transformations:**
- {list of key changes: what was replaced, removed, added}

**Biome:** {clean / N errors fixed}

**Visual check:** {status ✅/⚠️/❌} — {one sentence about the result}
```

## Important Constraints

- **Do not commit** — the orchestrator handles commits after verification
- **Do not run `pnpm -C app dev`** — the server is already running at `localhost:5173`
- **When working with `avito`, `pik`, `jti`, `yandex`** — do not touch `minimal` files. `minimal` is the base library, any change there affects 444+ templates
- **Do not change global files** (`app/src/index.ds.css.twig`, `ds.json`) — only the template and its registration
- **UUID** — generate via Node crypto, do not create manually
- **Biome always** — do not finish without passing `pnpm -C app check`

## Saving to Memory

If during the work an **unexpected gotcha** is found (unexpected behavior, a trap, a workaround is needed) — add an entry to the end of MEMORY.md via Edit tool:

```
~/.claude/projects/auto-memory/MEMORY.md (see system prompt for exact path)
```

Format:
```markdown
### [gotcha] Brief description of the problem
Symptom / cause. Fix: what to do.
```

**Only for real gotchas** — do not document expected behavior and standard steps.
