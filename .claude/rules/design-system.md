---
paths: src/**/*.twig, src/**/ds.json, src/**/style/**
---

# Design System

## Architecture

```
src/index.ds.css.twig                              — master design system template (CSS + utilities)
src/companies-components-scope/{company}/style/ds.json — company variables (colors, fonts, radii)
src/styles/mixins/responsive.css                   — @mixin responsive
```

The `ds-css.js` plugin renders `index.ds.css.twig` with data from `ds.json` → `generated-css-from-twig/{company}-ds.css`.

### Layers

1. **`index.ds.css.twig`** — default values for all variables, all component `@utility` definitions
2. **`style/ds.json`** — variable overrides for a specific company. The final layer

Priority: `ds.json` > Twig defaults.

### ds.json Structure

```json
{
  "template_assets_host": "https://...",
  "fonts": { "faces": [...] },
  "color-primary-500": "#663cf6",
  "btn-radius": "1.375rem",
  "sections": {
    "hero": { "h1-text-align": "center" },
    "footer": { "background": "#111" }
  },
  "responsive": {
    "md": { "h1-font-size": "3rem" },
    "xl": { "h1-font-size": "4.5rem" }
  }
}
```

**When adding a new token to `ds.json` — make sure it is used with `|default(...)` in `index.ds.css.twig`, otherwise it will break for companies that don't have this key:**

```twig
--btn-radius: {{ ds["btn-radius"]|default("0.5rem") }};
```

### Overriding CSS Variables at Section Type Level

**Do not hardcode CSS variables in a template's `<style>` tag** — this breaks design system extensibility.

**Correct approach:** add variable support to the section type block in `index.ds.css.twig`, then set the value via `sections` in the company's `ds.json`.

Example: h1 in hero should be centered for minimal but left-aligned for another company.

1. **`index.ds.css.twig`** — add conditional variable output to the `.hero` block:
```twig
.hero {
  --section-margin-top: {{ ds.sections.hero["section-margin-top"]|default("0") }};
  {% if ds.sections.hero["h1-text-align"] is defined and ds.sections.hero["h1-text-align"] is not null %}
  --h1-text-align: {{ ds.sections.hero["h1-text-align"] }};
  {% endif %}
}
```

2. **`style/ds.json`** for the company — set the value:
```json
"sections": {
  "hero": { "h1-text-align": "center" }
}
```

Companies that don't specify `h1-text-align` in `sections.hero` will use the global value from the root of `ds.json`.

**When this applies:**
- Typography settings (text-align, font-size) within a specific section type
- Component variables (card-radius, card-bg) for a section
- Any CSS variables that need to differ across section types

## Components

### Typography

Text utilities, each fully controlled by variables:

| Utility | Purpose | Key variables |
|---------|---------|---------------------|
| `text-display-xl` | Display XL (72px) — primary hero/promo heading | `--text-display-xl-color, --text-display-xl-font-size, --text-display-xl-line-height` |
| `text-display-l` | Display L (56px) — large section heading | `--text-display-l-color, --text-display-l-font-size, --text-display-l-line-height` |
| `text-h1`...`text-h6` | Headings | `--h*-color, --h*-font-weight, --h*-font-size, --h*-line-height` |
| `text-lead` | Section intro text (Body/L) | `--text-lead-color, --text-lead-font-size, --text-lead-line-height` |
| `text-body` | Standard paragraph (Body/M) | `--body-color, --body-font-size, --body-line-height` |
| `text-small` | Small text (Body/S, 14px) | `--text-small-color, --text-small-font-size` |
| `text-label` | Label/tag (Label/M, 14px Medium) | `--text-label-color, --text-label-text-transform` |
| `text-caption` | Caption (Caption/S, 12px) | `--text-caption-color, --text-caption-font-size` |
| `text-overline` | Eyebrow/badge (12px, Semi-bold, uppercase, ls +6%) | `--text-overline-color, --text-overline-font-size, --text-overline-letter-spacing` |
| `text-muted` | Muted text | `--text-muted-color` |
| `text-quote` | Quote | `--text-quote-color, --text-quote-font-style` |
| `text-price` | Price | `--text-price-color, --text-price-letter-spacing` |
| `text-name` | Author/participant name | `--text-name-color, --text-name-font-weight` |
| `text-nav` | Navigation link | `--text-nav-color, --text-nav-color-hover` |
| `text-link` | Link | `--text-link-color, --text-link-color-hover` |
| `text-title-accent` | Accent text | `--text-title-accent-color` |

Headings `h1`-`h6` and links `a` are automatically styled via `@layer base`.

**The `text-small text-muted` combination** — for secondary text: disclaimers, button sub-labels, notes. `text-small` sets the size (`0.875rem`), `text-muted` guarantees a muted color through its variable. Used together, not separately for this scenario.

### Button

| Utility | Purpose |
|---------|---------|
| `btn` | Base button |
| `btn-primary` | Accent button |
| `btn-light` | Secondary (light) |
| `btn-outline` | Outlined |
| `btn-ghost` | Ghost (transparent) |

Variables: `--btn-bg, --btn-color, --btn-radius, --btn-padding-block, --btn-padding-inline, --btn-font-size, --btn-font-weight, --btn-line-height`.

### Tabs

| Utility | Purpose |
|---------|---------|
| `tabs` | Tab container |
| `tab` | Individual tab |
| `tab-active` | Active tab |
| `tabs-segmented` | Segmented variant (pill tabs) |
| `tabs-outline` | Outline variant (border) |

Variables: `--tab-font-weight, --tab-font-size, --tab-height, --tab-padding-inline, --tab-padding-block, --tab-bg, --tab-color, --tab-border-color, --tab-radius, --tab-shadow, --tab-shadow-hover`.

### Card

| Utility | Purpose |
|---------|---------|
| `card` | Base card |
| `card-elevated` | With shadow |
| `card-filled` | With background |
| `card-ribbon` | Card ribbon/badge |

Variables: `--card-radius, --card-bg, --card-shadow, --card-padding-inline, --card-padding-block, --card-border-width, --card-border-color`.

### Chip

| Utility | Purpose |
|---------|---------|
| `chip` | Base chip |
| `chip-primary` | Accent chip |

Variables: `--chip-bg, --chip-color, --chip-radius, --chip-padding-inline, --chip-padding-block`.

### Accordion

| Utility | Type | Purpose |
|---------|------|---------|
| `accordion` | base | Base accordion |
| `accordion-card` | theme | Card variant |
| `accordion-outline` | theme | Outlined variant |
| `accordion-collapse` | theme | Collapse variant |
| `accordion-trigger` | part | Header (button) |
| `accordion-icon` | part | Icon wrapper |
| `accordion-icon-plus` | part | Plus icon |
| `accordion__icon-arrow` | part | Arrow icon |
| `accordion-content` | part | Content (animated) |
| `accordion-body` | part | Content body |

Themes (`accordion-card`, `accordion-outline`, `accordion-collapse`) **only override variables** of the base `accordion`. No theme sub-utilities.

#### Accordion Markup

The open animation works via `details[open] + .accordion-content` (sibling selector). Therefore `accordion-content` **must** be a sibling element of `<details>`, not nested inside it.

```html
<!-- Correct -->
<div class="accordion-card">
  <details class="group">
    <summary class="accordion-trigger">
      <span>Question</span>
      <span class="accordion-icon" aria-hidden="true">
        <svg class="accordion-icon-plus" ...>...</svg>
      </span>
    </summary>
  </details>
  <div class="accordion-content">
    <div class="accordion-body">
      <p>Answer</p>
    </div>
  </div>
</div>

<!-- Incorrect — accordion-content inside details, animation won't work -->
<details class="accordion-card">
  <summary class="accordion-trigger">...</summary>
  <div class="accordion-content">...</div>
</details>
```

**Required elements:**
- Wrapper `<div class="accordion{-theme}">` — root element
- `<details class="group">` — native disclosure element, `class="group"` is needed for icon styling when open (`.group:where([open]) &`)
- `<summary class="accordion-trigger">` — trigger button
- `<span class="accordion-icon" aria-hidden="true">` — icon wrapper
- SVG with class `accordion-icon-plus` (plus) or `accordion__icon-arrow` (arrow)
- `<div class="accordion-content">` — **sibling** to `<details>`, not nested
- `<div class="accordion-body">` — inner container with padding

Trigger variables: `--accordion-trigger-color, --accordion-trigger-font-weight, --accordion-trigger-font-size, --accordion-trigger-justify`.
Content variables: `--accordion-content-color, --accordion-content-font-size, --accordion-content-line-height`.
Icon variables: `--accordion-icon-size, --accordion-icon-radius, --accordion-icon-bg, --accordion-icon-color, --accordion-icon-bg-open, --accordion-icon-color-open`.
Body variables: `--accordion-body-border-top, --accordion-body-border-color, --accordion-body-padding-top, --accordion-body-margin-start, --accordion-body-border-start`.
General variables: `--accordion-padding-inline, --accordion-padding-block, --accordion-radius, --accordion-bg`.

### Input / Textarea / Label

Variables: `--input-radius, --input-border-color, --input-border-color-focus`, similarly for textarea (`--textarea-*`) and label (`--label-*`).

### Container

Variables: `--container-bg, --container-radius, --container-padding-block, --container-padding-inline, --container-max-width`.

### Section

Variables: `--section-padding-inline, --section-padding-block, --section-margin-top, --section-margin-bottom, --section-bg`.

### Layout

Variables: `--layout-display, --layout-direction, --layout-gap`.

### Image

The `image` utility is applied to `img` via `@layer base`.

### Stepper

Utility `step-indicator`. Variables: `--step-indicator-size, --step-indicator-bg, --step-indicator-color`.

### Icon Box

Decorative icon wrapper. No interactivity (no cursor, hover, focus). Themes mirror button variants.

| Utility | Type | Purpose |
|---------|------|---------|
| `icon-box` | base | Base wrapper (size + padding only) |
| `icon-box-primary` | theme | Accent (primary background, light color) |
| `icon-box-outline` | theme | Outlined |
| `icon-box-light` | theme | Light (light background, primary color) |
| `icon-box-ghost` | theme | Neutral (neutral background) |

Variables: `--icon-box-size, --icon-box-padding, --icon-box-radius, --icon-box-bg, --icon-box-color, --icon-box-border-width, --icon-box-border-style, --icon-box-border-color`.

SVG inside automatically stretches to 100% via `& svg { width: 100%; height: 100% }`.

**Usage rules in templates:**

```html
<!-- ✅ Correct — theme class only -->
<span class="icon-box-light">...</span>
<span class="icon-box-light shrink-0">...</span>       <!-- shrink-0 — when inside flex container -->
<span class="icon-box-light shrink-0 md:mx-4">...</span> <!-- margin for a specific layout -->

<!-- ❌ Incorrect — overrides DS variables -->
<span class="icon-box-light p-0">...</span>           <!-- p-0 removes --icon-box-padding → SVG fills entire box -->
<span class="icon-box-light p-4">...</span>           <!-- p-4 hardcodes padding instead of DS variable -->
<span class="icon-box-light w-12 h-12">...</span>     <!-- w/h override --icon-box-size -->
<span class="icon-box-light rounded-full">...</span>  <!-- rounded-* overrides --icon-box-radius -->
<span class="icon-box-light inline-flex">...</span>   <!-- inline-flex is already set by DS -->
```

Forbidden Tailwind classes on `icon-box-*`: `p-0`, `p-N`, `w-N`, `h-N`, `rounded-*`, `inline-flex`.
All these properties are controlled via DS variables in `ds.json`.

### Slider

| Utility | Type | Purpose |
|---------|------|---------|
| `slider` | base | Slider container |
| `slider-track` | part | Track with slides (horizontal scroll) |
| `slider-slide` | part | Individual slide |
| `slider-nav` | part | Base navigation button |
| `slider-prev` | part | Previous button |
| `slider-next` | part | Next button |
| `slider-dots` | part | Dots container |
| `slider-dot` | part | Navigation dot |
| `slider-cards` | theme | Cards slider |
| `slider-testimonial` | theme | Testimonials slider |

Container variables: `--slider-width, --slider-max-width, --slider-gap, --slider-padding-x, --slider-padding-y`.
Track variables: `--slider-track-gap, --slider-track-scroll-snap, --slider-track-scroll-behavior`.
Slide variables: `--slider-slide-width, --slider-slide-min-width, --slider-slide-flex-shrink, --slider-slide-scroll-snap-align`.
Navigation variables: `--slider-nav-size, --slider-nav-radius, --slider-nav-bg, --slider-nav-color, --slider-nav-border, --slider-nav-shadow, --slider-nav-icon-size, --slider-nav-offset-x, --slider-nav-offset-y`.
Dots variables: `--slider-dot-size, --slider-dot-gap, --slider-dot-radius, --slider-dot-color, --slider-dot-color-active, --slider-dots-margin-top, --slider-dots-justify`.

## Styles

| File | Purpose |
|------|---------|
| `app/src/index.ds.css.twig` | All CSS — components, utilities, variables, base, reset, fonts |
| `app/src/styles/mixins/responsive.css` | `@mixin responsive` for responsive values |
| `app/src/companies-components-scope/{company}/style/ds.json` | Company variables (colors, fonts, radii) |

## Variable Naming

Pattern: `--{component}-{property}`

```
--{component}-color            text color
--{component}-bg               background color
--{component}-font-weight      font weight
--{component}-font-family      font family
--{component}-font-size        font size
--{component}-line-height      line height
--{component}-letter-spacing   letter spacing
--{component}-radius           border radius
--{component}-padding-inline   horizontal padding
--{component}-padding-block    vertical padding
--{component}-shadow           box shadow
--{component}-border-width     border width
--{component}-border-color     border color
```

## Color Palette

### Primary — main brand color
`--color-primary-50` ... `--color-primary-950`

### Neutral — neutral colors
`--color-neutral` (white), `--color-neutral-100` ... `--color-neutral-900`

### Background
`--color-background`

Defaults are defined in `index.ds.css.twig`, overridden in the company's `style/ds.json`.

## Breakpoints

| Token | Value |
|-------|-------|
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1440px |

Mobile-first approach.

## Full Utility List

### Typography
`text-display-xl`, `text-display-l`, `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-h5`, `text-h6`, `text-link`, `text-title-accent`

### Text
`text-lead`, `text-body`, `text-small`, `text-label`, `text-caption`, `text-overline`, `text-muted`, `text-quote`, `text-price`, `text-name`, `text-nav`

### Button
`btn`, `btn-primary`, `btn-outline`, `btn-light`, `btn-ghost`

### Card
`card`, `card-elevated`, `card-filled`, `card-ribbon`

### Container
`container`

### Input / Textarea / Label
`input`, `textarea`, `label`

### Chip
`chip`, `chip-primary`

### Tabs
`tabs`, `tab`, `tab-active`, `tabs-outline`, `tabs-segmented`

### Accordion
`accordion`, `accordion-trigger`, `accordion-icon`, `accordion-icon-plus`, `accordion__icon-arrow`, `accordion-content`, `accordion-body`, `accordion-card`, `accordion-outline`, `accordion-collapse`

### Stepper
`step-indicator`

### Icon Box
`icon-box`, `icon-box-primary`, `icon-box-outline`, `icon-box-light`, `icon-box-ghost`

### Slider
`slider`, `slider-track`, `slider-slide`, `slider-nav`, `slider-prev`, `slider-next`, `slider-dots`, `slider-dot`, `slider-cards`, `slider-testimonial`

### Image
`image`

### Other
`no-container`

## Project Customization

Everything via the company's `style/ds.json`. Do not use inline styles or tailwind for properties covered by variables.

```json
{
  "color-primary-500": "#3758f9",
  "color-neutral-900": "#000000",
  "font-primary": "\"Manrope\", sans-serif",
  "btn-radius": "1.375rem",
  "tab-shadow": "0 0 11px 0 rgba(172, 175, 193, 0.27)"
}
```

The `ds-css.js` plugin compiles `ds.json` + `index.ds.css.twig` → `generated-css-from-twig/{company}-ds.css`.
