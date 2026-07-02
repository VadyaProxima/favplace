---
allowed-tools: mcp__browserforce__*
description: Export a section from a website via BrowserForce MCP
---

Export HTML markup of a section from an external website.

## Input

```
$ARGUMENTS
```

Format: `URL SELECTOR` or `URL` (then ask for the selector)

Examples:
- `https://pik.ru .footer`
- `https://example.com #header`
- `https://site.com section.hero`

## Algorithm

### 1. Call mcp_browserforce_execute

Pass JavaScript that:

1. Creates or reuses `state.page`
2. Navigates to `URL`
3. Waits for load: `await waitForPageLoad()`
4. Finds the element by selector: `state.page.locator(SELECTOR).first()`
5. Calls `element.evaluate(el => el.outerHTML)`
6. Returns the result as-is

### 2. Code for execute

```javascript
if (!state.page || state.page.isClosed()) {
  state.page = context.pages().find(p => p.url() === 'about:blank') || await context.newPage();
}
await state.page.goto(URL);
await waitForPageLoad();
const el = await state.page.locator(SELECTOR).first();
if (!(await el.count())) return "DOM not accessible";
return await el.evaluate(node => node.outerHTML);
```

Substitute `URL` and `SELECTOR` from the arguments.

### 3. Result

Return the **exact** tool output. Do not modify, format, or append anything.

If the element is not found — return: `DOM not accessible`

## Prohibited

- Reconstructing the markup
- Changing classes or structure
- Adding explanations to HTML
- Wrapping in markdown (code blocks)
