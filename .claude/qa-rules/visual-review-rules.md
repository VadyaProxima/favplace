# Visual Review Rules

AI agent checklist for the ANALYZE phase. Each question is yes/no.
Screenshots are provided per viewport (desktop 1440, tablet 768, mobile 375) and per theme (light, dark, accent).

---

## 1. Per-Theme Checks

Run for each theme: **light**, **dark**, **accent**.

### Text Readability
- [ ] Is ALL body text clearly readable against the section background?
  - "Looks wrong": gray text on slightly darker gray bg, text blending into gradient
- [ ] Is ALL heading text clearly readable?
  - "Looks wrong": heading same color as background, white heading on light section
- [ ] Are secondary/muted text elements still readable (not invisible)?
  - "Looks wrong": placeholder text, captions, or labels that disappear into bg

### Button Visibility
- [ ] Are primary buttons visually distinct from the background?
  - "Looks wrong": dark button on dark section, white button on white section, button outline matching bg exactly
- [ ] Is button text readable against the button background?
  - "Looks wrong": white text on light-yellow button, dark text on dark-blue button
- [ ] Are secondary/outline buttons visible?
  - "Looks wrong": border color same as background, ghost button text invisible

### Card/Surface Elements
- [ ] Are cards/surfaces visually distinguishable from the section background?
  - "Looks wrong": white card on white section with no shadow/border, dark card on dark section
- [ ] Is text inside cards readable against the card background?
- [ ] Are card borders or shadows visible when needed for separation?

### Links and Interactive Elements
- [ ] Are links visually identifiable (color, underline, or other indicator)?
  - "Looks wrong": link text same color as body text with no underline
- [ ] Are focus/hover states present and visible? (Check if defined in CSS)

### Icons and Decorations
- [ ] Are icons visible against their background?
  - "Looks wrong": dark icon on dark bg, light icon on light bg
- [ ] Do SVG icons use `currentColor` or adapt to theme?

### Overlay Sections (hero, banner with background-image)
- [ ] Is the overlay gradient dark/light enough for text readability?
  - "Looks wrong": text directly on image without sufficient overlay
- [ ] Are buttons on overlays visible and have sufficient contrast?
- [ ] Are chips/badges/tags on overlays readable?

---

## 2. Per-Viewport Checks

Run for each viewport: **desktop (1440px)**, **tablet (768px)**, **mobile (375px)**.

### Layout Integrity
- [ ] Does the section fill the viewport width without horizontal scroll?
  - "Looks wrong": content extends past right edge, horizontal scrollbar visible
- [ ] Are all elements contained within the section boundaries?
  - "Looks wrong": text or images clipped on the right, elements overlapping section edge
- [ ] Is the grid/flex layout intact (no collapsed or overlapping columns)?
  - "Looks wrong": 3-column layout where one column overlaps another, cards stacking incorrectly

### Spacing and Proportions
- [ ] Is padding proportional to the viewport? (Not too tight on mobile, not too loose on desktop)
  - "Looks wrong": 2px padding on mobile, 200px gaps between elements on desktop
- [ ] Are gaps between cards/items consistent?
  - "Looks wrong": uneven spacing, some cards touching while others have gaps
- [ ] Does the section have appropriate vertical rhythm?

### Text Sizing
- [ ] Are headings appropriately sized for the viewport?
  - "Looks wrong": desktop-sized heading on mobile (overflows or wraps excessively)
- [ ] Is body text readable without zooming on mobile (>= 14px equivalent)?
- [ ] Do long words or URLs break layout on mobile?
  - "Looks wrong": single long word pushes container wider than viewport

### Images and Media
- [ ] Do images scale properly without distortion?
  - "Looks wrong": stretched, squished, or pixelated images
- [ ] Are images cropped appropriately at each viewport?
- [ ] Do image aspect ratios stay consistent?

### Navigation (header/footer)
- [ ] Is navigation usable at this viewport?
  - "Looks wrong": nav items overlapping, hamburger menu items inaccessible
- [ ] Does the footer stack properly on mobile?
  - "Looks wrong": footer columns side-by-side at 375px, text cut off

---

## 3. Cross-Theme Comparison

Compare the same section across light, dark, and accent themes.

### Structural Consistency
- [ ] Is the layout identical across all 3 themes? (Same grid, same spacing, same element positions)
  - "Looks wrong": cards are 3-column in light but 2-column in dark (layout shift from theme change)
- [ ] Are image sizes and positions consistent?

### Token Coverage
- [ ] Do ALL text elements change color appropriately per theme?
  - "Looks wrong": one paragraph stays black in dark theme (hardcoded color)
- [ ] Do ALL backgrounds change per theme?
  - "Looks wrong": card background stays white in dark theme
- [ ] Do ALL buttons adapt to theme?
  - "Looks wrong": button stays the same color in all themes (not using theme tokens)
- [ ] Do ALL borders/dividers adapt?
  - "Looks wrong": dark border on dark background in dark theme

### No Hardcoded Colors
- [ ] Is there any element that does NOT change between themes?
  - Flag it: likely a hardcoded color instead of a CSS variable/theme token.
  - Common culprits: SVG fill/stroke, inline styles, background-color on nested divs

---

## 4. Rubber Visual Check

For rubber companies (minimal, avito, pik) — proportional scaling verification.

### Proportional Scaling
- [ ] Do elements scale proportionally when viewport changes from 1440 to 1920?
  - "Looks wrong": text stays fixed size while containers grow, creating disproportionate whitespace
- [ ] Do elements scale down proportionally at smaller viewports (down to 768)?
- [ ] At mobile (375px), does the mobile rubber formula take over?
  - "Looks wrong": elements microscopic at mobile (using desktop formula)

### No Fixed-Size Artifacts
- [ ] Are there any elements that stay fixed-size while siblings scale?
  - "Looks wrong": icon stays 24px while surrounding text and padding scale with viewport
- [ ] Do borders/dividers remain reasonable thickness at all sizes?

---

## 5. Component Quality

### Buttons
- [ ] Do buttons have sufficient padding (not too cramped, not too spacious)?
- [ ] Is button text properly centered vertically and horizontally?
- [ ] Do buttons maintain minimum touch target size (44x44px equivalent) on mobile?

### Cards
- [ ] Is card content properly aligned (text left-aligned, images top or centered)?
- [ ] Are card heights consistent in a row (either equal height or masonry-intentional)?
  - "Looks wrong": one card twice the height of siblings due to content overflow
- [ ] Do card images maintain aspect ratio?

### Forms
- [ ] Are input fields properly sized and spaced?
- [ ] Are labels clearly associated with their inputs?
- [ ] Is placeholder text visible but not mistaken for filled input?

### Lists and Grids
- [ ] Are list markers/numbers aligned properly?
- [ ] In multi-column grids, is content evenly distributed?
- [ ] Do last-row items align properly (not stretched to fill)?

---

## 6. Severity Classification

When reporting issues found during visual review:

| Severity | Criteria | Examples |
|----------|----------|---------|
| **critical** | Content invisible or layout completely broken | Invisible text, white-on-white button, horizontal scroll, collapsed section |
| **major** | Usability significantly impaired | Low-contrast text (readable but straining), overlapping elements, broken grid on mobile |
| **minor** | Cosmetic issue, not blocking | Slightly uneven spacing, subtle color mismatch between themes, icon 1px misaligned |
| **info** | Potential improvement, not a defect | Could benefit from more padding, text could be larger on mobile |

**Priority for fixing:**
1. critical + error from automated checks
2. major + issues present in multiple themes
3. major + single theme/viewport
4. minor across all viewports
5. minor single viewport
6. info
