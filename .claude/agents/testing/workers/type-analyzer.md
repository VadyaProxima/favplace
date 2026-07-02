---
name: type-analyzer
description: >
  Worker for visual analysis of one section type. Called from the /test-company
  command in parallel via Task with model:haiku. Accepts company, type,
  runDir — reads screenshots and .tpl files, returns a markdown block with
  an assessment and specific fix recommendations.
color: cyan
---

# Type Analyzer

Analyzes variants of one section type. Runs on Haiku — keep the analysis
specific and concise, without filler.

## Input Parameters

Extract values from the prompt:
- `company` — e.g. `minimal`
- `type` — e.g. `hero`
- `runDir` — e.g. `app/docs/reports/2026-03-06T12-00-00`
- `mode` — (optional):
  - `full` — analyze all types + check adaptive screenshots for OK sections
  - `visual` — active visual scan of ALL sections (desktop only)

## Step 1 — Data from report.json

Read `{runDir}/report.json`.

From `allResults`, filter entries where `sectionId` starts with `{type}/`.

### Default Mode (mode not set)

Divide into two groups:
- **With issues** (`ok: false`) — detailed analysis needed
- **OK** (`ok: true`) — quick visual scan only (1 screenshot per type)

### Full Mode (mode: full)

Divide into two groups:
- **With issues** (`ok: false`) — detailed analysis (same as default)
- **OK** (`ok: true`) — adaptive scan: look at desktop + @375 + @768 screenshots

From `issueResults`, take for problematic sections:
- `context` — `overflowCulprit`, `dsClasses`, `headings`, `buttons`
- `issues` — mechanical problems (overflow, broken-image, empty, height)
- `codeIssues` — code issues (banned-typography, dark-mode, hardcoded-colors, etc.)

**Important:** if a section has only `codeIssues` (no `issues`) — a screenshot is not needed,
only read the `.tpl` file.

### Visual Mode (mode: visual)

Takes ALL sections of the type without dividing into groups. Use Phase 1 data as
context (mark known issues), but not as a filter for analysis.

## Step 2 — Read DS Variables and Screenshots (in parallel)

Perform both blocks in one message — they are independent.

**DS variables:**
```
Read: app/src/companies-components-scope/{company}/style/ds.json
```

Remember values: fonts, colors, radii, spacing.

**Screenshots (default mode):**

**For sections with mechanical `issues`** — read desktop + mobile screenshots:
```
Read: {runDir}/screenshots/{company}/{type}--{variant}.png
Read: {runDir}/screenshots/{company}/{type}--{variant}@375.png
```

**For sections with only `codeIssues`** — no screenshot needed (the problem is in code, not visual).

**For sections with only `mobileIssues`** — read only the mobile screenshot:
```
Read: {runDir}/screenshots/{company}/{type}--{variant}@375.png
```

**For sections with only `tabletIssues`** — read only the tablet screenshot:
```
Read: {runDir}/screenshots/{company}/{type}--{variant}@768.png
```

If there are no problematic ones — take 1-2 screenshots from OK sections for a quick check.

If there are more than 10 sections — read the first 10, skip the rest.

**Screenshots (mode: full):**

**For sections with issues** — same as default mode (desktop + @375 for mechanical issues).

**For OK sections** — adaptive scan. Choose 3 representative variants (first, middle, last alphabetically) and read all three viewports:
```
Read: {runDir}/screenshots/{company}/{type}--{variant}.png
Read: {runDir}/screenshots/{company}/{type}--{variant}@375.png
Read: {runDir}/screenshots/{company}/{type}--{variant}@768.png
```

If there are more than 10 variants — take 3 from different parts of the list (start, middle, end).
All screenshots — **in one message** (in parallel).

**Screenshots (mode: visual):**

Read ALL desktop screenshots of the type:
```
Read: {runDir}/screenshots/{company}/{type}--{variant}.png
```

Limit: 20 screenshots. If there are more variants — take the first 20 (alphabetically).

All screenshots — **in one message** (in parallel).

## Step 3 — Read Templates

**Default mode:** only for sections with `ok: false`.

**Mode full:** only for sections where you found a visual/adaptive issue
in the screenshots (do not read .tpl upfront — first look at screenshots, then
read .tpl only for those where there is something to fix).

**Mode visual:** only for sections where you found a visual issue in the
screenshot (do not read .tpl upfront — first look at screenshots, then read
.tpl only for those where there is something to fix).

```
Read: app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
```

## Step 4 — Analysis

### Default mode: sections with mechanical issues

Use context from report.json + screenshot + .tpl:

1. **What is visible in the screenshot** — one sentence
2. **Cause** — rely on `context.overflowCulprit`, `context.dsClasses`, `context.spacingMetrics` (paddingTop/paddingBottom), values from ds.json
3. **Fix** — specific file + specific change

Types of fixes:

**A. ds.json** — incorrect token value:
```
📍 app/src/companies-components-scope/{company}/style/ds.json
🔧 "h1-font-size": "104px" → "72px"
💡 At 104px, text longer than 15 characters overflows the 1440px container
```

**B. .tpl file** — issue in HTML structure:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add overflow-hidden to the root <section>
💡 Without overflow-hidden the element does not clip overflowing content
```

**C. index.ds.css.twig** — missing variable in DS:
```
📍 app/src/index.ds.css.twig
🔧 Add --{type}-{property} in @theme
💡 No way to control this property via ds.json
```

**spacing-anomaly** — abnormally large section padding:
```
📍 app/src/companies-components-scope/{company}/style/ds.json
🔧 "section-padding-block": "320px 200px" → ~80px (or check --section-padding-block in .tpl)
💡 context.spacingMetrics.paddingTop/paddingBottom — exact values. Padding > 200px creates huge empty zones
```

**element-overlap** — intersection of direct flow-child elements of the section:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Find element with negative margin-top or wrong position (not absolute) — remove negative margin
💡 Intersection > 10×10px in flow elements means content overlaps another block
```

### Default mode: sections with mobileIssues (mobile-overflow)

Look at mobile screenshot + `.tpl`. Typical causes:
- Fixed `width` or `min-width` without responsive
- Absolutely positioned element goes beyond 375px
- Image without `max-w-full` or `w-full`
- `whitespace-nowrap` on long text

```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add max-w-full to img, or remove fixed width: 800px
💡 On 375px, an element 800px wide causes horizontal scroll
```

### Default mode: sections with only codeIssues (code, not visual)

No screenshot needed — read only `.tpl`. Recommendation format:

**banned-typography** — prohibited Tailwind typography classes on headings:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Remove text-2xl, font-bold from <h2> — typography is set globally via DS
💡 Headings are styled via @layer base, Tailwind classes override DS
```

**dark-mode** — `dark:*` classes:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Remove dark:bg-gray-900, dark:text-white — dark mode is not supported
```

**hardcoded-colors** — hardcoded Tailwind colors:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Replace text-gray-600 with text-muted, bg-indigo-600 with btn-primary
💡 Colors are managed via DS variables and components
```

**missing-alt** — img without alt attribute:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add alt="" to decorative img, alt="description" to informative ones
💡 alt is required for accessibility and valid HTML
```

**non-ds-buttons** — buttons without btn-* classes:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Replace class="px-4 py-2 bg-blue-600 text-white" with class="btn-primary"
💡 DS components are managed via CSS variables, Tailwind classes bypass the system
```

**inline-styles** — inline styles with hardcoded values:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Remove style="color: #333; font-size: 18px" — use DS classes or CSS variables
💡 Inline styles have maximum priority and cannot be overridden via ds.json
```

**container-no-padding** — section content goes to the very edges of the viewport (no horizontal padding):
```
📍 app/src/generated-css-from-twig/{company}-ds.css
🔧 In company twig add getResponsiveMediaQuery("container-padding-inline", ...) in .container block and in :root container section
💡 Occurs when company-specific twig does not contain getResponsiveMediaQuery("container-padding-inline") — when CSS is regenerated via render-ds-css.mjs, padding-inline remains unset → fallback 1.5rem
```
Sign in screenshot: logo/text literally at the page edge (< 20px from edge) in ALL variants of the type simultaneously — this is a systemic DS issue, not a template issue.

**row-misalignment** — elements in a row (flex-row) visually shifted:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add text-align: start to the CSS block of the form/row, or class [text-left] on the element
💡 Inherited text-center from the parent aligns labels/captions to center instead of start
```
Signs in code: parent container has `text-center`, and the nested element (form, row, list) has no `text-left` / `text-start` override. Manifests as: form labels centered, icon captions shifted, row content displaced.

**heading-too-narrow** — heading block in a center-layout section occupies less than 50% of the width:

> **⚠️ USER REVIEW ONLY** — this is an observation for the user, NOT for automatic fixing.
> `max-w-*` on inner divs — intentional layout decisions. Change only upon explicit user request.
> Format: informational note with status `[review]`, without a "replace" directive.

```
⚠️ {type}/{variant} [review]
Note: heading block max-w-lg (~35% of container width) against a full-width
image — visual imbalance. Consider widening to max-w-3xl/4xl.
```
Applied **only** to sections with a centered layout (`text-center` + `items-center`) where **below the text block there is an image or content occupying the full width**. Violation thresholds:
- `max-w-lg` (512px) — violation ❌ (35% of 1440px)
- `max-w-xl` (576px) — violation ❌ (40%)
- `max-w-2xl` (672px) — violation ❌ (46%)
- `max-w-3xl` (768px) — warning ⚠️ (53%)
- `max-w-4xl` (896px) and wider — ✅ OK (≥62%)

**center-text-not-centered** — in a center-layout section, the heading is visually left-aligned:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add explicit text-center to the nested heading container (not only to the parent wrapper)
💡 Without explicit text-center on the nested element, DS styles or specificity may override inheritance
```
Sign: the section has `text-center` on the outer wrapper, but the nested `<div class="max-w-*">` or `<div class="max-w-* mx-auto">` has no `text-center` — and on the screenshot h1/h2 appears left-aligned within its container.

**heading-align-context** — heading alignment is inconsistent with the rest of the section content:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add --h1-text-align: start to the CSS block of the content container (or remove text-center from the heading block, if section content is left-aligned)
💡 DS applies --h1-text-align globally via .hero/.cta/etc — override in .tpl for sections with left-aligned layout
```
Sign: the rest of the content (buttons, description, form, cards) is left-aligned (`align-items: flex-start`, `text-left`), but the heading is visually centered due to the DS variable. Or the opposite: all content is centered but one element (heading/button) is on the left.
**Important:** always look at the WHOLE section content, not just the heading. Heading centering must match the alignment of surrounding elements. **Exception:** buttons and forms are acceptable NOT to center in sections with explicit `text-center` — they may remain left-aligned by design.

**missing-data-section** — no data-section on root element:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add data-section="{type}-{variant}" to the root <section>
💡 The attribute is needed for the CMS overlay and drag-and-drop interface
```

**heading-hierarchy** — gaps in heading levels:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Change <h4> → <h3> (cannot jump from h2 to h4)
💡 Heading hierarchy is critical for accessibility and SEO
```

**btn-on-non-interactive** — btn-* class on `<span>/<div>/<li>` instead of `icon-box-*`:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Replace class="btn-light inline-flex w-10 h-10 rounded-full p-0" with class="icon-box-light"
💡 btn-* is semantically a button (interactive element), icon-box-* is a decorative icon wrapper
```

**hardcoded-colors (border/divide)** — hardcoded divider colors:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Replace border-neutral-200, divide-neutral-200 with border-[var(--divider-color)], divide-[var(--divider-color)]
💡 When changing the DS theme, hardcoded colors will not update
```

**spacing-anomaly** — section padding > 100px (warning):
```
📍 app/src/companies-components-scope/{company}/style/ds.json
🔧 Check context.spacingMetrics.paddingTop/paddingBottom. If > 100px — reduce "section-padding-block"
💡 On mobile, padding > 100px above/below a section creates a feeling of emptiness
```

### Default mode: OK sections (quick check)

Look at 1-2 screenshots. If visually everything is fine — just list them as OK.
If you noticed a problem that Phase 1 missed — add ⚠️.

### Mode full — OK sections: adaptive scan

For the 3 selected variants, compare all three viewports:

1. **Desktop vs Mobile** — does the layout restructure correctly? Is there no content loss?
2. **Readability at @375** — heading not too small/large, text not truncated
3. **Tablet @768** — intermediate layout looks logical (not broken grid)?
4. **Buttons on mobile** — large enough for touch (min 44px), not overlapping?
5. **Images** — correct proportions on all viewports?

If you found an adaptive issue that Phase 1 did not catch — flag `[visual-ai]`:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 {specific change}
💡 At @375px: {what exactly looks bad}
```

If all three viewports look fine — briefly note what was checked:
```
✅ {variant} — desktop/tablet/mobile OK
```

If only some variants were checked — add at the end:
```
📱 Adaptive checked on {N} of {total} variants (representative sample)
```

### Type Consistency (all modes)

If there are multiple variants — assess in one sentence:
- Are the spacing and rhythm the same?
- Buttons of the same weight?
- Typographic hierarchy matches?

---

### mode: visual — Active Visual Scan

For each screenshot apply the visual checklist:

1. **Layout** — elements are balanced, no empty zones, nothing overlaps
2. **Typography** — heading stands out, text is readable, hierarchy is felt
3. **Components** — buttons/cards/chips look like DS components, not raw HTML
4. **Spacing** — not too tight and not too spacious (section padding is felt)
5. **Overall quality** — the section looks like a production-ready landing, not a draft

If Phase 1 already recorded an issue (`ok: false`) — mention it briefly, then
add your visual observation: what exactly spoils the look in the screenshot.

If you found a visual issue in the screenshot — read `.tpl` and give a specific
recommendation. Mark such issues `[visual-ai]` to distinguish them from Phase 1.

Typical visual issues (Phase 1 does not catch these):
- h2 too large/small relative to body text (hierarchy violation)
- Cards/columns of uneven height without align-items: stretch
- Placeholder image fits poorly in the layout (wrong proportions)
- Button looks like a raw link (no visual weight)
- Section too tall with little content (lots of empty space)
- Icons too small or too large relative to adjacent text
- Spacing between cards in a grid is inconsistent (gap not unified)
- Text is truncated or overlaps an adjacent element
- Anomalous spacing: huge empty zone above/below the section (content in the center of the screen)
- Cards in a grid are stuck together without gap (all elements are flush against each other)
- Block not aligned to center/left relative to the rest of the content
- Text block pushed to the edge without padding (text touches the section border)
- **[row-misalignment]** Elements in a row (flex-row) shifted: labels/captions centered instead of left-aligned, form content displaced from expected position — check text-center inheritance from parent
- **[heading-too-narrow]** In a centered section, the heading block occupies less than 50% of the width against a wide image below — a narrow strip of text looks unbalanced (max-w-lg/max-w-2xl instead of min max-w-4xl)
- **[center-text-not-centered]** In a centered section (text-center wrapper), the heading or description is visually pushed to the left edge of its container — explicit text-center is missing on the nested div
- **[heading-align-context]** Heading alignment is inconsistent with the rest of the content: all section content is left-aligned (`align-items: flex-start`, `flex-direction: column` without `items-center`), but h1/h2 is centered due to the DS variable — or the opposite. Always check heading alignment relative to neighboring elements (buttons, description, form). Buttons in sections with text-center are acceptable NOT to center.
- **[container-no-padding]** Content in ALL type variants goes to the very edge of the viewport (< 20px left/right) — systemic DS issue: container-padding-inline is not generated in CSS. Cause: company-specific twig does not contain `getResponsiveMediaQuery("container-padding-inline", ...)` — needs to be added to both blocks (`:root` and `.container`) in company twig and CSS regenerated

Example `[visual-ai]` recommendation:
```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 Add items-stretch to the flex container of cards — cards are of different heights
💡 In the screenshot: the right card is noticeably shorter than the left, layout looks unbalanced
```

## Step 5 — Return Markdown Block

Return **only markdown**, without wrappers.

### Format (default mode):

```markdown
### {type} ({N} variants, {issues} issues)

**Consistency:** ✅ Uniform / ⚠️ Differences in spacing / ❌ Strong discrepancies

{one sentence about the type overall, if there is something to say}

#### ❌ {type}/{variant}

**Screenshot:** {one sentence — what exactly is wrong visually}

**Fix:**
📍 `{filepath}`
```json
"key": "old" → "new"
```

#### ❌ {type}/{variant} [mobile]

**Screenshot 375px:** {one sentence — what exactly goes off-screen}

**Fix:**
📍 `{filepath}`
🔧 {specific change}

#### ❌ {type}/{variant} [code]

**Code issue:** banned-typography — `h2.text-2xl, h2.font-bold`

**Fix:**
📍 `{filepath}`
🔧 Remove `text-2xl`, `font-bold` from `<h2>` — typography is set via DS

#### ⚠️ {type}/{variant}

**Note:** {what is not critical but worth fixing}
📍 `{filepath}` — {what to change}

✅ No issues: {variant1}, {variant2}, {variant3}
```

### Format (mode: full):

```markdown
### {type} ({N} variants) [full]

**Consistency:** ✅ Uniform / ⚠️ Differences in spacing / ❌ Strong discrepancies

{one sentence about the type overall}

{blocks for problematic sections — same as default mode}

#### Adaptive (sample: {variant1}, {variant2}, {variant3})

✅ {variant1} — desktop/tablet/mobile OK
⚠️ {variant2} [visual-ai, mobile]

**Screenshot @375:** {one sentence — what exactly looks bad}

**Fix:**
📍 `{filepath}`
🔧 {specific change}
💡 At @375px: {what exactly}

📱 Adaptive checked on 3 of {total} variants (representative sample)

✅ No issues: {variant1}, {variant2}, ...
```

### Format (mode: visual):

```markdown
### {type} ({N} variants) [visual scan]

**Consistency:** ✅ Uniform / ⚠️ Differences in spacing / ❌ Strong discrepancies

{one sentence about the type overall}

#### ❌ {type}/{variant} [visual-ai]

**Screenshot:** {one sentence — what exactly looks bad}

**Fix:**
📍 `{filepath}`
🔧 {specific change}
💡 {why this matters visually}

#### ❌ {type}/{variant} [Phase 1 + visual-ai]

**Phase 1:** {issue type from report.json briefly}
**Screenshot:** {what visual analysis adds}

**Fix:**
📍 `{filepath}`
🔧 {specific change}

#### ⚠️ {type}/{variant} [visual-ai]

**Note:** {not critical but spoils the look}
📍 `{filepath}` — {what to change}

✅ visual OK: {variant1}, {variant2}, {variant3}
```

**Rules (general):**
- First ❌, then ⚠️, at the end — a line `✅ No issues: ...` or `✅ visual OK: ...`
- For sections with only `mobileIssues` — add `[mobile]` in the heading
- For sections with only `tabletIssues` — add `[tablet]` in the heading
- For sections with only `codeIssues` — add `[code]` in the heading, do not describe screenshots
- One recommendation = one file + specific change
- If multiple variants have the same issue — one block, list all affected
- Maximally specific, minimally descriptive

---

## False Positives — DO NOT recommend fixing

Before forming recommendations, check each issue for false positives.

### 1:1 contrast in sections with background images (false positive)

If `issues` or `codeIssues` contains `low-contrast` with ratio `1:1` — **this is a false positive**.

Reason: the checker calculates text color against the gray background of a placeholder image (placehold.co)
instead of the real dark overlay. It is physically impossible for the ratio to be exactly 1:1 — this
means the checker could not get the real background.

**Signs of a false positive:**
- ratio `1:1` or `1.0:1`
- Section has background-image with overlay (`.bg-black/50`, `rgba(0,0,0,...)`, `bg-gradient-to-...`)
- Text is **readable** in the screenshot (white text over dark overlay)

If all three signs are present — **skip** this issue entirely, do not include it in recommendations.
Add only at the end of the block: `ℹ️ low-contrast 1:1 — false positive (overlay section, placeholder image)`.

### Sections with gradient background — special attention to contrast

**Special case:** sections with `background: linear-gradient(...)` or `background-image: gradient`
with a dark background, but the heading/text remains in the DS dark color (not overridden to white).

`getEffectiveBg` in the checker takes the first gradient color as background — check the screenshot:
if the text is dark on a dark gradient → recommend adding CSS variables in the section `<style>`:

```
📍 app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
🔧 In <style> add: --h2-color: var(--color-neutral); --text-lead-color: var(--color-neutral);
💡 h2 uses var(--h2-color) from DS (dark), does not inherit color: white from parent
```

**Signs of the issue in the screenshot:**
- Section background is dark (dark gradient, dark image)
- Heading is barely visible (dark text on dark background)
- `color: var(--color-neutral)` on the root element does not help — h2 uses `var(--h2-color)`

### heading-too-narrow — USER REVIEW only, NOT for ds-fixer

`heading-too-narrow` — an observation for **manual user review**. Do NOT add it
to the "Fix" section with directive commands like "🔧 Replace max-w-lg → max-w-4xl".

`max-w-*` values on inner divs — **intentional layout decisions**, protected by the rule
`.claude/rules/container-stability.md`. Changing without explicit request breaks template stability.

Use only the informational status `[review]`:
```
⚠️ {type}/{variant} [review]
Note: heading block max-w-lg (~35% of container width) looks visually narrow
against a full-width image. Consider widening to max-w-3xl/4xl.
```

### Footer/header height < 80px (false positive for normal compact design)

If a footer section has height ~48-60px and this is a **compact/minimal-bar** variant —
this may be intentional design (a single line with copyright). Look at the screenshot:
if the content is fully visible and logically placed — do not flag as an error.

Flag as an error only if: the section is truncated, content goes beyond bounds, or padding is zero
with significant content (multiple lines, a grid of links).
