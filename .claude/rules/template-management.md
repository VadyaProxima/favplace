---
paths: src/**/*.tpl, src/**/templates.json, src/**/template.json
---

# Template Management

## Removing a section

When removing a section `{company}/{type}/{variant}`, all 5 connection points must be cleaned up.

### Removal checklist

```
□ 1. Delete the section files
□ 2. Remove @import from pages/{company}/index.html
□ 3. Remove @import from pages/avito-full/index.html (if present)
□ 4. Remove @import from pages/pik-full/index.html (if present)
□ 5. Delete the entry from companies-components-scope/{company}/templates.json
```

### Steps with commands

#### 1. Delete files

```bash
rm app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl
rm app/src/companies-components-scope/{company}/{type}/{variant}/template.json
rmdir app/src/companies-components-scope/{company}/{type}/{variant}
```

If the `{type}` folder is now empty — delete it too.

#### 2. Find all @imports

**Always** grep the entire `app/src/` before making edits:

```bash
grep -r "{type}/{variant}" src/pages/
```

This will show ALL HTML files with @import — not just the obvious ones.
Pages that may contain @import of minimal sections:

| File | When it contains |
|------|-----------------|
| `app/src/pages/minimal/index.html` | always |
| `app/src/pages/avito-full/index.html` | if section is from minimal |
| `app/src/pages/pik-full/index.html` | if section is from minimal |
| `app/src/pages/minimal/test-site-*.html` | generated (untracked, do not touch) |

#### 3. Remove @import lines

```bash
sed -i '' '/{type}\/{variant}\/index\.tpl/d' src/pages/minimal/index.html src/pages/avito-full/index.html src/pages/pik-full/index.html
```

#### 4. Delete the entry from templates.json

Find the block by `"template": "{type}/{variant}/index.tpl"` and delete the entire `{ ... }` object including the preceding or following comma.

#### 5. Verify after removal

```bash
grep -r "{type}/{variant}" src/
```

Should return an empty result (except test-site-*.html and the global app/src/templates.json).

---

## Cross-company templates (`source_company`)

A company can reference templates from another company (e.g. pik using minimal sections) **without duplicating `.tpl` files** in the source tree.

### How it works

1. **`templates.json` entry** — add `"source_company": "minimal"` to the entry. The `template` path stays the same (e.g. `"hero/center-content/index.tpl"`).
2. **`export-ds.mjs`** — at export time, copies `.tpl` files from the source company into the ZIP for any entry with `source_company`.
3. **No `template.json`** needed — cross-company entries have no per-template file in the company directory. All metadata lives only in `{company}/templates.json`.

### When to use

- Company wants sections from minimal without forking the `.tpl` files
- Company needs different image settings (e.g. `remove_background`) than the source company
- No intent to customize the template HTML — only metadata differs

### Adding a cross-company entry

```python
# Script pattern to add minimal sections to pik/templates.json
import json, uuid

with open('app/src/companies-components-scope/minimal/templates.json') as f:
    minimal = json.load(f)
with open('app/src/companies-components-scope/pik/templates.json') as f:
    pik = json.load(f)

existing = {t.get('template') for t in pik}
new_entries = []

for entry in minimal:
    if entry.get('category') not in ['hero', 'features', 'portfolio']:  # desired categories
        continue
    if entry.get('template') in existing:
        continue  # already exists (pik-specific version takes precedence)
    new_entry = {**entry}
    new_entry['id'] = str(uuid.uuid4())
    new_entry['name'] = 'Pik ' + entry['name']
    new_entry['source_company'] = 'minimal'
    new_entry['images'] = [{**img, 'remove_background': False} for img in entry.get('images', [])]
    new_entries.append(new_entry)

pik.extend(new_entries)
with open('app/src/companies-components-scope/pik/templates.json', 'w') as f:
    json.dump(pik, f, indent=2, ensure_ascii=False)
    f.write('\n')
```

### Rules

- If both a **pik-specific** `.tpl` and a **cross-company** entry exist for the same `template` path — the pik-specific `.tpl` file takes precedence in the ZIP (the `existsSync(dstTpl)` check in `export-ds.mjs` skips the copy).
- **Do not** create `template.json` files for cross-company entries — only `templates.json` is the source of truth.
- **Do not** add cross-company entries to `pages/{company}/index.html` — these are export-only, not dev previews.
- `source_company` is ignored by the backend (unknown field) — it's only used by `export-ds.mjs`.

### Note about app/src/templates.json

`app/src/templates.json` (root) contains the path `templates/{type}/{variant}/index.tpl` —
this is a different registry with a different base path. Do not confuse it with `companies-components-scope/{company}/templates.json`.
If the section exists there too — delete that entry as well.
