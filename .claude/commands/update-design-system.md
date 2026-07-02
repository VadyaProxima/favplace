---
allowed-tools: Bash(curl:*), Bash(ls:*), Bash(unzip:*)
description: Upload the newest design system archive to deeep or snapbuild server
---

Upload the newest design system archive to the specified platform and environment.

Arguments: `$ARGUMENTS` — format: `{company} [platform] [environment] [--reset-design] [--company-only-templates | --allow-global-templates]`

Parse the arguments:

- First word = company name (or `components` for global template update)
- Second word (optional) = platform: `deeep` (default) or `snapbuild` / `sb`
- Third word (optional) = environment: `dev`, `develop` (default), or `master` / `prod`
  - For snapbuild: `dev` and `develop` are **different** stands (see URL table below)
  - For deeep: `dev` = `develop`
- `--reset-design` (optional) = пересобрать CSS/JS у уже созданных проектов компании
- `--company-only-templates` (optional) = after a successful import, switch the company to "use only this company's blocks, no global blocks" mode
- `--allow-global-templates` (optional) = after a successful import, allow global/shared blocks alongside the company's own blocks

Template-scope flags rules:
- `--company-only-templates` and `--allow-global-templates` are **mutually exclusive**. If both are passed → STOP and ask the user to pick exactly one.
- They only apply in **company mode**. If `company=components` and one of them is passed → STOP, because there is no companyId.
- If neither flag is passed → do NOT send any `settings` and do NOT call `PUT /api/company/{id}`.

Examples:
- `/update-design-system minimal` → deeep develop
- `/update-design-system minimal sb` → snapbuild develop
- `/update-design-system minimal sb dev` → snapbuild dev (sb-dev)
- `/update-design-system minimal deeep master` → deeep master
- `/update-design-system minimal sb prod` → snapbuild master
- `/update-design-system minimal sb develop --reset-design` → snapbuild develop + пересборка существующих проектов
- `/update-design-system minimal sb develop --company-only-templates` → snapbuild develop + company-only blocks
- `/update-design-system minimal sb develop --allow-global-templates` → snapbuild develop + global blocks allowed
- `/update-design-system pik sb prod --reset-design --company-only-templates` → snapbuild master + reset + company-only blocks

## Platform + Environment → API URL mapping

| platform  | environment | API URL                             |
| --------- | ----------- | ----------------------------------- |
| deeep     | develop     | https://api.snapbuild.chulakov.dev  |
| deeep     | master      | https://api.deeep.app               |
| snapbuild | dev         | https://api.sb-dev.snapbuild.ru     |
| snapbuild | develop     | https://api.sb-test.snapbuild.ru    |
| snapbuild | master      | https://api.snapbuild.ru            |

If API URL is `?` — ask the user for it.

## Company → companyId mapping

### deeep

| company | develop                              | master                               |
| ------- | ------------------------------------ | ------------------------------------ |
| avito   | 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 | 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 |
| pik     | 019c2db2-38a1-7f9f-b235-751aacc8bee1 | 019cc3d7-9514-71e5-914b-19b75a1d97d2 |
| minimal | 019cc258-9c3b-7562-b655-2a1772467b8c | 019cc3d7-d965-74a2-a7be-bc77a1ecac85 |

### snapbuild

| company | dev                                  | develop                              | master                               |
| ------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| avito   | ?                                    | 019c94f2-4327-7ba2-8829-3ef33171c871 | 019cad82-ffb7-7978-bc70-0bfcd0267bd9 |
| pik     | 019dd966-8e0c-7f15-ae30-0fa064160f55 | 019cbe3b-d147-7510-bb82-373653bfa575 | 019c2db2-38a1-7f9f-b235-751aacc8bee1 |
| minimal  | ?                                    | 019cbd60-289a-731a-89e1-801a75b14448 | 019cb7b2-69d2-7966-ac46-56d6938b0ee1 |
| vtb      | ?                                    | 019cb950-51eb-7564-b451-99adfb4f165a | 019ce616-57e1-74b7-9137-dc0d82d2655d |
| cloud-ru | ?                                    | 019ce129-7d21-796d-bccd-e381d489561b | ?                                    |
| sandbox  | ?                                    | ?                                    | 019daa0a-a9d1-7f26-aaef-b8f516945b5d |
| sds      | ?                                    | 019eee55-7022-7432-8192-d991c2debfb6 | 019eee4e-d510-7854-a87b-74cf9fd69812 |

If companyId for the environment is `?` — ask the user for it.

## Platform-specific assets (minimal only)

| asset                | deeep                                                   | snapbuild                                                |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| logo                 | `src/public/logo/deeep.svg`                             | `src/public/logo/snapbuild.svg`                          |
| template_assets_host | `https://deeep-app.ams3.digitaloceanspaces.com`         | `https://storage.yandexcloud.net/snapbuild-storage`      |

These are patched by `export-ds.mjs --platform=<platform>` during export.

## Task

### Individual file uploads

For one-off image uploads, use the open endpoint. JWT is not required:

```bash
curl -X POST "https://api.snapbuild.ru/api/upload" \
  -F "file=@{FILE_PATH}" \
  -F "fileName={FILE_NAME}" \
  -F "profileId=illustration-refs"
```

Use the returned URL before replacing local `/src/...` paths in templates.

### Components mode (`/update-design-system components`)

Global update — imports templates and categories without binding to a specific company.

0. **Scope-flag guard**: if `--company-only-templates` or `--allow-global-templates` was passed → STOP. There is no companyId in components mode, so the company template-scope setting cannot be applied.

1. Find the newest components archive:

```bash
ls -t app/exports/components*.zip | head -1
```

2. Ask the user for a fresh JWT token (tokens expire in ~1 hour).

3. Send the request **without companyId**:

```
curl -X POST "{API_URL}/api/preset/import" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@{ARCHIVE_PATH}"
```

4. Report the result (categories_count, templates_count, preset_imported should be `false`).

### Company mode (`/update-design-system minimal`)

1. Find the newest archive for the specified company:

```bash
ls -t app/exports/{company}-ds*.zip | head -1
```

2. **Pre-upload validation** (for minimal company only):

Extract `style/ds.json` from the archive and verify platform-specific values match the target platform:

```bash
unzip -p "{ARCHIVE_PATH}" style/ds.json 2>/dev/null | head -5
```

Check:
- `template_assets_host` must match the target platform (see table above)
- If mismatch → **STOP and warn the user**: "Archive was exported for {actual_platform}, but you're uploading to {target_platform}. Re-export with `--platform={target_platform}`."

Also verify the logo:
```bash
unzip -p "{ARCHIVE_PATH}" style/logo.svg 2>/dev/null | head -3
```
- For deeep: logo should NOT contain "snapbuild" branding
- For snapbuild: logo should NOT contain "deeep" branding
- If mismatch → warn the user similarly.

3. Ask the user for a fresh JWT token (tokens expire in ~1 hour).

4. **Ask about resetting existing projects** (only if `--reset-design` was NOT passed as argument):

   If this is an UPDATE of an existing company's design (not a first-time upload), ask the user:
   > "Нужно ли пересобрать CSS/JS у уже созданных проектов этой компании? (resetDesign)"
   
   - If `--reset-design` was passed → skip the question, treat as confirmed
   - If user confirms OR `--reset-design` was passed → set `RESET_DESIGN=true`
   - If user declines → set `RESET_DESIGN=false`
   
   **What resetDesign does:** the backend asynchronously rebuilds published CSS/JS for all existing projects of this company using the updated templates and tokens. HTML and text content are not affected. Projects in "generating" status are skipped (they'll get the latest design when generation completes).

5. Send the request **with companyId**:

**Without resetDesign (default):**
```
curl -X POST "{API_URL}/api/preset/import" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@{ARCHIVE_PATH}" \
  -F "companyId={COMPANY_ID}"
```

**With resetDesign (when confirmed):**
```
curl -X POST "{API_URL}/api/preset/import" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@{ARCHIVE_PATH}" \
  -F "companyId={COMPANY_ID}" \
  -F "resetDesign=true"
```

⚠️ **Template ID stability**: when uploading an updated DS, the archive MUST preserve the same template IDs from `templates.json` / individual `template.json`. If IDs change, the import creates new templates, and existing project sections stay on the old ones — CSS won't apply at the section level. The export script (`export-ds.mjs`) copies IDs as-is, so this is the default behavior. Do NOT regenerate IDs manually.

6. Report the result to the user (categories_count, templates_count, preset_imported). If resetDesign was sent, mention that existing projects will be rebuilt asynchronously.

7. **Update company template scope** (only if a scope flag was passed, AND only after a successful import):

   This toggles a backend company setting that controls whether site generation may pull blocks from the global/shared library in addition to this company's own blocks.

   ⚠️ **The backend field is legacy/misnamed**: `enableAllTemplates=true` actually means "use ONLY this company's blocks, WITHOUT global". Send the setting exactly as specified below — do not "correct" the naming.

   If `--company-only-templates` was passed → enable company-only mode:
   ```bash
   curl -X PUT "{API_URL}/api/company/{COMPANY_ID}" \
     -H "Authorization: Bearer {TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"settings":{"enableAllTemplates":true}}'
   ```

   If `--allow-global-templates` was passed → allow global blocks:
   ```bash
   curl -X PUT "{API_URL}/api/company/{COMPANY_ID}" \
     -H "Authorization: Bearer {TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"settings":{"enableAllTemplates":false}}'
   ```

   If neither scope flag was passed → **do NOT call `PUT /api/company/{id}`** and do NOT mention `settings` anywhere. The company template scope is left untouched.

8. Reporting the scope change:
   - If `--company-only-templates` was applied → write: "Company template scope updated: company-only templates enabled"
   - If `--allow-global-templates` was applied → write: "Company template scope updated: global templates allowed"
   - If neither was passed → do NOT write anything about settings / template scope.

---

If company is not specified — ask the user which company to update.
If the company is not in the mapping table and not `components` — ask the user for the companyId.
