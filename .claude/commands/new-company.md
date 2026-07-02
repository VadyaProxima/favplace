---
allowed-tools: Bash, Read, Write, Edit, Glob
description: Create a new company — scaffold ds.json, style.json, page, templates.json
---

Create a new company in the project.

## Input

Arguments: `$ARGUMENTS`

First token — company name (lowercase kebab-case, e.g.: `sber`, `ozon`, `tinkoff`).

If the name is not specified — ask.

If `app/src/companies-components-scope/{company}/` already exists — report an error and stop.

---

## Programmatic Mode (--from-tokens)

If arguments contain `--from-tokens=PATH`:

1. Read `tokens.json` from PATH
2. Skip Step 2 (Clarify Branding) — all values come from tokens
3. Mapping from tokens.json to ds.json:

| tokens.json key | ds.json key | Rubber conversion |
|---|---|---|
| `colors.primary-50..950` | `color-primary-50..950` | as-is |
| `colors.neutral-50..900` | `color-neutral..color-neutral-900` | as-is |
| `typography.h1.font-size` | `h1-font-size` | ÷ 0.75 (rubber) |
| `typography.h1.font-weight` | `h1-font-weight` | as-is |
| `typography.h1.line-height` | `h1-line-height` | as-is |
| `typography.h1.letter-spacing` | `h1-letter-spacing` | as-is |
| `typography.h2.*` | `h2-*` | same pattern |
| `typography.h3.*` | `h3-*` | same pattern |
| `typography.h4.*` | `h4-*` | same pattern |
| `typography.body.*` | `body-*` | same pattern |
| `fonts.primary.family` | `font-primary` | wrap: `"\"Family\", sans-serif"` |
| `radii.card` | `card-radius` | as-is (not rubberized) |
| `radii.btn` | `btn-radius` | as-is (not rubberized) |
| `radii.input` | `input-radius` | as-is (not rubberized) |
| `spacing.container-padding-inline` | `container-padding-inline` | ÷ 0.75 (rubber) |
| `spacing.container-padding-block` | `container-padding-block` | ÷ 0.75 (rubber) |
| `buttons.font-size` | `btn-font-size` | as-is |
| `buttons.font-weight` | `btn-font-weight` | as-is |
| `buttons.padding-block` | `btn-padding-block` | as-is |
| `buttons.padding-inline` | `btn-padding-inline` | as-is |

4. **Tablet/mobile values** (from `tokens.typography_tablet` / `tokens.typography_mobile`):
   - If `tokens.typography_tablet` exists: for each typography level, write `{token}-tablet` key to ds.json with DIRECT value (no ÷ 0.75). Example: `tokens.typography_tablet.h1.font-size: "48px"` → `"h1-font-size-tablet": "48px"`
   - If `tokens.typography_mobile` exists: write `{token}-mobile` key. Example: `"h1-font-size-mobile": "32px"`
   - If a viewport section is missing in tokens → do NOT create the key (no fallback values)
   - Also apply to spacing: `container-padding-inline-mobile` etc. if available

5. **Rubber conversion rule:** `ds_value = figma_px@1440 ÷ 0.75` for rubberized tokens (font-size, container-padding). Non-rubberized tokens (radii, font-weight, line-height, letter-spacing) → use as-is.

6. **Tokens without Figma analogue** (remain defaults from base company):
   `calculator-*`, `banner-*`, `stories-*`, `accordion-*`, `chip-*`, `tab-*`, `icon-box-*` etc.

7. In Step 3.4, set `designPreset`:
   - If rubber enabled: `"designPreset": "style/result-generation-ds.json"`
   - If `--no-rubber`: `"designPreset": "style/ds.json"`

8. After Step 4 (Generate CSS):
   - If rubber enabled (default): run full rubber pipeline:
     ```bash
     node app/scripts/generate-ds-results.mjs {company}
     node app/scripts/render-ds-css.mjs {company} --production-ds \
       --out app/src/generated-css-from-twig/{company}-ds.css
     ```
   - If `--no-rubber`: skip `generate-ds-results.mjs`, just render CSS:
     ```bash
     node app/scripts/render-ds-css.mjs {company} \
       --out app/src/generated-css-from-twig/{company}-ds.css
     ```

9. `--base=COMPANY` flag: if specified, read that company's ds.json first as defaults, then overlay tokens from tokens.json. This preserves tokens not extractable from Figma.

10. **Note on `ds-css.js`:** No registration needed. The Vite plugin uses dynamic discovery (`getCompaniesWithDs()`) — it auto-detects any company directory with `style/ds.json`.

---

## Step 1 — Validation

```bash
ls app/src/companies-components-scope/ | grep "^{company}$"
```

If the company already exists — stop with an error.

Check the name format: only `[a-z0-9-]`, does not start with a digit or hyphen.

---

## Step 2 — Clarify Branding

Ask the user (you can ask all three at once if not specified in the arguments):

1. **Primary color** — main brand color (hex, e.g. `#3758f9`). Default: `#6366f1`
2. **Font family** — main font (e.g. `Inter`, `Roboto`, `Manrope`). Default: `Inter`
3. **Base on** — from scratch (`blank`) or use an existing company as a base (`minimal`, `avito`, `pik`). Default: `blank`

If the user wants to base on an existing company — read its `style/ds.json` and use it as a starting point.

---

## Step 3 — Create File Structure

### 3.1 Directories

```bash
mkdir -p app/src/companies-components-scope/{company}/style
mkdir -p src/pages/{company}
```

### 3.2 style/ds.json

Create `app/src/companies-components-scope/{company}/style/ds.json` based on the template below.

Substitute:
- `{PRIMARY}` → chosen primary color
- `{FONT}` → font name in quotes (e.g. `"Inter"`)
- `{FONT_FILE}` → font file (e.g. `inter-latin.woff2`)
- `{TEMPLATE_HOST}` → `https://ams3.digitaloceanspaces.com/deeep-app/{company}`

```json
{
	"template_assets_host": "{TEMPLATE_HOST}",
	"fonts": {
		"faces": [
			{"family": "{FONT}", "file": "{FONT_FILE}", "format": "woff2", "weight": "400", "style": "normal"},
			{"family": "{FONT}", "file": "{FONT_FILE}", "format": "woff2", "weight": "600", "style": "normal"},
			{"family": "{FONT}", "file": "{FONT_FILE}", "format": "woff2", "weight": "700", "style": "normal"}
		]
	},
	"color-primary-50": "{PRIMARY_50}",
	"color-primary-100": "{PRIMARY_100}",
	"color-primary-200": "{PRIMARY_200}",
	"color-primary-300": "{PRIMARY_300}",
	"color-primary-400": "{PRIMARY_400}",
	"color-primary-500": "{PRIMARY}",
	"color-primary-600": "{PRIMARY_600}",
	"color-primary-700": "{PRIMARY_700}",
	"color-primary-800": "{PRIMARY_800}",
	"color-primary-900": "{PRIMARY_900}",
	"color-primary-950": "{PRIMARY_950}",
	"color-neutral": "#ffffff",
	"color-neutral-100": "#f5f5f5",
	"color-neutral-200": "#e5e5e5",
	"color-neutral-300": "#d4d4d4",
	"color-neutral-400": "#a3a3a3",
	"color-neutral-500": "#737373",
	"color-neutral-600": "#525252",
	"color-neutral-700": "#404040",
	"color-neutral-800": "#262626",
	"color-neutral-900": "#171717",
	"color-background": "#ffffff",
	"divider-color": "rgba(0, 0, 0, 0.08)",
	"font-primary": "\"{FONT}\", sans-serif",
	"font-secondary": "\"{FONT}\", sans-serif",
	"body-color": "var(--color-neutral-900)",
	"body-font-weight": "400",
	"body-font-family": "var(--font-primary)",
	"body-font-size": "16px",
	"body-font-size-mobile": "15px",
	"body-line-height": "1.5",
	"body-letter-spacing": "0",
	"body-text-align": "start",
	"h1-color": "var(--color-neutral-900)",
	"h1-font-weight": "700",
	"h1-font-family": "var(--font-primary)",
	"h1-font-size": "48px",
	"h1-font-size-mobile": "32px",
	"h1-line-height": "1.15",
	"h1-letter-spacing": "-0.02em",
	"h1-text-transform": "none",
	"h1-text-align": "inherit",
	"h2-font-weight": "700",
	"h2-font-size": "36px",
	"h2-font-size-mobile": "26px",
	"h2-line-height": "1.2",
	"h2-letter-spacing": "-0.01em",
	"h3-font-weight": "600",
	"h3-font-size": "24px",
	"h3-font-size-mobile": "20px",
	"h3-line-height": "1.3",
	"h4-font-weight": "600",
	"h4-font-size": "20px",
	"h4-font-size-mobile": "18px",
	"h4-line-height": "1.4",
	"h5-font-weight": "600",
	"h5-font-size": "16px",
	"h5-line-height": "1.5",
	"h6-font-weight": "600",
	"h6-font-size": "14px",
	"h6-line-height": "1.5",
	"btn-radius": "0.5rem",
	"btn-font-weight": "600",
	"btn-font-size": "15px",
	"btn-padding-block": "0.625rem",
	"btn-padding-inline": "1.25rem",
	"card-radius": "0.75rem",
	"card-padding-inline": "1.5rem",
	"card-padding-block": "1.5rem",
	"chip-radius": "100px",
	"tab-radius": "0.5rem",
	"tab-font-weight": "500",
	"input-radius": "0.5rem",
	"accordion-radius": "0.75rem",
	"container-padding-inline": "60px",
	"container-padding-inline-mobile": "20px",
	"container-padding-block": "80px",
	"container-padding-block-mobile": "40px",
	"icon-box-radius": "0.75rem",
	"sections": {
		"header": {},
		"hero": {},
		"footer": {
			"container-padding-block": "32px",
			"container-padding-block-mobile": "24px"
		}
	}
}
```

**Generating primary color shades:**
From hex `{PRIMARY}` (500), calculate shades manually or use the logic:
- 50: very light (95% white mixed)
- 100-400: gradual lightening
- 600-950: gradual darkening
For simplicity, you can use `{PRIMARY}` for 400-700 and lightened/darkened versions for the rest. The key is to fill all fields without leaving placeholders.

### 3.3 style/logo.svg

Create a placeholder SVG logo:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32">
  <rect width="120" height="32" rx="4" fill="{PRIMARY}"/>
  <text x="12" y="21" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="white">{COMPANY_UPPER}</text>
</svg>
```

Substitute the company name in uppercase for `{COMPANY_UPPER}`.

### 3.4 style.json

Create `app/src/companies-components-scope/{company}/style.json`:

Generate a UUID with:
```bash
node -e "const { randomUUID } = require('crypto'); console.log(randomUUID())"
```

```json
{
    "id": "{GENERATED_UUID}",
    "logo": "style/logo.svg",
    "designPreset": "style/ds.json",
    "layouts": [
        {
            "type": "css",
            "path": "style/index.ds.css.twig"
        }
    ]
}
```

**Notes:**
- `layouts` points to `style/index.ds.css.twig` — this is the entry point for the CSS layout. During export, this file is replaced with the generated results twig (without grmq calls) so the backend can render it.
- `designPreset: "style/ds.json"` is correct for new companies without rubber typography. For companies that add rubber (like minimal/avito/pik), this must be updated to `"style/result-generation-ds.json"` which contains pre-computed rubber values. The export script copies `result-generation-ds.json` into the archive, but `style.json` must point to it explicitly.

### 3.5 templates.json

```json
[]
```

### 3.6 categories.json

Copy from minimal:
```bash
cp app/src/companies-components-scope/minimal/categories.json app/src/companies-components-scope/{company}/categories.json
```

### 3.7 src/pages/{company}/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{COMPANY_TITLE} — Deeep</title>
    <link rel="stylesheet" href="/src/generated-css-from-twig/{company}-ds.css" />
  </head>
  <body>
    <!-- {company} templates are connected here -->
    <!-- @import("/src/companies-components-scope/{company}/header/.../index.tpl") -->

    <script type="module" src="/src/index.js"></script>
  </body>
</html>
```

---

## Step 4 — Generate CSS

```bash
node app/scripts/render-ds-css.mjs {company} --out app/src/generated-css-from-twig/{company}-ds.css
```

If the script returns an error — show it and explain the problem (most likely invalid JSON in ds.json).

---

## Step 5 — Update Navigation

Add a link to `app/src/pages/index.html`:

```html
<a href="/{company}" class="text-primary-500 hover:underline">{COMPANY_TITLE}</a>
```

---

## Step 6 — Verify the Result

```bash
node app/scripts/check-twig-sync.mjs
```

Should show that for `{company}` there is no custom twig and no check is required (or ✅ if all is OK).

Output the summary to the user:

```
✅ Company {company} created

Files:
  app/src/companies-components-scope/{company}/style/ds.json
  app/src/companies-components-scope/{company}/style/logo.svg
  app/src/companies-components-scope/{company}/style.json
  app/src/companies-components-scope/{company}/templates.json
  app/src/companies-components-scope/{company}/categories.json
  src/pages/{company}/index.html
  app/src/generated-css-from-twig/{company}-ds.css

Next steps:
  1. Configure colors and typography in style/ds.json
  2. Add templates to app/src/companies-components-scope/{company}/
  3. Connect templates in src/pages/{company}/index.html
  4. Check: pnpm -C app dev → http://localhost:5173/{company}
```
