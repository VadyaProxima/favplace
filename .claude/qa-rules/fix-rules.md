# Fix Rules

Knowledge base for ds-fixer agents. Reference when resolving issues found by automated checks or visual review.

---

## 1. DS-First Strategy

**Always try to fix at the DS level before touching a .tpl file.**

### When to fix at DS level (ds.json / company twig)
- Issue appears in **3 or more sections** of the same type (e.g. all CTAs have wrong padding)
- Issue is a **color/typography/spacing token** that should be consistent globally
- Issue is in a **theme mapping** (dark theme buttons wrong everywhere)

### When to fix at section level (.tpl)
- Issue is **unique to one section's HTML structure** (e.g. specific card layout overlap)
- Issue requires **structural HTML changes** (adding/removing elements)
- DS-level fix would cause **regressions in other sections**

### Blast-Radius Protocol

Before applying any DS-level fix:

1. `git stash` or commit current work
2. Apply the fix
3. Regenerate CSS (see File Sync Protocol below)
4. Re-scan affected company: `node app/tests/visual-check.mjs --company={company}`
5. Compare scan results before/after
6. If new issues appear → `git stash pop` / revert and fix at section level instead

---

## 2. File Sync Protocol

| What you changed | What else to do |
|---|---|
| `ds.json` token **value** | Regenerate CSS (see commands below) |
| `ds.json` **new token** | `pnpm -C app ds:add-token <name> <value> --company={company}`, then check company twigs have the utility class |
| `src/index.ds.css.twig` (master) | Delegate to **twig-sync** agent to sync company twigs |
| Company twig (`{company}/style/index.ds.css.twig`) | Regenerate CSS for that company |
| `.tpl` file | No sync needed |
| `template.json` (per-section) | Update corresponding entry in company `templates.json` |
| `style.json` | No auto-sync, but check if `designPreset` needs update |

### CSS Regeneration Commands

**minimal** (non-rubber, no `--production-ds`):
```bash
node app/scripts/render-ds-css.mjs minimal --out app/src/generated-css-from-twig/minimal-ds.css
```

**avito / pik** (rubber, requires `--production-ds`):
```bash
node app/scripts/render-ds-css.mjs avito --production-ds --out app/src/generated-css-from-twig/avito-ds.css
node app/scripts/render-ds-css.mjs pik --production-ds --out app/src/generated-css-from-twig/pik-ds.css
```

---

## 3. Rubber Fixes

### Hardcoded px/rem to rubber calc

**Formula:** `desired_px_at_1440 / 0.75 = N`, then `calc(N / 19.2 * 1vw)`

Equivalently: `N = desired_px * 1.333...`

| Desired at 1440px | N value | CSS |
|---|---|---|
| 16px | 21.33 | `calc(21.33 / 19.2 * 1vw)` |
| 24px | 32 | `calc(32 / 19.2 * 1vw)` |
| 32px | 42.67 | `calc(42.67 / 19.2 * 1vw)` |
| 48px | 64 | `calc(64 / 19.2 * 1vw)` |
| 64px | 85.33 | `calc(85.33 / 19.2 * 1vw)` |

**Mobile rubber** (below 767px): `calc(N / 3.75 * 1vw)`

### Prefer DS tokens over raw calc

If a DS variable exists, use it instead of inline calc:

```css
/* Bad — hardcoded rubber */
padding: calc(32 / 19.2 * 1vw);

/* Good — DS token (if it exists) */
padding: var(--container-padding-block);

/* Acceptable — rubber calc when no token exists */
padding: calc(32 / 19.2 * 1vw);
```

### Tailwind spacing to rubber CSS

Move from HTML class to `<style>` block:

```html
<!-- Before (RUB-005 violation) -->
<div class="p-8 mt-6 gap-4">

<!-- After -->
<div class="section-content">
```

```css
/* In <style> block */
.section-content {
  padding: calc(42.67 / 19.2 * 1vw);
  margin-top: calc(32 / 19.2 * 1vw);
  gap: calc(21.33 / 19.2 * 1vw);
}

@media (max-width: 767px) {
  .section-content {
    padding: calc(42.67 / 3.75 * 1vw);
    margin-top: calc(32 / 3.75 * 1vw);
    gap: calc(21.33 / 3.75 * 1vw);
  }
}
```

### Tailwind responsive to native @media

```html
<!-- Before (RUB-006 violation) -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

<!-- After -->
<div class="my-grid">
```

```css
.my-grid {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .my-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .my-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 4. Theme Contrast Fixes

### Button on dark overlay invisible (THM-005)

**Problem:** `.btn` (dark bg) on dark hero overlay = invisible.

**Fix:** Change to `.btn-light`:
```html
<!-- Before -->
<a class="btn">Get Started</a>

<!-- After -->
<a class="btn-light">Get Started</a>
```

### Button in dark theme wrong (inverted)

**Problem:** `data-section-theme="dark"` inverts button semantics.

**Fix:** In dark theme contexts, `.btn` renders as light, `.btn-light` renders as dark. So:
- Dark overlay section → use `btn-light` (renders light in that context)
- If section uses `data-section-theme="dark"` → `btn` already renders as light-on-dark

### Text on image overlay unreadable (THM-002/003)

**Fix:** Add text-shadow or ensure overlay gradient is sufficient:
```css
.hero-text {
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
```

Or strengthen the overlay gradient in the template.

### Chip/badge on overlay invisible

**Fix:** Add border and semi-transparent background:
```css
.chip-on-overlay {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
}
```

---

## 5. Spacing Fixes

### Negative margin hack to gap

```css
/* Before — causes LAY-001 overflow */
.parent {
  margin-left: -12px;
  margin-right: -12px;
}
.child {
  padding-left: 12px;
  padding-right: 12px;
}

/* After */
.parent {
  display: flex;
  flex-wrap: wrap;
  gap: calc(24 / 19.2 * 1vw);
}
```

### justify-between with sparse content

```css
/* Before — 2 items spread to edges with huge gap */
.row {
  display: flex;
  justify-content: space-between;
}

/* After — consistent gap */
.row {
  display: flex;
  gap: calc(32 / 19.2 * 1vw);
}
```

---

## 6. DON'T Rules

### DON'T transfer all padding to the section element
Container-bg sections (CTA, footer) rely on inner container padding for colored background inset. Moving padding to the outer section breaks the visual container-within-section pattern.

### DON'T change max-w-* on inner containers
`max-w-3xl`, `max-w-2xl`, `max-w-lg` on nested divs are intentional design constraints for text readability. Do not remove or widen without explicit request.

### DON'T use |default() for rubber values in twig
`|default()` silently masks missing ds.json keys. Rubber values must be explicit in ds.json. If a key is missing, it should fail visibly, not fall back.

### DON'T use Tailwind responsive classes in .tpl files
Parser.js scope selector raises base class specificity above responsive variants. `md:py-4` loses to scoped `py-2`. Always use native `@media` in `<style>`.

### DON'T change global tokens without full re-scan
Changing a global DS token (e.g. `--container-padding-inline`, `--text-body-m-font-size`) affects ALL sections. Must re-scan entire company after change.

### DON'T change container-padding without explicit request
Container padding is a foundational layout token. Changing it shifts every section's content inset. Only change if the user specifically asks.

### DON'T add inline styles
```html
<!-- Never do this -->
<div style="padding: 20px; color: red;">

<!-- Use <style> block or DS tokens -->
```

### DON'T fix at .tpl level if 3+ sections share the same issue
This signals a DS-level problem. Fix at ds.json or company twig level.
