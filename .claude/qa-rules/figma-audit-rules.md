# Figma Audit — Structural Match Rules

**IMPORTANT: Before starting any figma-audit, read `figma-audit-phases.md` for mandatory phase checklist.**

## Purpose
You are an AI agent comparing a Figma mockup with a browser-rendered section.
Your job: identify STRUCTURAL differences, not content/text differences.

## What to check

### Layout structure
- Grid columns: same count? (e.g., 3 cards in Figma vs 2 in browser)
- Element order: header → content → CTA matches?
- Alignment: centered vs left-aligned elements
- Stacking: elements that should be side-by-side are stacked (or vice versa)

### Visual hierarchy
- Heading is visually dominant (largest text in section)
- Subheading is clearly smaller than heading
- Body text is clearly smaller than subheading
- CTA button is visually prominent

### Element presence
- All major elements from Figma exist in browser render
- No extra elements in browser that aren't in Figma
- Icons/images in correct positions

### Proportions
- Image/content ratio roughly matches Figma
- Card heights appear uniform (if grid)
- Spacing between major blocks is proportional

## What to IGNORE
- Text content differences (Figma has real text, browser has placeholders)
- Exact pixel measurements (handled by computed styles comparison)
- Color differences (handled by token audit)
- Font rendering differences between Figma and browser
- Minor spacing differences < 5px

## Output format
Return JSON array:
```json
[
  {
    "issue": "Grid shows 2 columns in browser vs 3 in Figma",
    "severity": "critical",
    "element": "card grid",
    "viewport": "1440"
  }
]
```
Return empty array `[]` if no structural issues found.

## Severity guide
- **critical**: Layout structure completely different (wrong grid, missing major element)
- **warning**: Proportions noticeably different, alignment off
- **info**: Minor structural difference, possibly acceptable
