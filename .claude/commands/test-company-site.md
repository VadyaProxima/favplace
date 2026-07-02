# /test-company-site

Builds test landing pages from design system templates and takes screenshots.
Simulates backend behavior: selects templates → assembles the page → injects realistic content → screenshot.

## Usage

```
/test-company-site minimal
/test-company-site minimal saas
/test-company-site minimal --multiple=3
/test-company-site avito product
```

## Arguments

- **company** — company name (minimal, avito, pik, jti, yandex)
- **preset** — landing type (default, saas, product, service). Default: default
- **--multiple=N** — generate N variants with different templates
- **--sections=type/variant,...** — specific sections separated by commas
- **--no-ai** — do not use Ollama (fast mode, stubs)
- **--no-sd** — do not use Stable Diffusion (loremflickr for images)
- **--sd-model=name** — select a specific SD model (default: cyberrealisticXL_v80)

## Presets

| Preset | Sections |
|--------|----------|
| `default` | header, hero, features, how-it-works, cta, footer |
| `saas` | header, hero, features, how-it-works, testimonials, pricing, cta, footer |
| `product` | header, hero, benefits, features, pricing, faq, cta, footer |
| `service` | header, hero, services, how-it-works, team, testimonials, cta, footer |

## Result

Screenshots and report are saved to `app/docs/sites/{company}/{datetime}/`:
- `site.png` — desktop (1440px)
- `site-mobile.png` — mobile (390px)
- `report.md` — list of sections and paths to screenshots
- `report.json` — data for further processing

## Execution Algorithm

$ARGUMENTS

1. Parse arguments: first — company, second (optional) — preset, rest as-is
2. Run the script:
   ```bash
   pnpm -C app site:test --company={company} --preset={preset} {remaining arguments}
   ```
3. After successful run, read `report.json` from the specified runDir
4. Show the user:
   - List of selected sections (type/variant)
   - Which images were generated (SD) or used as stubs
   - Paths to screenshots
5. Open the `site.png` screenshot (desktop) via Read tool and show the user
6. Open the `site-mobile.png` screenshot (mobile) via Read tool and show the user

---

## Step 7 — Visual Analysis via Subagent

After showing the screenshots, launch the `site-analyzer` subagent via Task tool:

```
Task tool:
  subagent_type: site-analyzer
  prompt: |
    company: {company}
    preset: {preset}
    runDir: {absolute path from report.json}
```

Wait for the result and **output the agent's full report** to the user without changes.

---

## Notes

- Screenshots are not committed to git (app/docs/sites/ is in .gitignore)
- Templates are selected randomly from available variants (brand_specific are excluded)
- **Fallback to minimal**: if the company doesn't have a needed section type — a template from minimal is used (as on the backend)
- **Production CSS**: for non-minimal companies, `style/index.ds.css.twig` is automatically synced from `app/src/results/index.ds.css.twig` and CSS is regenerated — an exact copy of production
- Dev server starts automatically if not running
- Stable Diffusion (A1111) starts automatically if installed at ~/Documents/stable-diffusion-webui
- Default model: cyberrealisticXL_v80 (realistic photos for websites)
- If A1111 is unavailable — images are fetched from loremflickr.com
