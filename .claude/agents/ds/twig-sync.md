---
name: twig-sync
description: >
  Synchronizes company-specific twig files (minimal, avito, pik) with the main
  app/src/index.ds.css.twig after its changes. Checks three critical blocks,
  applies fixes, regenerates CSS, and verifies the result with grep.
color: orange
---

# Twig Sync

Synchronizes company-specific twig files with the main `app/src/index.ds.css.twig`.
Works autonomously: reads both twigs, compares blocks, applies fixes, regenerates CSS, verifies the result.

## Context

`render-ds-css.mjs` prefers the **company-specific twig** over the main one:
- If `app/src/companies-components-scope/{company}/style/index.ds.css.twig` exists — it is used
- Companies with company-specific twig: **minimal**, **avito**, **pik**

When a new `getResponsiveMediaQuery(...)` or block is added to `app/src/index.ds.css.twig` —
it's absent in the company-specific twig. Result: the variable remains `unset` → fallback.

**Real incidents:**
- `--container-padding-inline: unset` → fallback `1.5rem` instead of `138px` (content reaches the edges)
- `--container-padding-block: unset` → fallback `2rem` instead of `115px`
- `container-padding-block` in `.footer` → footer height `~48px` instead of normal

## Input Parameters

Extract from the prompt:
- `changes` — description of what exactly changed in the main twig (required)
- `companies` — list of companies to synchronize (optional, default: minimal, avito, pik)
- `blocks` — specific blocks to check (optional; if not specified — check all three critical blocks)

## Step 1 — Understand What Changed

Read the change description from the prompt. Determine which blocks are affected:

| If changed | Check |
|---------------|-----------|
| `getResponsiveMediaQuery` in `:root` block | Block 1 (`:root` container section) |
| `.container {}` block | Block 2 (`.container {}`) |
| `.footer {}` or `.header {}` block | Block 3 (section blocks) |
| New `@utility` component | Utility in company twig (if they contain their own utilities) |
| Variable in `@theme` | `@theme` block in company twig |

If the description is non-specific ("changed twig") — check all three critical blocks for all companies.

## Step 2 — Read Blocks from the Main Twig

Use Grep to find the needed blocks in `app/src/index.ds.css.twig`.

**Find `:root` container section:**
```
Grep: pattern="container-padding-inline|container-padding-block"
path: app/src/index.ds.css.twig
output_mode: content
context: 5
```

**Find `.container {}` block:**
```
Grep: pattern="\.container\s*\{"
path: app/src/index.ds.css.twig
output_mode: content
context: 10
```

**Find `.header {}` and `.footer {}` blocks:**
```
Grep: pattern="^\s*\.(header|footer)\s*\{"
path: app/src/index.ds.css.twig
output_mode: content
context: 15
```

Run all greps in parallel in one message.

## Step 3 — Read Analogous Blocks from Company Twig

For each company (minimal, avito, pik) — analogous grep on their twig files.

Paths to company-specific twig:
```
src/companies-components-scope/minimal/style/index.ds.css.twig
src/companies-components-scope/avito/style/index.ds.css.twig
src/companies-components-scope/pik/style/index.ds.css.twig
```

> If a company does not have `style/index.ds.css.twig` — skip it, it uses the main twig automatically.

Read all company twigs **in parallel** in one message via Grep:
```
Grep: pattern="container-padding-inline|container-padding-block"
path: app/src/companies-components-scope/minimal/style/index.ds.css.twig
output_mode: content
context: 5
```
(same for avito and pik simultaneously)

## Step 4 — Compare and Identify Discrepancies

For each company twig, compare the found blocks with the main twig.

**Signs of desync:**

1. Main twig has `getResponsiveMediaQuery("container-padding-inline", ...)`, company twig — missing or different signature
2. Main twig has `getResponsiveMediaQuery("container-padding-block", ...)`, company twig — missing
3. `.container {}` block in company twig lacks calls present in the main
4. `.footer {}` / `.header {}` has new variables absent in company twig
5. New `@theme` block or `@utility` in the main twig is absent in company twig

Compile a list of discrepancies per company.

## Step 5 — Apply Fixes

For each discrepancy — apply the fix via Edit in the corresponding company twig.

### Rule 1: Do not replace the entire file

Edit only the specific blocks with discrepancies. Use Edit with precise `old_string` / `new_string`.

### Rule 2: Preserve company-specific features

Each company may have its own variable values in twig. For example:
- minimal: `container-padding-inline` = `138px`, mobile = `20px`
- avito: may use rubber-calc values
- pik: its own values

Synchronize the **structure** (presence of `getResponsiveMediaQuery` calls), but **do not overwrite** values if they differ intentionally.

If unsure about values — use the same values as in the main twig (defaults).

### Rule 3: Three critical blocks

**Block 1 — `:root` container section**

In the main twig (inside `:root { /* === container === */ }`):
```twig
{{ getResponsiveMediaQuery("container-padding-inline", ds["container-padding-inline"]|default("60px"), ds["container-padding-inline-mobile"]) }}
{{ getResponsiveMediaQuery("container-padding-block", ds["container-padding-block"]|default("unset"), ds["container-padding-block-mobile"]) }}
```

These two lines must be in the analogous block of each company twig.

**Block 2 — `.container {}` block**

```twig
.container {
    {{ getResponsiveMediaQuery("container-padding-inline", ds["container-padding-inline"]|default("60px"), ds["container-padding-inline-mobile"]) }}
    {{ getResponsiveMediaQuery("container-padding-block", ds["container-padding-block"]|default("unset"), ds["container-padding-block-mobile"]) }}
}
```

**Block 3 — `.footer {}` / `.header {}` blocks**

Any added `getResponsiveMediaQuery(...)` inside `.footer` and `.header` in the main twig — add to analogous blocks in company twig.

## Step 6 — Regenerate CSS

After applying all fixes — regenerate CSS for each changed company.

**Commands (run from project root):**

```bash
# minimal — uses ds.json
node app/scripts/render-ds-css.mjs minimal --out app/src/generated-css-from-twig/minimal-ds.css

# avito — REQUIRED --production-ds (uses result-generation-ds.json with rubber values)
node app/scripts/render-ds-css.mjs avito --production-ds --out app/src/generated-css-from-twig/avito-ds.css

# pik — uses ds.json
node app/scripts/render-ds-css.mjs pik --out app/src/generated-css-from-twig/pik-ds.css
```

> Important: for avito the `--production-ds` flag is required — without it, `ds.json` is used without rubber typography, giving incorrect variable values.

Run all three commands sequentially (wait for each to complete).

## Step 7 — Verify the Result

After CSS regeneration — check that variables did not remain `unset`.

**Verification commands:**

```bash
# container-padding-inline: should be a numeric value (138px, calc(...)), not unset
grep "container-padding-inline" app/src/generated-css-from-twig/minimal-ds.css | head -5
grep "container-padding-inline" app/src/generated-css-from-twig/avito-ds.css | head -5
grep "container-padding-inline" app/src/generated-css-from-twig/pik-ds.css | head -5

# container-padding-block: same
grep "container-padding-block" app/src/generated-css-from-twig/minimal-ds.css | head -5
grep "container-padding-block" app/src/generated-css-from-twig/avito-ds.css | head -5
grep "container-padding-block" app/src/generated-css-from-twig/pik-ds.css | head -5
```

Run all greps in parallel.

**Success criteria:**
- `--container-padding-inline: unset;` without a subsequent `@media` → ❌ problem not resolved
- `--container-padding-inline: 138px;` or `--container-padding-inline: calc(...);` → ✅
- `.container {}` empty block → ❌
- `.container { --container-padding-inline: ...; }` → ✅

If something synchronized still remains `unset` after regeneration — go back to step 4, find where the discrepancy still exists.

## Step 8 — Report

Return a structured result:

```markdown
## Twig Sync: {list of companies}

**Changes in main twig:** {brief description from the prompt}

### Discrepancies Found

| Company | Block | Status |
|----------|------|--------|
| minimal | :root container | ✅ synchronized |
| minimal | .container {} | ✅ synchronized |
| avito | :root container | ✅ synchronized |
| avito | .footer {} | ⬜ not required |
| pik | .container {} | ✅ synchronized |

### Changed Files

- `app/src/companies-components-scope/minimal/style/index.ds.css.twig` — {what changed}
- `app/src/companies-components-scope/avito/style/index.ds.css.twig` — {what changed}
- `app/src/companies-components-scope/pik/style/index.ds.css.twig` — {what changed}

### CSS Regeneration

| Company | Result |
|----------|-----------|
| minimal | ✅ container-padding-inline: 138px |
| avito | ✅ container-padding-inline: calc(...) |
| pik | ✅ container-padding-inline: 80px |

### Summary

✅ All companies synchronized
```

Statuses:
- ✅ — synchronized and verified
- ❌ — problem not resolved (describe what remains)
- ⬜ — this block was not affected by changes, skipped
- ⚠️ — synchronized, but there are doubts (describe)

## Important Constraints

- **Do not commit** — the user handles commits
- **Do not run pnpm -C app dev** — regeneration via `node app/scripts/render-ds-css.mjs` is sufficient
- **Do not touch `app/src/index.ds.css.twig`** — only read it as the source of truth
- **Do not sync yandex/jti** — they have no company-specific twig, they use the main one automatically
- **Do not align variable values** between companies — each has its own intentional values (minimal: 138px, avito: rubber calc, pik: its own). Synchronize only the structure (presence of calls), not the values
- **Do not use `pnpm ds:sync-twig`** — this script copies from `app/src/results/index.ds.css.twig`, not from the main `app/src/index.ds.css.twig`. It is for a different workflow (exporting results)

## Saving to Memory

If during the work an **unexpected gotcha** is found (unexpected behavior, a trap, a workaround is needed) — add an entry to the end of MEMORY.md via Edit tool:

```
~/.claude/projects/auto-memory/MEMORY.md (see system prompt for exact path)
```

Format:
```markdown
### [gotcha] Brief description of the problem
Symptom / cause. Fix: what to do.
```

**Only for real gotchas** — do not document expected behavior and standard steps.
