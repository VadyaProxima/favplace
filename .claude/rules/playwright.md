---
paths: tests/**, app/tests/**
---

# Playwright — Working Rules

## Screen size

**Always set viewport BEFORE navigating** — resizing after page load does not apply media queries correctly, content gets clipped instead of adapting.

```js
// Correct
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/src/pages/minimal/');

// Incorrect — resize after load does not trigger media queries
await page.goto('...');
await page.setViewportSize({ width: 1440, height: 900 }); // ❌
```

Standard size for checks: **1440×900**.

## Screenshot of a specific section

**Do not use `scrollIntoView` + viewport screenshot** — fill-content is asynchronous, the section may be out of frame.

**Correct approach:** wait for fill-content, calculate absolute coordinates, use `clip`.

```js
async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/src/pages/minimal/');

  // Wait for fill-content — verify text is no longer a placeholder
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-cms-section="hero.center-showcase"] h1');
    return el && el.textContent.trim() !== '[Hero Title]';
  }, { timeout: 10000 });
  await page.waitForTimeout(500);

  // Absolute coordinates of the section
  const box = await page.evaluate(() => {
    const s = document.querySelector('[data-cms-section="hero.center-showcase"]');
    const r = s.getBoundingClientRect();
    return { top: r.top + window.pageYOffset, height: r.height };
  });

  // Screenshot with clip
  await page.screenshot({
    path: 'check.jpeg',
    type: 'jpeg',
    quality: 90,
    clip: { x: 0, y: box.top, width: 1440, height: box.height },
    fullPage: true,
  });
}
```

## Closing the browser

### Headless Chromium (agents — always this way)

Always call `await browser.close()` at the end of the Bash script:

```js
await browser.close();
```

The process is isolated — closing it does not affect other agents or sessions.

### MCP Playwright (single-agent interactive sessions only)

After all checks are complete, close with:

```js
await mcp__playwright__browser_close();
```

Do not leave open browser sessions between tasks.

## Parallel Agents — Never Use MCP Playwright

**`mcp__playwright__*` tools use a SHARED browser instance.**
When multiple agents run in parallel, they will conflict:
- Agent A navigates to page X, Agent B immediately navigates to page Y
- Agent A calls `browser_close`, Agent B's session is destroyed

**Rule: agents that run in parallel MUST use headless Chromium via Bash script.**
Only use `mcp__playwright__*` tools in single-agent interactive sessions (e.g. `/export-section`).
