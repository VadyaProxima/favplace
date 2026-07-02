# Accessibility

## Semantics matter

```html
<!-- Bad -->
<div role="button" tabindex="0">

<!-- Good -->
<button type="button">
```

Use native elements: `<button>`, `<a>`, `<input>`, `<select>`.

## Focus states

```css
/* Bad — removes focus for everyone */
*:focus {
  outline: none;
}

/* Good — only for mouse, preserves keyboard focus */
.button:focus {
  outline: none;
}

.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

Use `:focus-visible` instead of `:focus` — shows outline only during keyboard navigation.

## Forms

```html
<!-- Label linked to input -->
<label for="email">Email</label>
<input
  id="email"
  type="email"
  autocomplete="email"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">Invalid format</span>
```

- `autocomplete` for all inputs (email, name, tel, address)
- Correct `type` (email, tel, url, search)
- `aria-describedby` to associate with error messages
- `spellcheck="false"` for passwords and codes

## Headings

Hierarchy without gaps: h1 → h2 → h3. Do not use h3 after h1.

For sections (except hero), use h2 -> h3 -> * headings.

## Images

```html
<!-- Decorative -->
<img src="pattern.svg" alt="" aria-hidden="true" />

<!-- Informative -->
<img src="chart.png" alt="Sales chart for 2024" />
```

## Animations

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Disable animations for users with `prefers-reduced-motion`.
