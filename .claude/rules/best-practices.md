# Important Practices

1. **DRY** — don't duplicate code, extract common parts into components
2. **Logical CSS properties** — margin-block-start instead of margin-top
3. **Lint check** — after changes run `pnpm -C app check`

## CSS

- **Never** `transition: all` — list specific properties
- `tabular-nums` for columns with numbers (prices, dates, IDs)
- `touch-action: manipulation` for buttons on touch devices (removes 300ms delay)

```css
.price-column {
  font-variant-numeric: tabular-nums;
}

.btn {
  touch-action: manipulation;
}
```

## Content

- Long text — `text-overflow: ellipsis` or `line-clamp`
- Empty states — always account for empty state
- Images — explicit `width`/`height` to prevent layout shift

```css
.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

## Comments

Don't leave obvious comments. Code should be self-documenting.

```js
// Bad — comment duplicates the code
// Get element by id
const element = document.getElementById('modal');

// Increment counter
counter++;

// Bad — comment describes the obvious
// Add click handler
button.addEventListener('click', handler);

// Good — comment explains WHY, not WHAT
// setTimeout is needed to wait for the CSS animation to finish
setTimeout(cleanup, 300);

// Edge case: element may be absent during fast navigation
if (!element) return;

// Workaround for a Safari bug with position: sticky
const offset = isSafari ? 1 : 0;
```

**When comments are needed:**
- Explaining non-obvious logic
- Workarounds and hacks with a reason
- TODO with task description
- Links to issue/documentation
