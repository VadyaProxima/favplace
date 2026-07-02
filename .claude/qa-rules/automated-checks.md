# Automated Checks

Programmatic rules executed by `scan-group.mjs` during the SCAN phase.
Each check runs against rendered HTML + computed styles in Playwright.

---

## Rubber Validation

Rubber companies (minimal, avito, pik) use viewport-relative `calc()` sizing.
Hardcoded px/rem in `<style>` blocks or Tailwind spacing in HTML is an error.

**Global exceptions for ALL RUB-* checks:**
- Values inside `calc()`, `var()`, `max()`, `min()`, `clamp()`
- `border-width` <= 2px, `border-radius`, `box-shadow`
- `opacity`, `z-index`, `aspect-ratio`
- Color values (hex, rgb, hsl, oklch, named colors)
- `transition-*`, `animation-*` durations
- `@media` breakpoint values
- Unitless `line-height`
- `transform` values (translate, rotate, scale)
- Value of `0` (e.g. `margin: 0`, `padding: 0`)
- `outline-offset`, `outline-width`
- `scroll-margin`, `scroll-padding`

### RUB-001: Hardcoded px/rem in spacing
- **Severity:** error
- **Type:** static
- **Description:** Detects `px` or `rem` units in `padding`, `margin`, `gap`, `row-gap`, `column-gap` inside `<style>` blocks.
- **Trigger:** Regex match on `(padding|margin|gap|row-gap|column-gap)\s*:\s*[^;]*([\d.]+)(px|rem)` in `<style>`.
- **Exceptions:** See global exceptions above. Also: `padding` inside `@media` when used as a fallback with `calc()` override.

### RUB-002: Hardcoded px/rem in font-size
- **Severity:** error
- **Type:** static
- **Description:** Detects `px` or `rem` units in `font-size` inside `<style>` blocks.
- **Trigger:** Regex match on `font-size\s*:\s*[^;]*([\d.]+)(px|rem)` in `<style>`.
- **Exceptions:** See global exceptions above.

### RUB-003: Hardcoded px/rem in dimensions
- **Severity:** error
- **Type:** static
- **Description:** Detects `px` or `rem` in `width`, `height`, `max-width`, `min-width`, `max-height`, `min-height` inside `<style>`.
- **Trigger:** Regex match on `(width|height|max-width|min-width|max-height|min-height)\s*:\s*[^;]*([\d.]+)(px|rem)` in `<style>`.
- **Exceptions:** See global exceptions above. Also: `max-width` used for text readability capping (e.g. `max-width: 65ch`).

### RUB-004: Hardcoded px/rem in positioning
- **Severity:** error
- **Type:** static
- **Description:** Detects `px` or `rem` in `top`, `left`, `right`, `bottom`, `inset` inside `<style>`.
- **Trigger:** Regex match on `(top|left|right|bottom|inset)\s*:\s*[^;]*([\d.]+)(px|rem)` in `<style>`.
- **Exceptions:** See global exceptions above.

### RUB-005: Tailwind spacing classes in HTML
- **Severity:** error
- **Type:** static
- **Description:** Detects Tailwind spacing utility classes (`p-N`, `px-N`, `py-N`, `pt-N`, `pb-N`, `pl-N`, `pr-N`, `m-N`, `mx-N`, `my-N`, `mt-N`, `mb-N`, `ml-N`, `mr-N`, `gap-N`, `gap-x-N`, `gap-y-N`) where N > 0 in HTML class attributes.
- **Trigger:** Class attribute contains spacing utility with numeric value > 0 (e.g. `p-4`, `mt-8`, `gap-6`).
- **Exceptions:** `p-0`, `m-0`, `gap-0` are allowed. Classes inside `<style>` blocks (CSS selectors) are not checked here — see RUB-001.

### RUB-006: Tailwind responsive prefixes in HTML
- **Severity:** warning
- **Type:** static
- **Description:** Detects Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) in HTML class attributes. These break due to parser.js scoping — scope selector raises specificity of base classes above responsive variants.
- **Trigger:** Class attribute contains `(sm|md|lg|xl|2xl):` prefix.
- **Exceptions:** None. All responsive behavior should use native `@media` in `<style>` blocks.

### RUB-007: Tailwind font-size classes in HTML
- **Severity:** error
- **Type:** static
- **Description:** Detects Tailwind typography size classes (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`, `text-6xl`, `text-7xl`, `text-8xl`, `text-9xl`) in HTML.
- **Trigger:** Class attribute contains `text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)`.
- **Exceptions:** DS utility classes like `text-display-l`, `text-body-m` are allowed (these map to CSS vars). Only bare Tailwind size classes are flagged.

---

## Theme

### THM-001: Theme tokens unresolved
- **Severity:** error
- **Type:** computed
- **Description:** A `data-section-theme` attribute is set, but one or more of the 8 core tokens resolves to `unset`, empty string, or `undefined`.
- **Trigger:** `getComputedStyle(section).getPropertyValue('--section-bg')` (or any of: `--section-text`, `--section-text-secondary`, `--section-accent`, `--section-btn-bg`, `--section-btn-color`, `--section-surface`, `--section-border`) returns empty/unset.
- **Exceptions:** Sections without `data-section-theme` attribute are not checked.

### THM-002: Normal text contrast below AA (4.5:1)
- **Severity:** error
- **Type:** computed
- **Description:** Computed text color vs effective background color has contrast ratio below 4.5:1 for normal text (font-size < 18px, or < 14px bold).
- **Trigger:** WCAG 2.1 contrast algorithm on computed `color` vs resolved background (walking up ancestors, accounting for `background-color`, `background-image` overlays).
- **Exceptions:** Decorative text (`.sr-only`, `aria-hidden="true"`). Text on `background-image` with overlay gradient (check overlay color instead). False positive filter: skip if contrast ratio < 1.1 (indicates bg detection failure).

### THM-003: Large text contrast below AA (3:1)
- **Severity:** error
- **Type:** computed
- **Description:** Large text (font-size >= 18px, or >= 14px bold) has contrast ratio below 3:1.
- **Trigger:** Same algorithm as THM-002 but with 3:1 threshold for qualifying large text.
- **Exceptions:** Same as THM-002.

### THM-004: Button on overlay with low internal contrast
- **Severity:** error
- **Type:** computed
- **Description:** A button element sits on an overlay (e.g. hero image with gradient) and the button's own text-to-background contrast is below 3:1.
- **Trigger:** Button `color` vs button `background-color` contrast < 3:1, AND button is inside an element with `background-image`.
- **Exceptions:** Outline/ghost buttons (transparent bg) — check text vs section bg instead.

### THM-005: Dark button on dark overlay
- **Severity:** error
- **Type:** computed
- **Description:** Button with dark background (relative luminance < 0.1) placed on dark overlay (section bg luminance < 0.15). Button becomes invisible.
- **Trigger:** `relativeLuminance(btnBg) < 0.1 && relativeLuminance(sectionBg) < 0.15`.
- **Exceptions:** None.

---

## Layout

### LAY-001: Horizontal overflow
- **Severity:** error
- **Type:** computed
- **Description:** Section or page has horizontal scrollbar. `scrollWidth > clientWidth` on section wrapper or `<body>`.
- **Trigger:** Measured at each viewport (1440px, 768px, 375px). `element.scrollWidth - element.clientWidth > 2` (2px tolerance for subpixel).
- **Exceptions:** Intentional horizontal scroll containers (`.overflow-x-auto`, `.overflow-x-scroll`, `[data-scroll="horizontal"]`).

### LAY-002: Element exceeds container on tablet/mobile
- **Severity:** error
- **Type:** computed
- **Description:** A child element's `getBoundingClientRect().right` exceeds the viewport width, or `left < 0` causing clipping.
- **Trigger:** Measured at 768px and 375px viewports. Element rect exceeds viewport bounds by > 5px.
- **Exceptions:** Decorative elements with `overflow: hidden` on parent. Negative margin patterns that are clipped by parent. `position: absolute` decorations outside flow.

---

## Typography

### TYP-001: Computed font-size below 12px
- **Severity:** warning
- **Type:** computed
- **Description:** Any visible text element has computed `font-size` below 12px. Usually indicates broken rubber calc or missing DS token.
- **Trigger:** `getComputedStyle(el).fontSize` parsed to float < 12.
- **Exceptions:** `<sup>`, `<sub>` elements. Elements with `aria-hidden="true"`. Legal/copyright fine print explicitly designed small.

### TYP-002: Heading hierarchy gap
- **Severity:** warning
- **Type:** static
- **Description:** Heading levels skip (e.g. `h1` followed by `h3` without `h2` in between within the same section).
- **Trigger:** Parse heading elements in DOM order within each section. If `h(N+2)` appears after `h(N)` without intervening `h(N+1)`.
- **Exceptions:** Different sections can restart heading hierarchy. Hero sections may use `h1` while next section starts at `h2`.

---

## Accessibility

### A11Y-001: Image without alt
- **Severity:** warning
- **Type:** static
- **Description:** `<img>` element without `alt` attribute (not even empty `alt=""`).
- **Trigger:** `img:not([alt])` selector matches.
- **Exceptions:** None. Decorative images should have `alt=""` explicitly.

### A11Y-002: Form input without label
- **Severity:** warning
- **Type:** static
- **Description:** `<input>`, `<select>`, or `<textarea>` without an associated `<label>` (via `for`/`id` or wrapping) and without `aria-label` or `aria-labelledby`.
- **Trigger:** Form control has no label association and no ARIA label attribute.
- **Exceptions:** `<input type="hidden">`, `<input type="submit">`, `<input type="button">` (these use `value` as label).

---

## Component

### CMP-001: Dark link on dark background
- **Severity:** error
- **Type:** computed
- **Description:** A link (`<a>`) has dark text color (relative luminance < 0.05) on a dark section background (luminance < 0.15). Link is effectively invisible.
- **Trigger:** `relativeLuminance(linkColor) < 0.05 && relativeLuminance(sectionBg) < 0.15`.
- **Exceptions:** Links inside buttons (button styling takes precedence). Links with `background-color` set (pill/chip links).
