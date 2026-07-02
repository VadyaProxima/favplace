---
allowed-tools: Bash(curl:*)
description: Delete sections from backend by template IDs
---

Delete template sections from the backend via `DELETE /api/template/{id}`.

Arguments: `$ARGUMENTS` — format: `{id1,id2,...} [platform] [environment]`

Parse the arguments:

- First word = comma-separated list of template IDs (UUIDs)
- Second word (optional) = platform: `deeep` (default) or `snapbuild` / `sb`
- Third word (optional) = environment: `dev`, `develop` (default), or `master` / `prod`
  - For snapbuild: `dev` and `develop` are different stands.
  - For deeep: `dev` = `develop`.

Examples:
- `/delete-section 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78` → deeep develop
- `/delete-section 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78,019c2db2-38a1-7f9f-b235-751aacc8bee1 sb` → snapbuild develop/test
- `/delete-section 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 sb dev` → snapbuild dev
- `/delete-section 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 deeep master` → deeep master
- `/delete-section 019c2db1-1cbe-7fb4-be43-2aa3b6ed4f78 sb prod` → snapbuild master

## Platform + Environment → API URL mapping

| platform  | environment | API URL                            |
| --------- | ----------- | ---------------------------------- |
| deeep     | develop     | https://api.snapbuild.chulakov.dev |
| deeep     | master      | https://api.deeep.app              |
| snapbuild | dev         | https://api.sb-dev.snapbuild.ru    |
| snapbuild | develop     | https://api.sb-test.snapbuild.ru   |
| snapbuild | master      | https://api.snapbuild.ru           |

Do not use old `https://api.sb.chulakov.dev` for test Snapbuild.

## Task

1. Parse the comma-separated IDs from the first argument.

2. Show the user a summary before proceeding:
   - Number of sections to delete
   - Target: `{platform} {environment}` (`{API_URL}`)
   - List of IDs

3. Ask the user for a fresh JWT token (tokens expire in ~1 hour).

4. **Ask for confirmation** before executing deletions — this is a destructive operation.

5. For each ID, send a DELETE request:

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "{API_URL}/api/template/{ID}" \
  -H "Authorization: Bearer {TOKEN}"
```

6. Report results for each ID:
   - Success (2xx) → report as deleted
   - 404 → report as "not found (already deleted?)"
   - 401/403 → report as "auth error" and STOP (token likely expired)
   - Other errors → report status code and response body

7. Print a final summary: `{success_count}/{total} sections deleted successfully`.

## Error handling

- If no IDs provided → ask the user for IDs
- If auth fails on any request → STOP immediately, do not continue with remaining IDs
- If platform/environment is invalid → show the mapping table and ask for correction
