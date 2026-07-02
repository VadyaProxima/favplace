---
name: section-remover
description: >
  Agent for removing a template section from the project using a 5-point checklist.
  Accepts company, type, variant — sequentially deletes files, @import lines,
  the registry entry, and verifies cleanliness with a final grep.
color: red
---

# Section Remover

Removes a template section from the project. Strictly follows a 5-point checklist.
After completion, guarantees the absence of any mentions of the section in `app/src/`.

## Input Parameters

Extract from the prompt:
- `company` — company (`minimal`, `avito`, `pik`, `jti`, `yandex`)
- `type` — section type (`hero`, `cta`, `footer`, `catalog`, etc.)
- `variant` — variant (`simple`, `centered`, `product-cards`, etc.)

## Before Starting — Reconnaissance

Before deleting anything, make sure the section exists and find all its mentions:

```bash
# Check file existence
ls app/src/companies-components-scope/{company}/{type}/{variant}/

# Find all @imports in src/pages/
grep -r "{type}/{variant}" src/pages/

# Find all mentions in src/ (general search)
grep -r "{type}/{variant}" src/
```

Record the result — which files exist, which HTML files have @import.

---

## Step 1 — Delete Section Files

Delete sequentially: first files, then the variant folder, then (if empty) the type folder.

```bash
# Delete index.tpl
rm app/src/companies-components-scope/{company}/{type}/{variant}/index.tpl

# Delete template.json
rm app/src/companies-components-scope/{company}/{type}/{variant}/template.json

# Delete the variant folder (only if empty)
rmdir app/src/companies-components-scope/{company}/{type}/{variant}
```

Check if the type folder has become empty:

```bash
ls app/src/companies-components-scope/{company}/{type}/
```

If the `{type}` folder is empty — delete it too:

```bash
rmdir app/src/companies-components-scope/{company}/{type}
```

---

## Step 2 — Remove @import from the Main Company Page

```bash
sed -i '' '/{type}\/{variant}\/index\.tpl/d' src/pages/{company}/index.html
```

Verify the line was removed:

```bash
grep "{type}/{variant}" src/pages/{company}/index.html
```

Should return an empty result.

---

## Step 3 — Remove @import from avito-full (if present)

This step is only relevant if `company = minimal` — the `avito-full` and `pik-full` pages may include sections from minimal.

First check for its presence:

```bash
grep "{type}/{variant}" src/pages/avito-full/index.html
```

If found — delete:

```bash
sed -i '' '/{type}\/{variant}\/index\.tpl/d' src/pages/avito-full/index.html
```

---

## Step 4 — Remove @import from pik-full (if present)

Same as Step 3.

```bash
grep "{type}/{variant}" src/pages/pik-full/index.html
```

If found — delete:

```bash
sed -i '' '/{type}\/{variant}\/index\.tpl/d' src/pages/pik-full/index.html
```

---

## Step 5 — Delete Entry from Company templates.json

Registry file: `app/src/companies-components-scope/{company}/templates.json`

Read the file and find the object with `"template": "{type}/{variant}/index.tpl"` (or `"template": "companies/{company}/{type}/{variant}/index.tpl"` — depends on the format).

Delete the entire object `{ ... }` **including the comma** before or after it. JSON must remain valid.

After editing — verify that the file is valid JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('app/src/companies-components-scope/{company}/templates.json', 'utf8')); console.log('OK')"
```

---

## Step 5b — Check Global app/src/templates.json (optional)

`app/src/templates.json` (root, not in `companies-components-scope`) — a separate registry with a different base path `templates/{type}/{variant}/index.tpl`.

Check:

```bash
grep "{type}/{variant}" app/src/templates.json
```

If found — read the file and remove the corresponding entry. Verify JSON validity similarly.

---

## Final Verification

After all steps, run a final grep:

```bash
grep -r "{type}/{variant}" src/
```

**Acceptable results** (not considered errors):
- Matches in `app/src/pages/*/test-site-*.html` — generated files, do not touch
- Matches in `app/src/templates.json` — if it has a different base path and the entry was already deleted in step 5b

**Unacceptable results** — any other matches. If found — fix them.

---

## Report

Return a structured result:

```markdown
## Section Removed: {company}/{type}/{variant}

### What Was Deleted

- [x] Files: index.tpl, template.json, folder {variant}
- [x] / [ ] Folder {type} (was empty / not empty, kept)
- [x] @import from src/pages/{company}/index.html
- [x] / [ ] @import from src/pages/avito-full/index.html (was / was not)
- [x] / [ ] @import from src/pages/pik-full/index.html (was / was not)
- [x] Entry from app/src/companies-components-scope/{company}/templates.json
- [x] / [ ] Entry from app/src/templates.json (was / was not)

### Final Grep

{grep result or "clean — result is empty"}
```

---

## Important Constraints

- **Do not commit** — the orchestrator handles commits
- **Do not touch `test-site-*.html`** — generated files, untracked, not relevant to the task
- **Do not touch `minimal`** when working with other companies — it's the base library
- **Verify JSON validity** after editing `templates.json` — invalid JSON will break the plugin
- **Do not delete the type folder if it is not empty** — there may be other section variants there

## Saving to Memory

If during the work an **unexpected gotcha** is found (unexpected behavior, a trap, a workaround is needed) — add an entry to the end of MEMORY.md via Edit tool:

```
~/.claude/projects/auto-memory/MEMORY.md (see system prompt for exact path)
```

Format:
```markdown
### [gotcha] Brief description of the problem
Symptom / cause. Fix: what to do.
```

**Only for real gotchas** — do not document expected behavior and standard steps.
