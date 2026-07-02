---
paths: src/**/*.tpl
---

# Development Workflow

## Main goal

We adapt blocks from third-party design systems (Tailwind UI, Shadcn, etc.) into our design system.

## Working process

### 1. Clarify the task

If not specified explicitly — ask:

**a) Block source** — website URL, Figma, local file

**b) Additional notes** — what to include/exclude ("only hero", "no navigation")

**c) Approach** — standard (see below) or custom

### 2. Standard approach

You may encounter one of two scenarios:

#### Scenario 1: One type of block

One specific type of block (e.g., only `hero`, only `footer`, only `cta`).

**Usually** this is a list of several variants of one type:
- Several different `hero` variants
- Several different `footer` variants
- Etc.

**Algorithm:**

1. Create the folder `app/src/companies-components-scope/{company}/{block-type}/` (if it doesn't exist)
2. Go through each block variant:
   - Click the "Copy code" button (or equivalent) — code is copied immediately
   - If no such button → click "Show code" and copy manually
   - Take the variant name (1-2 words, kebab-case). If not available — generate one
   - Create the file `app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl`
   - Paste the copied code
   - **Adapt the code** following the rules in `rules/transform-rules.md`
   - Add the import to `app/src/pages/{company}/index.html`

#### Scenario 2: Multiple types of blocks

A list of blocks split by type (e.g.: Hero, Footer, CTA, Features).

**Algorithm:**

Go through each item in the list and apply **Scenario 1** for each block type.

### 3. Code adaptation

After copying the code, **always**:

1. Convert to `.tpl` format (template, style, script sections)
2. Replace Tailwind classes with our components (btn-primary, input, card)
3. Use CSS variables for colors
4. Add `@mixin responsive` for all sizes
5. Check accessibility

### 4. Visual check

After adaptation, **MANDATORY**:

1. Add the block import to `app/src/pages/{company}/index.html`
2. Run `pnpm -C app dev`
3. Open the browser (or use browser automation)
4. Set window size — width: 1440, height: 900
5. Take a screenshot
6. Compare with the original

### 5. Fix cycle

If there are differences:

1. Log the issues (sizes, spacing, colors, positioning)
2. Fix the code
3. Repeat the check (screenshot + comparison)

```
Adapt → Screenshot → Compare → Fix → Screenshot → ...
```

Repeat until fully matching the original.

## Pre-completion checklist

- [ ] Code converted to `.tpl` format
- [ ] Our components used (btn-primary, input, card)
- [ ] Colors via CSS variables
- [ ] `@mixin responsive` for all sizes
- [ ] Accessibility satisfied (semantics, aria-labels)
- [ ] Visually matches the original
- [ ] No Biome errors (`pnpm -C app check`)
- [ ] Import added to `app/src/pages/{company}/index.html`

## Custom approach

If the standard approach does not fit — ask how to proceed and I will describe it.
