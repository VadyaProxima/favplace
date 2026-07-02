---
paths: src/**/*.tpl, src/**/template.json
---

# Block Creation and Transformation Rules

Applies when:
- Porting blocks from third-party design systems (Tailwind UI, Shadcn, UI libraries)
- Creating new blocks from scratch
- Editing existing blocks

## .tpl File Structure

```html
<style type="css">
  /* Local styles (if needed) */
</style>

<template type="html">
  <section data-section="hero-announcement">
    <div class="container">
      <!-- HTML with Tailwind classes + data-cms-* attributes -->
    </div>
  </section>
</template>

<script type="js">
  // JavaScript (if needed)
</script>
```

## data-cms-* Attributes

Required for all editable elements — the CMS uses them for content generation and editing:

| Attribute | Purpose |
|-----------|---------|
| `data-cms-key` | Text field (`hero.title`, `hero.description`) |
| `data-cms-link` | Link button — edits both `href` and text (`cta.link`) |
| `data-cms-image` | Image (`hero.image`) |
| `data-cms-no-generate` | Add to `data-cms-image` when the image must be editable/readable by CMS but excluded from AI generation |
| `data-cms-logo` | Company logo |
| `data-cms-section` | Section type (drag-and-drop and selection overlay) |

**Editable but non-generated images:**
- Use `data-cms-image="<key>"` together with `data-cms-no-generate` when the CMS/backend must see the image slot but AI generation must not create or replace it.
- The element's `src` must be the final fixed URL.
- `template.json.images[]` is not required for this key: backend keeps image-meta from HTML and skips AI auto-generation. If you add the key to `images[]` for metadata, set `generate: false` or `should_generate: false`.
- `config.parse` may still include this image via a selector such as `[data-cms-image='header.logo']` if the parser needs to read the fixed `src`.
- Do not add `data-cms-logo` unless you want backend to replace `src` from `DesignPreset.logoFile`.

**`data-cms-link` vs `data-cms-key` on links:**
- `data-cms-link` — controls the link's `href` (URL). **Always required** alongside `data-cms-key` for links with editable text.
- `data-cms-key` — needed for text content: headings, paragraphs, chips, **and link text**.
- On `<a>` elements with editable text, use **both attributes**: `data-cms-link` (for href) + `data-cms-key` (for text).

**CRITICAL — card wrapper links:**
- `<a>` with a nested `<img>` or child elements with `data-cms-*` → **ONLY `data-cms-link`**, no `data-cms-key`!
- `data-cms-key` on such an `<a>` will cause the injection script to replace the entire `innerHTML` with text/URL, destroying images
- Simple text link `<a>[Button]</a>` (text is the only content) → both attributes

```html
<!-- ❌ Bad — data-cms-key on a card wrapper will destroy the image -->
<a href="#" class="card" data-cms-link="blog.post-link-1" data-cms-key="blog.post-link-1">
  <img data-cms-image="blog.post-image-1" ... />
  <h3 data-cms-key="blog.post-title-1">...</h3>
</a>

<!-- ✅ Good — only data-cms-link on the wrapper -->
<a href="#" class="card" data-cms-link="blog.post-link-1">
  <img data-cms-image="blog.post-image-1" ... />
  <h3 data-cms-key="blog.post-title-1">...</h3>
</a>

<!-- ✅ Good — both attributes on a simple text link -->
<a href="#" class="btn-primary" data-cms-link="hero.cta" data-cms-key="hero.cta">[Get Started]</a>
```

```html
<section data-section="hero-simple">
  <div class="container">
    <span class="chip" data-cms-key="hero.announcement">[Announcement]</span>
    <h1 data-cms-key="hero.title">[Hero Title]</h1>
    <p class="text-lead" data-cms-key="hero.description">[Description]</p>
    <a href="#" class="btn-primary" data-cms-link="hero.cta_link" data-cms-key="hero.cta_link">[CTA]</a>
    <img data-cms-image="hero.image" src="https://placehold.co/1200x600" alt="" />
  </div>
</section>
```

**Placeholders** (`[Hero Title]`, `[Description]`) — in **English**.

## Using Design System Components

When creating any block — use design system components instead of manual styling.

### UI components → classes
| Element | Class |
|---------|-------|
| Button (primary) | `btn-primary` |
| Button (outlined) | `btn-outline` |
| Button (neutral) | `btn` |
| Button (light) | `btn-light` |
| Card | `card` |
| Chip/tag | `chip` |
| Tab | `tab` |
| Accordion | `accordion` / `accordion-card` / `accordion-outline` |
| Text input | `<input>` (styled automatically) |

### Text utilities → classes
| Text | Class |
|------|-------|
| Section intro text | `text-lead` |
| Paragraph | `text-body` |
| Small text | `text-small` |
| Label/tag | `text-label` |
| Caption | `text-caption` |
| Muted | `text-muted` |
| Quote | `text-quote` |
| Price | `text-price` |
| Name | `text-name` |
| Navigation | `text-nav` |
| Accent | `text-title-accent` |

Headings (`h1`-`h6`) and links (`a`) are styled automatically via `@layer base` — no additional classes needed.

### Styling via CSS Variables

Visual component properties (color, size, spacing, shadow) are controlled by CSS variables. Do not duplicate them via inline styles or tailwind classes:

```html
<!-- Bad -->
<a href="#" class="tab text-lg font-semibold rounded-xl shadow-md">Text</a>

<!-- Good -->
<a href="#" class="tab">Text</a>
```

Customization — via `config.css` (see `design-system.md` → Project Customization).

## What to Remove

### Dark mode
- All `dark:*` classes → we don't have dark mode

### Decorative classes on `<section>`
- `bg-white`, `bg-gray-900` and similar → handled by components

### Typography on headings
- `text-2xl`, `text-3xl`, `text-4xl`
- `font-semibold`, `font-bold`
- `tracking-tight`, `tracking-wide`

→ Typography is set globally via CSS variables

### Color classes
- `text-gray-*`, `text-blue-*`, `bg-blue-*` etc.

→ Replace with CSS variables or our components

### Text-transform classes
- `uppercase`, `lowercase`, `capitalize`, `normal-case`

→ Remove all classes that set text-transform. Text case must not be controlled via utilities in templates.

### Container with extra classes

If an element has the `container` class and also has other classes:

1. Remove all spacing (`px-*`, `py-*`, `p-*`) and `mx-auto` from the container
2. Move remaining classes (layout, alignment, etc.) into an inner `<div>` wrapper
3. Wrap all container content in that `<div>`

```html
<!-- Before -->
<div class="container flex flex-col px-6 py-12 mx-auto text-center">
  <h2>Heading</h2>
  <p>Description</p>
</div>

<!-- After -->
<div class="container">
  <div class="flex flex-col text-center">
    <h2>Heading</h2>
    <p>Description</p>
  </div>
</div>
```

If after removing spacing and `mx-auto` no other classes remain — no wrapper needed:

```html
<!-- Before -->
<div class="container px-6 py-10 mx-auto">
  <h2>Heading</h2>
</div>

<!-- After -->
<div class="container">
  <h2>Heading</h2>
</div>
```

## What to Replace

### Breakpoints

Replace by **pixels**, not by name:

| Tailwind | Pixels | Ours |
|----------|--------|------|
| sm | 640 | md (768) |
| md | 768 | md (768) |
| lg | 1024 | lg (1024) |
| xl | 1280 | **xl (1440)** |
| 2xl | 1536 | **xl (1440)** |

**Examples:**
```html
<!-- Before -->
<div class="sm:flex xl:grid 2xl:grid-cols-3">

<!-- After -->
<div class="md:flex xl:grid xl:grid-cols-3">
```

### Buttons

Replace long utility chains with components:

```html
<!-- Before -->
<a href="#" class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
  Button
</a>

<!-- After -->
<a href="#" class="btn-primary">Button</a>
```

**Variants:**
- `btn-primary` — primary button (accent)
- `btn-outline` — outlined button
- `btn` — neutral button

**Important:** write only the modifier (`btn-primary`), not `btn btn-primary`.

### Accent text

```html
<!-- Before -->
<span class="text-indigo-600 font-semibold">Accent</span>

<!-- After -->
<span class="text-title-accent">Accent</span>
```

### Images

```html
<!-- Before -->
<img src="example.jpg" alt="...">

<!-- After -->
<img src="https://placehold.co/600x400?text=Hero+Image" alt="...">
```

Format: `https://placehold.co/{W}x{H}?text={Label}`

**Examples:**
- `600x400?text=Hero+Image`
- `100x100?text=Avatar`
- `1200x600?text=Banner`

## What to Keep

### Layout classes
- `flex`, `grid`, `gap-*`, `space-x-*`, `space-y-*`
- `max-w-*`, `mx-auto`, `container`
- `items-*`, `justify-*`, `self-*`

### Spacing
- `mt-*`, `mb-*`, `ml-*`, `mr-*`, `mx-*`, `my-*`
- `pt-*`, `pb-*`, `pl-*`, `pr-*`, `px-*`, `py-*`

### Alignment
- `text-left`, `text-center`, `text-right`
- `items-center`, `items-start`, `items-end`
- `justify-center`, `justify-between`, `justify-around`

### Sizing
- `w-*`, `h-*`, `min-w-*`, `max-w-*`, `min-h-*`, `max-h-*`

## Quality Checklist

After creating or transforming a block, verify:

- [ ] `.tpl` format (style, template, script)
- [ ] `data-section` on root element (`data-section="hero-simple"`)
- [ ] `data-cms-*` attributes on all editable elements
- [ ] Placeholders in English (`[Hero Title]`, `[Description]`)
- [ ] Design system components used (btn-primary, card, tab, accordion, etc.)
- [ ] Text utilities used (text-lead, text-body, text-caption, etc.)
- [ ] Component styling via CSS variables, not inline/tailwind
- [ ] Breakpoints corrected (xl → 1440, 2xl → 1440)
- [ ] All `dark:*` classes removed
- [ ] Typography classes removed from headings (text-2xl, font-bold)
- [ ] Color classes removed (text-gray-*, bg-blue-*)
- [ ] text-transform classes removed (uppercase, lowercase, capitalize)
- [ ] Container without spacing and mx-auto, extra classes moved to wrapper
- [ ] Images via placehold.co
- [ ] Accent text via `text-title-accent`
- [ ] Layout classes preserved
- [ ] Spacing preserved
- [ ] Accessibility maintained (semantics, aria-labels)
- [ ] No `pointer-events: none` or `z-index: -1` on `<img>` elements
- [ ] No `background-image` for content images — only `<img>` tag; `background-image` only for decorative patterns/textures
- [ ] No Biome errors (`pnpm -C app check`)
- [ ] `<a>` card wrappers have ONLY `data-cms-link` (not `data-cms-key`)
- [ ] All card slots with images have `<img data-cms-image>` (not just `<a>` without img inside)
- [ ] Images with `data-cms-no-generate` are absent from `template.json.images[]` or listed with `generate: false` / `should_generate: false`
- [ ] max-width of inner containers ≥ 55% of content width (not too narrow; with 138px padding on 1440px = 1164px available width → min ~640px)
- [ ] Visual check via `/test-company {company}` — cards show images, not URL strings
