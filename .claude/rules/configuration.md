---
paths: src/**/*.twig, src/**/ds.json, src/**/style/**
---

# CSS Variables and Components

## Principle

All visual properties of UI components (button, tab, card, chip, accordion, input) must be controlled via CSS variables. Hardcoded values in components are forbidden.

## Adding New Variables

If a CSS property of a component has no variable:

1. Check whether a suitable variable already exists in the component's `@theme`
2. If not — add the variable to `@theme` in `index.ds.css.twig`
3. Use the variable in the component utility
4. Override the value in the company's `style/ds.json`

### Variable Naming

Pattern: `--{component}-{property}`

```
--tab-font-weight
--tab-padding-inline
--tab-padding-block
--tab-height
--tab-shadow
--tab-shadow-hover
```

## Component Configuration

All customizations are made in the company's `style/ds.json`. Do not add inline styles or tailwind classes for properties covered by component variables.

### Example: tab

```css
:root {
  --tab-font-weight: 600;
  --tab-font-size: 1.5rem;
  --tab-height: auto;
  --tab-padding-inline: 1.7rem;
  --tab-padding-block: 0.9rem;
  --tab-radius: 1.33rem;
  --tab-shadow: 0 0 11px 0 rgba(172, 175, 193, 0.27);
  --tab-shadow-hover: 0 0 12px 0 rgba(172, 175, 193, 0.55);
}
```

## Component Themes

A theme is a component variant (e.g., `btn-primary`, `accordion-card`, `accordion-outline`). A theme **only overrides CSS variables** of the base component. No sub-utilities.

### Rules

1. **One utility per theme** — `accordion-card`, `btn-primary`, `accordion-outline`. Sub-utilities (`accordion-card-icon`, `accordion-outline-body`, `btn-primary-text`) must not exist
2. **`@apply base`** — the theme inherits the base utility (`@apply accordion`, `@apply btn`)
3. **Variable overrides only** — the utility body contains only `--base-var: var(--theme-var)`. No direct CSS properties (except unique properties absent from the base, e.g. `border-top` in collapse)
4. **Theme defaults in `@theme`** — each theme declares its variables with default values
5. **Override in `ds.json`** — final values are set in the company's `style/ds.json`

### Theme Structure

```css
/* card.css */
@theme {
  --accordion-card-radius: 0.75rem;
  --accordion-card-bg: var(--color-neutral-100);
  --accordion-card-icon-size: 1.5rem;
  /* ... theme defaults */
}

@utility accordion-card {
  @apply accordion;

  /* Base variable overrides only */
  --accordion-radius: var(--accordion-card-radius);
  --accordion-bg: var(--accordion-card-bg);
  --accordion-icon-size: var(--accordion-card-icon-size);
}
```

### What Is Forbidden in Themes

```css
/* Bad — theme sub-utility */
@utility accordion-card-icon { ... }
@utility accordion-outline-body { ... }

/* Bad — nested styles for child elements */
@utility accordion-collapse {
  & .accordion-trigger { justify-content: flex-start; }
  & .accordion-icon-plus { width: 1.25rem; }
}

/* Good — variables control child elements */
@utility accordion-collapse {
  @apply accordion;
  --accordion-trigger-justify: flex-start;
  --accordion-icon-size: var(--accordion-collapse-icon-size);
}
```

### If the Required Property Is Not in the Base

Add the variable to the base component's `@theme`, use it in the utility, then override it in the theme. Do not create sub-utilities.

## Section Type Configuration

The plugin automatically adds a CSS class for the section type to the root element of the template. The type is determined by the folder in `app/src/companies-components-scope/`:

- `app/src/companies-components-scope/minimal/hero/simple/index.tpl` → class `hero`
- `app/src/companies-components-scope/minimal/cta/centered/index.tpl` → class `cta`
- `app/src/companies-components-scope/minimal/faq/cards/index.tpl` → class `faq`

Type customization — in `index.ds.css.twig` (globally) or via variables in `ds.json`:

```css
:root {
  .hero {
    padding-block: 6rem 4rem;
    background: var(--color-primary-50);
  }

  .cta {
    padding-block: 4rem;
    text-align: center;
  }

  .faq {
    padding-block: 5rem;
  }

  .footer {
    padding-block: 3rem;
    background: var(--color-neutral-900);
  }
}
```

The class is inserted first in the list: `<section class="hero px-4 py-12">`. If the element has no `class` attribute — the attribute is added automatically.

There is no need to manually write the type class in `.tpl` files — the plugin does this automatically.

## In Templates

Use only the component CSS class. Do not duplicate styles via tailwind or inline:

```html
<!-- Bad -->
<a href="#" class="tab" style="font-size: 1.5rem; font-weight: 600;">Text</a>
<a href="#" class="tab text-lg font-semibold rounded-xl shadow-md">Text</a>

<!-- Good -->
<a href="#" class="tab">Text</a>
```
