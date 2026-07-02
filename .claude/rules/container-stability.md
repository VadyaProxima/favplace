---
paths: src/**/*.twig, src/**/*.tpl, src/**/ds.json
---

# Container and Layout Structure Stability

## Main Rule

**Never change `.container` padding/spacing without an explicit request.**

`.container` sets the horizontal and vertical rhythm for the ENTIRE site. Its padding is an architectural decision and must not be changed accidentally.

`max-w-*` on content blocks inside sections — **may be changed** upon an explicit user request.

## What Is Forbidden Without an Explicit Request

### Padding of .container and footer-container classes
- `padding-inline` / `padding-block` on the `.container` class itself
- CSS variables `--container-padding-inline`, `--container-padding-block`
- Values `container-padding-inline` / `container-padding-block` in `ds.json`

### Section padding/margin
- `padding-inline` / `padding-block` on `<section>` / `<footer>` / `<header>`
- CSS rules `[data-cms-section="..."] { padding-inline: 0; }` — may be intentional (full-bleed layout)

### Grid and flex structures
- `grid-cols-*` number of columns
- `col-span-*` on grid items
- `items-*`, `justify-*` on the container

### Padding/margin spacing
- `py-*`, `pt-*`, `pb-*` on the root section element
- `mt-*`, `mb-*` between large blocks

## What CAN Be Changed Without a Request

- Content styles (colors, shadows, gradients)
- Icons and their classes (`icon-box-*`)
- CSS variables in the `<style>` block
- DS component classes (`btn-*`, `card-*`, `chip-*`)
- HTML semantics (`h4` → `h3` when hierarchy is wrong)
- `data-cms-*` attributes

## What CAN Be Changed With an Explicit Request

- `max-w-*` on content blocks inside sections (`<div class="max-w-3xl mx-auto">`)
- `items-*`, `justify-*` on flex/grid inside a section

## Examples

```html
<!-- ✅ max-w can be changed on explicit user request -->
<div class="max-w-3xl mx-auto">  <!-- before -->
<div class="max-w-4xl mx-auto">  <!-- ok on explicit request -->

<!-- ❌ Cannot touch container class padding -->
--container-padding-inline: 138px  <!-- do not change! -->
--container-padding-block: 115px   <!-- do not change! -->

<!-- ❌ Cannot remove intentional full-bleed padding -->
[data-cms-section="hero.bg"] { padding-inline: 0; }  <!-- do not remove! -->

<!-- ✅ Content styles can be changed -->
.overlay { background: rgba(0,0,0,0.4); }  <!-- → -->
.overlay { background: rgba(0,0,0,0.6); }  <!-- ok -->
```

## Container CSS Variables — MUST NOT Be Changed

The following variables are fundamental DS settings; they set spacing for ALL site sections:

```
--container-padding-inline      (sets horizontal content padding)
--container-padding-block       (vertical padding)
--footer-container-padding-block-end
```

**Forbidden without an explicit request:**
- Changing `container-padding-inline` / `container-padding-block` values in `ds.json`
- Removing/replacing `getResponsiveMediaQuery("container-padding-inline", ...)` in twig
- Changing `--container-padding-inline` in generated CSS directly

**If you see `--container-padding-inline: unset` in generated CSS** — this is a BUG (empty `.container {}` block in the company twig), not an intentional setting. See `.claude/rules/twig-sync.md` for diagnostics.

## Different Values Across Companies — This Is Normal

Each company has ITS OWN container values in `style/ds.json`. They are intentionally different:

| Company | container-padding-inline (desktop) | container-padding-block (desktop) |
|---------|:---:|:---:|
| minimal  | 138px | 115px |
| avito    | (rubber calc) | (rubber calc) |
| pik      | (own value) | (own value) |

**DO NOT normalize values across companies to a single standard.** avito may have 80px, minimal 138px — these are architectural decisions made by each company's designers.

The "do not touch" rule applies to ALL companies, not just minimal.

## Difference: Content Blocks vs DS Container

| Element | Rule |
|---------|------|
| `.container` class padding — `--container-padding-inline/block` | ❌ Never touch |
| `footer-container` class padding | ❌ Never touch |
| `padding-inline: 0` on `[data-cms-section]` | ❌ Do not remove (intentional full-bleed) |
| `max-w-*` on a `<div>` content block inside a section | ✅ Allowed on explicit request |
| `py-*` on the root `<section>` | ❌ Only on explicit request |

## Where These Recommendations Come From

QA agents (type-analyzer) may recommend widening `max-w-*` if content appears "too narrow". Such recommendations **must NOT be applied** without explicit user agreement — these are layout decisions made deliberately.
