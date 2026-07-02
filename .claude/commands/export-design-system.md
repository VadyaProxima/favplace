---
allowed-tools: Bash(pnpm:*), Bash(ls:*), Bash(node:*)
description: Export company design system to a ZIP archive in the exports/ folder
---

Export the design system for company `$ARGUMENTS`.

## Modes

### Company DS export (default)

```
/export-design-system minimal
/export-design-system minimal snapbuild
/export-design-system avito
```

Exports the full design system (templates + categories + CSS layout + ds.json + logo).

Second word (optional) = platform: `deeep` (default) or `snapbuild` / `sb`. For minimal, this patches the logo and `template_assets_host` for the target platform.

### Components-only export

```
/export-design-system components
```

Exports only templates and categories from `minimal` (the base library), WITHOUT design system files. Used for global updates on the backend (import without `companyId`).

## Task

1. Parse `$ARGUMENTS`:
   - If `components` → components-only mode
   - Otherwise → first word = company name (default: `minimal`), second word = platform (default: `deeep`)

2. Normalize platform: `sb` → `snapbuild`

3. Run the export:

**Company DS:**
```bash
pnpm -C app ds:export --company={company} --platform={platform}
```

**Components-only:**
```bash
node app/scripts/export-ds.mjs --components --company=minimal
```

4. Check the result:

```bash
ls -lh app/exports/ | tail -5
```

The export script validates the generated ZIP before reporting success. In full DS mode, if any `.tpl` contains `data-cms-logo`, `style.json` must contain `"logo": "style/logo.svg"` or another valid path, and that file must exist in the archive. This mirrors backend behavior: `DesignPreset.logoFile` is imported only from `style.json.logo`, then injected into every `[data-cms-logo]`.

5. Report to the user:
   - Path to the created archive
   - File size
   - Mode: full DS or components-only
   - Platform (for minimal)
   - What it contains

If `$ARGUMENTS` is not specified — use `minimal` as default (full DS mode, deeep platform).

---

# Design Preset Archive (ZIP) contract

These rules apply when generating the ZIP archive consumed by the deeep.app backend's `POST /api/preset/import` endpoint.

## Archive layout

```
preset.zip
├── templates.json            # required: list of page-section templates
├── categories.json           # optional: template categories metadata
├── style.json                # required for design-system payload
└── style/                    # convention: assets referenced by style.json
    ├── logo.svg              # logo (any image type)
    ├── result-generation-ds.json   # design tokens (colors, typography, …)
    ├── *.twig                # layout files (CSS/HTML/JS twig templates)
    └── *.{jpg,png,svg,webp}  # image assets
```

- Folder name `style/` is convention only. All paths in `style.json` are **relative to ZIP root**.
- Do not include hidden files (`__MACOSX/`, `.DS_Store`).
- Do not include `style.json` if you only ship templates — backend imports DS preset only when `style.json` is present AND the request has a `companyId`.
- If exported templates contain `data-cms-logo`, `style.json.logo` is required and must point to an existing logo file inside the ZIP. A loose `style/logo.svg` file without the `style.json.logo` reference is not imported as the preset logo.

## `style.json` schema

```json
{
  "id": "019cafcc-873e-77a5-86a4-5915e0c30438",
  "logo": "style/logo.svg",
  "designPreset": "style/result-generation-ds.json",
  "layouts": [
    {
      "type": "css",
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "path": "style/index.ds.css.twig"
    }
  ],
  "images": [
    {
      "key": "hero.background.slide",
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "path": "style/hero-background-slide.jpg"
    }
  ]
}
```

### Top-level fields

- `id` — UUID v7 string. Reused on repeat imports as the stable preset ID.
- `logo` — path to logo file. Always re-uploaded on every import (no hash).
- `designPreset` — path to a JSON file with style tokens. Inlined into `DesignPreset.styles`.
- `layouts[]` — Twig templates for CSS / HTML / JS rendering of pages.
- `images[]` — pre-rendered/curated images that fill template image slots without AI generation.

### `layouts[]` entry

| Field   | Type   | Required | Notes |
| ------- | ------ | -------- | ----- |
| `type`  | string | yes      | One of: `css`, `html`, `js`. `preview_css` is reserved. |
| `path`  | string | yes      | Path inside ZIP. Basename + type form the file identity. |
| `hash`  | string | yes\*    | SHA-256 hex (64 chars). Required for incremental re-import to skip unchanged files. |

### `images[]` entry

| Field  | Type   | Required | Notes |
| ------ | ------ | -------- | ----- |
| `key`  | string | yes      | Slot identifier — see "Image keys" below. |
| `path` | string | yes      | Path inside ZIP. Extension is preserved when storing in S3. |
| `hash` | string | yes\*    | SHA-256 hex (64 chars). Same role as in `layouts[]`. |

\* `hash` is technically optional, but without it the backend cannot skip re-uploads on repeat imports — always include it.

## Image keys

- Keys follow the **dot-notation** used by template authors in `data-cms-image="..."` attributes (e.g. `hero.background`, `team.member.lead.photo`).
- Keys are matched **byte-for-byte** against `ProjectPageVersionImage.key` at page generation time. No case-folding, no slug normalization. Match it exactly.
- Keys MUST be **unique within `images[]`** in a single archive — duplicates cause a 422 `ValidationException`.
- A key with no template usage (no `data-cms-image="<key>"` anywhere in your templates) is harmless: the file lands in S3 but is never referenced. Don't ship orphans on purpose — they bloat the preset.
- If the same key appears in both `images[]` and as an AI-generated slot in a template, the DS image **wins** for first-time generation. Explicit user "regenerate" still goes through AI.
- Keys from elements marked `data-cms-no-generate` usually do not need `images[]`; backend keeps image-meta from HTML and skips AI auto-generation. If such a key is present in `images[]`, mark it non-generatable (`generate: false` or `should_generate: false`).

## Hashes

- Algorithm: **SHA-256**, lowercase hex, 64 characters.
- Computed over the **raw file bytes**, not over a normalized/transcoded version.
- A change in `hash` triggers re-upload + replaces the existing `DesignPresetFile`; an unchanged `hash` causes the import to skip the file entirely (no S3 traffic, same DB row).

## Storage layout (informational)

After import, files are stored under:

```
presets/{presetId}/preview.css                  # generated preview CSS
presets/{presetId}/{logo basename}              # logo
presets/{presetId}/{layout basename}            # each layout file
presets/{presetId}/images/{slug(key)}.{ext}     # each images[] entry
```

`slug(key)` is Symfony's slugger applied to the dot-notation key, lowercase. Two image entries cannot collide as long as their keys differ.

## Idempotency rules

- Re-importing the same archive: zero S3 writes for layouts/images whose `hash` matches existing rows; preset metadata (`name`, `code`, `styles`, `outputConfig`) is refreshed.
- Re-importing with changed `hash` for a file: old `StorageFile` removed, new file uploaded, new `DesignPresetFile` row created (same identity).
- Re-importing with a key removed from `images[]`: corresponding `DesignPresetFile` and its `StorageFile` are deleted.
- Logo is the only entry that is **always** replaced — do not rely on logo-stability across imports.

## When to include `images[]`

Include an entry only if the curated asset is the intended default for that slot on first page generation. The backend treats `images[]` as "use this exact file, do not generate".

Do NOT use `images[]` for:
- `data-cms-image` elements that also have `data-cms-no-generate` and fixed `src`, unless you need extra metadata and mark the entry non-generatable.
- Reference photography meant to influence AI prompts (use Asset Collections instead).
- One-off uploads scoped to a single project page (those go through the regular page-edit flow).

## Don'ts

- ❌ Don't omit `hash` — every repeat import will re-upload the file.
- ❌ Don't rename keys between releases without coordinating with template authors. Renaming a key invalidates the slot mapping for every project that imported the previous version.
- ❌ Don't reuse the same `key` across multiple `images[]` entries.
- ❌ Don't put the same physical file twice under different keys when one would do — duplicate uploads, no benefit.
- ❌ Don't include MacOS metadata (`__MACOSX/`, `.DS_Store`) in the ZIP.

## Example minimal archive

```json
// style.json
{
  "id": "019cafcc-873e-77a5-86a4-5915e0c30438",
  "logo": "style/logo.svg",
  "designPreset": "style/tokens.json",
  "layouts": [
    {"type": "css", "hash": "ab12…", "path": "style/index.ds.css.twig"}
  ],
  "images": [
    {"key": "hero.background", "hash": "cd34…", "path": "style/hero.jpg"},
    {"key": "about.photo",     "hash": "ef56…", "path": "style/about.png"}
  ]
}
```
