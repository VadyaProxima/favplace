---
allowed-tools: Bash(pnpm:*), Bash(ls:*), Bash(node:*), Bash(curl:*), Bash(git:*)
description: Full pipeline: export DS → upload to server
---

Full design system deployment pipeline for company `$ARGUMENTS`.

## Arguments

Format: `{company} [environment] [--reset-design] [--company-only-templates | --allow-global-templates]`
- company: `minimal`, `avito`, `pik`, or `components`
- environment: `develop` (default) or `master`
- `--reset-design`: пересобрать CSS/JS у уже созданных проектов компании (опционально)
- `--company-only-templates`: после успешного upload/import включить режим "брать блоки только из текущей компании" (без global)
- `--allow-global-templates`: после успешного upload/import разрешить общие/global блоки вместе с блоками компании

Template-scope flags rules:
- `--company-only-templates` and `--allow-global-templates` are **mutually exclusive**. If both are passed → STOP and ask the user to pick exactly one.
- They only apply in **company mode**. If `company=components` and one of them is passed → STOP, because there is no companyId.
- If neither flag is passed → the pipeline behaves exactly as before: no `PUT /api/company/{id}`, no `settings` in any request, no question to the user about template scope.

Examples:
```
/deploy-ds minimal
/deploy-ds minimal master
/deploy-ds avito develop
/deploy-ds components
/deploy-ds minimal develop --reset-design
/deploy-ds minimal develop --company-only-templates
/deploy-ds minimal master --allow-global-templates
/deploy-ds pik develop --reset-design --company-only-templates
```

## Pre-flight checks

1. **Verify CWD** — all scripts expect `app/` as working directory
2. **Check glab auth** — run `glab auth status` to verify GitLab token is valid. If expired → tell user and STOP
3. **Check git status** — ensure working tree is clean or changes are related to the DS being deployed

## Pipeline

### Step 1: Validate templates.json sync

Before exporting, verify that `templates.json` is consistent with individual `template.json` files:

```bash
pnpm -C app ds:validate {company}
```

If validation fails → fix issues first, do NOT proceed with export.

### Step 2: Export

**Company DS:**
```bash
pnpm -C app ds:export --company={company}
```

**Components-only:**
```bash
node app/scripts/export-ds.mjs --components --company=minimal
```

Verify the archive was created:
```bash
ls -lh app/exports/ | tail -3
```

### Step 3: Upload to server

Use the environment → API URL mapping from `/update-design-system`:

For Snapbuild use the platform-aware mapping from `/update-design-system`:

| environment | API URL                         |
| ----------- | ------------------------------- |
| dev         | https://api.sb-dev.snapbuild.ru |
| develop     | https://api.sb-test.snapbuild.ru |
| master      | https://api.snapbuild.ru        |

For deeep use:

| environment | API URL                            |
| ----------- | ---------------------------------- |
| develop     | https://api.snapbuild.chulakov.dev |
| master      | https://api.deeep.app              |

Do not use old `https://api.sb.chulakov.dev` for test Snapbuild.

Company → companyId mapping:

| company | develop                              | master                               |
| ------- | ------------------------------------ | ------------------------------------ |
| avito   | 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 | 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 |
| pik     | 019c2db2-38a1-7f9f-b235-751aacc8bee1 | 019cc3d7-9514-71e5-914b-19b75a1d97d2 |
| minimal | 019cc258-9c3b-7562-b655-2a1772467b8c | 019cc3d7-d965-74a2-a7be-bc77a1ecac85 |

Ask the user for a fresh JWT token, then upload:

**Ask about resetting existing projects** (company mode only, skip for components):

If `--reset-design` was passed → skip the question, treat as confirmed.
Otherwise, ask the user:
> "Нужно ли пересобрать CSS/JS у уже созданных проектов этой компании? (resetDesign)"

- If user confirms OR `--reset-design` was passed → set `RESET_DESIGN=true`
- If user declines → set `RESET_DESIGN=false`

**What resetDesign does:** the backend asynchronously rebuilds published CSS/JS for all existing projects of this company using the updated templates and tokens. HTML and text content are not affected. Projects in "generating" status are skipped.

⚠️ **Template ID stability**: when uploading an updated DS, the archive MUST preserve the same template IDs from `templates.json` / individual `template.json`. If IDs change, the import creates new templates, and existing project sections stay on the old ones — CSS won't apply at the section level. The export script (`export-ds.mjs`) copies IDs as-is.

**Company (without resetDesign):**
```bash
curl -X POST "{API_URL}/api/preset/import" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@{ARCHIVE_PATH}" \
  -F "companyId={COMPANY_ID}"
```

**Company (with resetDesign, when confirmed):**
```bash
curl -X POST "{API_URL}/api/preset/import" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@{ARCHIVE_PATH}" \
  -F "companyId={COMPANY_ID}" \
  -F "resetDesign=true"
```

**Components:**
```bash
curl -X POST "{API_URL}/api/preset/import" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@{ARCHIVE_PATH}"
```

Report the import result (categories_count, templates_count, preset_imported). If resetDesign was sent, mention that existing projects will be rebuilt asynchronously.

**Update company template scope** (only if a scope flag was passed, AND only after a successful import; skip entirely for `components`):

This toggles a backend company setting that controls whether site generation may pull blocks from the global/shared library in addition to this company's own blocks.

⚠️ **The backend field is legacy/misnamed**: `enableAllTemplates=true` actually means "use ONLY this company's blocks, WITHOUT global". Send the value exactly as specified below.

- If `--company-only-templates` → `{"settings":{"enableAllTemplates":true}}`
- If `--allow-global-templates` → `{"settings":{"enableAllTemplates":false}}`

```bash
curl -X PUT "{API_URL}/api/company/{COMPANY_ID}" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"enableAllTemplates":true}}'
```

Rules:
- Do NOT add `settings` to the import request — `settings` goes only to this separate `PUT /api/company/{id}`.
- Do NOT ask the user about this setting automatically. Change it only when a scope flag is explicitly passed.
- If neither flag is passed → skip this step completely (no PUT, no mention of settings).
- If `company=components` → skip this step completely (no companyId).

Reporting:
- If `--company-only-templates` was applied → "Company template scope updated: company-only templates enabled"
- If `--allow-global-templates` was applied → "Company template scope updated: global templates allowed"
- Otherwise → do not mention template scope at all.

### Upload individual backend assets

For one-off image uploads, use the open endpoint. JWT is not required:

```bash
curl -X POST "https://api.snapbuild.ru/api/upload" \
  -F "file=@{FILE_PATH}" \
  -F "fileName={FILE_NAME}" \
  -F "profileId=illustration-refs"
```

Use the returned URL before replacing local `/src/...` paths in templates.

## Error handling

- If any step fails → report the error and STOP, do not continue the pipeline
- If `glab auth status` fails → tell user to refresh token, stop
- If validation fails → list the issues, suggest fixes, stop
- If upload fails → check the response body for details, report to user
