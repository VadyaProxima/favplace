# Project Structure

```
src/
├── companies-components-scope/     # Templates by company
│   ├── minimal/                    # Main library (443 templates, 26 types)
│   ├── avito/                      # Full DS
│   ├── pik/                        # Full DS
│   ├── jti/                        # Separate config, no DS rendering
│   └── yandex/                     # Has Twig, no ds.json
├── pages/                          # HTML pages for viewing
├── plugins/
│   ├── parser.js                   # Parses @import(), assembles .tpl → HTML
│   └── ds-css.js                   # Generates CSS from Twig + ds.json
├── styles/mixins/responsive.css    # @mixin responsive
├── index.ds.css.twig               # Design system master template
└── templates.json                  # Global metadata

tests/visual-check.mjs              # Playwright: visual template checks
docs/reports/{datetime}/             # Screenshots + analysis
```

## Company structure

```
{company}/
├── {type}/{variant}/
│   ├── index.tpl              # Template (html + css + js)
│   └── template.json          # Template metadata
├── style/ds.json              # Company CSS variables
├── style.json                 # Logo, designPreset, layouts
├── templates.json             # Registry of all company templates
├── categories.json            # Section categories
└── output-config.json         # (optional) JSON output envelope for /parse endpoint
```

DS rendering: `ds-css.js` renders `index.ds.css.twig` + `style/ds.json` → `generated-css-from-twig/{company}-ds.css` for companies in `companiesWithDsTwig` (minimal, avito, pik).

## output-config.json

Controls the JSON envelope returned by the backend `GET /api/version/{vid}/parse` endpoint when a page is downloaded as JSON.

When present in the company directory, it is included in the ZIP export automatically. The backend reads it during preset import and saves it to the `design_preset.output_config` column.

**Structure:**
```json
{
  "envelope": {
    "success": true,
    "data": {
      "pageType": "landing",
      "payload": {}
    }
  },
  "paths": {
    "sections": "data.payload.sections",
    "code": "data.payload.code",
    "createdAt": "data.payload.createdAt"
  }
}
```

- `envelope` — static JSON skeleton of the response
- `paths` — dot-notation paths inside the envelope where dynamic values are injected:
  - `sections` — array of `{component, data}` objects (one per page section)
  - `code` — project slug
  - `createdAt` — version creation datetime (ISO 8601)

Without `output-config.json` the endpoint returns `{"sections": [...]}` as a flat fallback.

**PIK** has `output-config.json`. After re-importing the preset the endpoint will return the full envelope.

## template.json

```json
{
  "id": "uuid",
  "name": "Hero Announcement",
  "category": "hero",
  "tags": ["hero", "announcement"],
  "template": "companies/minimal/hero/announcement/index.tpl",
  "text_template": "instructions for AI content generation (in English)",
  "images": [{ "key": "hero.image", "ratio": "16:9", "description": "..." }],
  "volume_restrictions": { "hero.title": { "min": 3, "max": 8 } }
}
```

**When changing `template.json` — always update the corresponding entry in the company's `templates.json`.**

## Section types in Minimal

`about`, `banner`, `benefits`, `blog`, `cards`, `catalog`, `contact`, `cta`, `download`,
`faq`, `features`, `footer`, `header`, `hero`, `how-it-works`, `job-board`, `portfolio`,
`pricing`, `problems`, `services`, `solutions`, `stats`, `team`, `teams`, `testimonials`, `timeline`

## QA

```bash
node app/tests/visual-check.mjs --company=avito
node app/tests/visual-check.mjs --company=minimal --type=hero
```

Full flow: `/test-company {company}` command.

## Claude agents

Commands: `/command-name arguments`. Agents: via Task tool.
See `.claude/commands/` and `.claude/agents/` for full list.
