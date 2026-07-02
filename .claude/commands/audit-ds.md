---
allowed-tools: Bash(pnpm:*), Bash(node:*), Bash(ls:*), Bash(grep:*), Read, Grep, Glob, Agent
description: Cross-company DS audit — validate consistency across all design systems
---

Audit design system consistency across companies.

## Arguments

`$ARGUMENTS` — optional company name or `all` (default: `all`)

```
/audit-ds              → audit all companies (minimal, avito, pik)
/audit-ds minimal      → single company
/audit-ds all          → explicit all
```

## Companies with DS

Only companies with rendered DS (have `style/ds.json` + twig):
- `minimal` — base library (444 templates)
- `avito` — full DS
- `pik` — full DS

---

## Phase 1 — Per-company validation (parallel)

For each company, run the existing validation script:

```bash
pnpm -C app ds:validate {company}
```

**If auditing all companies** — run all three in parallel via separate Bash calls in one message:

```bash
pnpm -C app ds:validate minimal 2>&1 | tee /tmp/audit-minimal.txt
```
```bash
pnpm -C app ds:validate avito 2>&1 | tee /tmp/audit-avito.txt
```
```bash
pnpm -C app ds:validate pik 2>&1 | tee /tmp/audit-pik.txt
```

Collect results from each.

---

## Phase 2 — Cross-company consistency checks

These checks compare STATE across companies. Run them yourself (not via script).

### 2.1 Font CDN consistency

```bash
grep -h "template_assets_host" app/src/companies-components-scope/*/style/ds.json
```

All companies should use the same CDN host. If different — flag it.

### 2.2 Shared DS token coverage

Check that critical tokens exist in ALL companies' ds.json:

```bash
for company in minimal avito pik; do
  echo "=== $company ==="
  node -e "
    const ds = require('./app/src/companies-components-scope/$company/style/ds.json');
    const tokens = ['color-primary-500','btn-radius','font-primary','color-background'];
    tokens.forEach(t => console.log('  ' + t + ':', ds[t] || 'MISSING'));
  "
done
```

Missing critical tokens → warning.

### 2.3 Twig sync status

```bash
node app/scripts/check-twig-sync.mjs
```

Any desync → warning with affected company.

### 2.4 Template count summary

```bash
for company in minimal avito pik; do
  echo -n "$company: "
  node -e "
    const t = require('./app/src/companies-components-scope/$company/templates.json');
    const own = t.filter(e => !e.source_company).length;
    const cross = t.filter(e => e.source_company).length;
    console.log(own + ' own + ' + cross + ' cross-company = ' + t.length + ' total');
  "
done
```

### 2.5 Orphan .tpl files (no templates.json entry)

For each company, find .tpl files that exist on disk but have no entry in templates.json:

```bash
for company in minimal avito pik; do
  echo "=== $company ==="
  node -e "
    const fs = require('fs');
    const path = require('path');
    const dir = 'app/src/companies-components-scope/$company';
    const registry = JSON.parse(fs.readFileSync(path.join(dir, 'templates.json'), 'utf-8'));
    const registered = new Set(registry.map(e => e.template));

    function walk(d) {
      for (const e of fs.readdirSync(d, {withFileTypes:true})) {
        if (e.name === 'style') continue;
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name === 'index.tpl') {
          const rel = path.relative(dir, full).replace(/\\\\/g, '/');
          if (!registered.has(rel)) console.log('  ORPHAN:', rel);
        }
      }
    }
    walk(dir);
  "
done
```

### 2.6 remove_background consistency (pik cross-company)

If pik has cross-company entries from minimal — verify remove_background is explicitly set:

```bash
node -e "
  const pik = require('./app/src/companies-components-scope/pik/templates.json');
  const cross = pik.filter(e => e.source_company);
  const noRb = cross.filter(e => !e.images?.every(img => 'remove_background' in img));
  if (noRb.length) {
    console.log(noRb.length + ' cross-company entries missing explicit remove_background:');
    noRb.slice(0,5).forEach(e => console.log('  ' + e.template));
    if (noRb.length > 5) console.log('  ... and ' + (noRb.length-5) + ' more');
  } else {
    console.log('OK — all ' + cross.length + ' cross-company entries have remove_background set');
  }
"
```

---

## Phase 3 — Report

Present a structured summary:

```
## DS Audit Report

### Per-company validation
| Company | Errors | Warnings | Status |
|---------|--------|----------|--------|
| minimal | 0      | 2        | ⚠️     |
| avito   | 0      | 0        | ✅     |
| pik     | 1      | 3        | ❌     |

### Cross-company checks
| Check                    | Status | Details              |
|--------------------------|--------|----------------------|
| Font CDN                 | ✅     | All use same host    |
| Critical tokens          | ⚠️     | pik missing btn-radius |
| Twig sync                | ✅     | All synchronized     |
| Orphan .tpl files        | ✅     | None found           |
| remove_background (pik)  | ⚠️     | 3 entries missing    |

### Template counts
| Company | Own | Cross-company | Total |
|---------|-----|---------------|-------|
| minimal | 444 | 0             | 444   |
| avito   | 18  | 0             | 18    |
| pik     | 29  | 78            | 107   |

### Issues requiring attention
1. {issue description + fix suggestion}
2. ...
```

---

## Error Handling

- If `ds:validate` fails for a company — report the error, continue with other companies
- If a ds.json file is missing — skip that company, report
- Use `require()` syntax (not import) in inline node -e scripts for simplicity
