---
paths: src/**/*.twig, src/**/ds.json, src/**/*.tpl
---

# DS-First: Design System Before Section

## Core Principle

**Always try to fix at the DS level first. Fall back to section-level only when DS cannot solve it.**

The design system (`ds.json`, `index.ds.css.twig`, CSS utilities) controls the visual appearance
of ALL sections. A fix there improves ALL current and future templates at once.
A fix in a specific `.tpl` only fixes that one section.

## Decision Algorithm

```
Problem found in a section
       │
       ▼
Is this problem shared across multiple sections?
       │ YES                          │ NO
       ▼                             ▼
Fix at DS level            Is the problem about a
                           component property?
                           (color, size, radius, spacing)
                                  │ YES         │ NO
                                  ▼             ▼
                           Fix at DS level   Fix at section level
```

## What to Fix Where

### Fix in ds.json (company design system values)

- Typography: wrong font-size, line-height, font-weight for h1-h6, btn, lead, body
- Colors: wrong primary/neutral color values
- Component properties: btn-radius, card-radius, chip-radius, icon-box-size
- Spacing: btn-padding-inline/block, accordion-padding, card-padding
- Section variables: sections.hero.h1-text-align, sections.footer.background

**Example:**
```json
// Problem: all CTA buttons have square corners
// Fix in ds.json:
{ "btn-radius": "1.5rem" }
```

### Fix in index.ds.css.twig (global utilities and variables)

- A CSS variable exists but is not being applied to the utility
- A new CSS variable needs to be added to a component utility
- A section type (`.hero {}`, `.cta {}`) needs a new variable support

**Example:**
```twig
{# Problem: hero sections can't control h1 alignment per-company #}
{# Fix: add conditional variable output to .hero block #}
{% if ds.sections.hero["h1-text-align"] is defined %}
--h1-text-align: {{ ds.sections.hero["h1-text-align"] }};
{% endif %}
```

### Fix in company twig (company-specific twig file)

- Company has `{company}/style/index.ds.css.twig` that overrides the main twig
- A block in the main twig was added but not synced to company twig
- Company-specific rubber calc values

**After any change here → run twig-sync agent.**

### Fix in .tpl (section template — last resort)

Only fix here when:
1. DS cannot solve this problem (it's about HTML structure or section-specific layout)
2. The problem is unique to this one section and does not occur elsewhere
3. Adding a DS variable for this one-off case would over-engineer the system

**Example of valid section-level fixes:**
- Wrong HTML nesting (card content outside card wrapper)
- Missing `data-cms-*` attribute on an editable element
- Tailwind layout class wrong for this specific grid (e.g., `grid-cols-3` should be `grid-cols-2`)
- Specific section has a hard-coded color that overrides DS (needs removal)

**Bad reasons to fix at section level:**
- "It's faster to just change the class here" → No, fix DS
- "Other sections don't have this issue" → Check if DS variable would still help
- "The DS variable doesn't exist yet" → Add the variable to DS first

## Checklist Before Fixing a Section

```
□ Does this problem exist in other sections too? → fix DS
□ Is this about a component property (color, radius, size)? → fix ds.json
□ Is the CSS variable available but has wrong value? → fix ds.json
□ Is the CSS variable missing entirely? → add to twig, then ds.json
□ Is this about HTML structure unique to this section? → fix .tpl
□ Is this layout decision intentional? → ask before changing
```

## Examples

### ✅ DS-Level Fix

```
Problem: "CTA buttons in avito hero look too small"
Root cause: --btn-padding-block is 0.5rem, should be 0.75rem
Fix: avito/style/ds.json → "btn-padding-block": "0.75rem"
Result: ALL buttons in avito are improved, not just hero CTA
```

```
Problem: "Cards in features sections have grey background instead of white"
Root cause: --card-bg wrong value in ds.json
Fix: ds.json → "card-bg": "#ffffff"
Result: ALL card variants improved
```

### ✅ Section-Level Fix (justified)

```
Problem: "hero/fullscreen-cover shows text and image side-by-side, should be stacked"
Root cause: grid-cols-2 in this specific template — no DS variable for this layout
Fix: .tpl → change grid-cols-2 to grid-cols-1, add md:grid-cols-2
Result: Only this template variant is fixed (correct, layout is specific)
```

### ❌ Wrong Approach

```
Problem: "h2 in features/grid-icons is too large"
Wrong fix: Add style="font-size: 1.5rem" to the h2 in .tpl
Right fix: Check h2-font-size in ds.json, fix at DS level
```

## Working with Mixed Problems

Sometimes a problem has two layers:
1. DS sets a base value that's wrong → fix DS
2. A specific template overrides the DS variable incorrectly → fix template too

In this case: **fix DS first**, verify, then fix the template override if still needed.
