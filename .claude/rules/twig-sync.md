---
paths: src/**/*.twig
---

# Syncing company-specific twig with the main twig

## Problem

`render-ds-css.mjs` and the `ds-css.js` plugin prefer the **company-specific twig** over the main one:
- If `{company}/style/index.ds.css.twig` exists — it is used, NOT `app/src/index.ds.css.twig`

Companies with company-specific twig: **minimal**, **avito**, **pik**, **sandbox**, **vtb**

When a new `getResponsiveMediaQuery(...)` or variable is added to `app/src/index.ds.css.twig` —
it is not present in the company-specific twig. Result: the CSS variable remains `unset` → fallback value.

**Real incidents:**
- `container-padding-inline: unset` → fallback `1.5rem = 24px` instead of `138px` (almost no content padding)
- `container-padding-block: unset` → fallback `2rem = 32px` instead of `115px`
- `container-padding-block` in `.footer` → footer height `~48px` instead of normal

## Main rule

**After any change to `app/src/index.ds.css.twig` — ALWAYS check these three blocks in EVERY company twig:**

### Block 1: `:root` container section

In the main twig (lines ~7502):
```twig
{{ getResponsiveMediaQuery("container-padding-inline", ds["container-padding-inline"]|default("60px"), ds["container-padding-inline-mobile"]) }}
{{ getResponsiveMediaQuery("container-padding-block", ds["container-padding-block"]|default("unset"), ds["container-padding-block-mobile"]) }}
```

Must be present in the same form in `{company}/style/index.ds.css.twig` in the analogous `/* === container === */` block.

### Block 2: `.container {}` block

In the main twig (~line 8090):
```twig
.container {
    {{ getResponsiveMediaQuery("container-padding-inline", ...) }}
    {{ getResponsiveMediaQuery("container-padding-block", ...) }}
}
```

Must contain the same calls in the company twig.

### Block 3: `.header` and `.footer` blocks

Any `getResponsiveMediaQuery(...)` calls added inside `.header` and `.footer` sections in the main twig —
must be duplicated in the company twig.

## Checklist when changing `app/src/index.ds.css.twig`

```
□ Added/changed getResponsiveMediaQuery in the :root block?
  → Check minimal/style/index.ds.css.twig (same block)
  → Check avito/style/index.ds.css.twig
  → Check pik/style/index.ds.css.twig
  → Check sandbox/style/index.ds.css.twig
  → Check vtb/style/index.ds.css.twig

□ Added/changed the .container { } block?
  → Check .container {} in every company twig

□ Added/changed the .footer { } or .header { } block?
  → Check the corresponding blocks in every company twig
```

## How to detect a sync mismatch

Signs in the generated CSS (`generated-css-from-twig/{company}-ds.css`):
- `--container-padding-inline: unset;` without a following `@media` — problem
- `--container-padding-block: unset;` without a following `@media` — problem
- `.container {}` empty block after `/* Rubber padding */` — problem

Quick check:
```bash
grep "container-padding-inline" app/src/generated-css-from-twig/minimal-ds.css
# Should be: --container-padding-inline: 138px; (not unset)
```

## After fixing the company twig

Always regenerate the CSS:
```bash
node app/scripts/render-ds-css.mjs minimal --out app/src/generated-css-from-twig/minimal-ds.css
node app/scripts/render-ds-css.mjs avito --production-ds --out app/src/generated-css-from-twig/avito-ds.css
node app/scripts/render-ds-css.mjs sandbox --out app/src/generated-css-from-twig/sandbox-ds.css
node app/scripts/render-ds-css.mjs vtb --out app/src/generated-css-from-twig/vtb-ds.css
```
