---
paths: src/**/*.twig, src/**/ds.json
---

# DS Token Workflow

## Когда использовать ds:add-token

При добавлении нового CSS-токена в design system компании — вместо ручных правок в 3 файлах.

## Команда

```bash
pnpm -C app ds:add-token <token-name> <default-value> [--company=minimal]
```

### Примеры

```bash
pnpm -C app ds:add-token btn-shadow "none" --company=minimal
pnpm -C app ds:add-token text-display-m-color "var(--color-neutral-900)" --company=minimal
pnpm -C app ds:add-token card-gap "1rem" --company=minimal
pnpm -C app ds:add-token h1-font-size "2.5rem" --company=minimal   # responsive (ends with -font-size)
```

## Что делает скрипт

Атомарно добавляет токен в 3 места одновременно:

| Место | Что добавляет |
|-------|--------------|
| `style/ds.json` | `"token-name": "value"` после последнего токена с тем же префиксом |
| company twig `@theme` | `--token-name: value;` в статичный CSS-блок |
| company twig `:root` | `--token-name: {{ ds["token-name"]|default("value") }};` в ds-блок |

Для токенов, заканчивающихся на `-font-size`, в `:root` используется `getResponsiveMediaQuery`.

## После добавления — обязательно

```bash
node app/scripts/render-ds-css.mjs minimal --out app/src/generated-css-from-twig/minimal-ds.css
pnpm -C app ds:validate minimal
```

## Когда НЕ использовать (нужна ручная правка)

**Responsive font-size:** скрипт добавит `getResponsiveMediaQuery`, но нужно вручную добавить в `app/scripts/ds-rubber.mjs` → `RUBBER_PROPERTIES`:
```js
{
  prop: "token-name",
  scope: "root",
  default: "1rem",
  defaultMobile: null,
}
```

**Токен нужен в main twig** (`app/src/index.ds.css.twig`): `ds:add-token` трогает только company twig. После добавления в main twig → делегировать агенту `twig-sync`.

**Новый `@utility` класс** (компонент): архитектурное изменение, делать вручную в twig.

**Новая utility + переменные для нового компонента** (например `text-display-l`): нужно добавить CSS-правило `.text-display-l { ... }` в company twig вручную — рядом с другими text utilities (grep по `text-display-l` в minimal twig для точной строки). `ds:add-token` добавляет только переменные, а не CSS-классы.

**Секционные переменные** (`sections.hero["my-var"]`): другой синтаксис, скрипт не поддерживает.

## Нейминг токенов

Паттерн: `--{component}-{property}`

```
text-display-m-color        → prefix: text-display
btn-primary-shadow          → prefix: btn-primary
card-gap                    → prefix: card
h7-font-size                → prefix: h7
icon-box-primary-color      → prefix: icon-box
```
