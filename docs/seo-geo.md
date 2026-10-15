# SEO and generative-search visibility

Public origin: `https://mestometal.ru`. The default storefront language is English;
Russian remains a saved UI preference. The two guide URLs are independently
server-rendered translations, with reciprocal `hreflang` and self-canonicals:

- `/guide/topographic-rings`
- `/ru/guide/topographic-rings`

## Implemented

- Unique server metadata for home, studio, credits and both guides; canonical URLs,
  Open Graph and Twitter cards. `/social-image` produces a static 1200×630 PNG.
- Shared studio URLs keep their configuration parameters and canonicalize to
  `/create`. No redirect strips ring settings.
- `/sitemap.xml` contains only the five public canonical pages. No invented
  modification dates, query combinations, admin or development comparison pages.
- `/robots.txt` permits public pages and their assets; API crawling is excluded.
  Admin has both HTML `noindex` and an HTTP `X-Robots-Tag`; development comparison
  routes retain `noindex` and production 404s. API `X-Robots-Tag` is set in
  Caddy, which routes production API requests directly to Nest.
  Pages with `noindex` stay crawlable so crawlers can read that instruction.
- Organization, WebSite and Product JSON-LD on the homepage. Product offers use
  the shared price calculation and match the visible FAQ. No fabricated ratings,
  inventory, shipping guarantees, business address or certification.
- A readable FAQ and a practical design guide: actual terrain controls, diameter
  sizes, prices, shared configurations and the request-before-payment process.
  Guide Article/BreadcrumbList data matches visible content. Terrain source links
  point to primary documentation. The image is identified as a 3D preview.
- Home and guide text, prices, links and metadata are available without JavaScript.
  The studio has a meaningful initial HTML screen while its interactive UI loads.
  The hero poster is prioritized; guides do not load the Three.js scene or map.
- Existing English/dark defaults, Russian preference, studio links and checkout
  behavior are preserved. Guide-to-studio links select the guide's language.

## Decisions and sources

Reviewed 2026-10-15. These are engineering/content changes, not a ranking promise.

- [Google's generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): useful original content, crawlability and normal SEO remain the foundation. No special AI schema or `llms.txt` is required by Google. This project does not add one as a ranking tactic.
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls): consolidate configuration URLs using canonical metadata while keeping shared links functional.
- [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions): reciprocal language links are used only for actual translated URL pairs. The localStorage UI toggle is not advertised as a separate indexed language page.
- [Product snippets](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) and [structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): describe the real product and visible prices. Eligibility does not guarantee a rich result.
- [Next.js metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images): use server metadata and static metadata routes.
- [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c): use citation/grounding reporting after ownership verification to measure actual AI visibility.

## Release and measurement

After deployment, submit `https://mestometal.ru/sitemap.xml` to the owner's Google
Search Console, Bing Webmaster Tools and Yandex Webmaster accounts. Verify domain
ownership using the provider-issued token; do not publish a placeholder token.
These account-side actions require an authenticated owner session and were not
performed by the code changes.

Inspect the home, studio and both guides with URL inspection and Google's Rich
Results Test. Monitor indexing, query impressions, clicks and real order requests;
use Bing AI Performance for citations where available. Measure production Core
Web Vitals from real traffic; a local build/test does not establish field scores.

Next content should come from actual work: photographs of finished rings, customer
stories with permission, and confirmed delivery/production terms. Avoid generating
large numbers of thin location pages. Full RU versions of the storefront/studio
would need a separate URL-based localization migration; do not add unsupported
`hreflang` entries before those pages exist.

## Verification

`node apps/web/scripts/qa-seo.cjs` tests server HTML with JavaScript disabled,
metadata, structured prices, guides and language alternates, shared-link canonicals,
robots/sitemap, PNG dimensions, admin exclusion, real 404s, mobile layout and live
RU/EN metadata/schema synchronization. `SEO_QA_BASE` can point at an isolated
production build. Run the existing preferences/currency and shared-link browser
checks when changing preference or studio hydration behavior.
