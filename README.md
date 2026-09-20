# Mach 1 website

A static marketing website, product overview, release archive, and interactive product demo for Mach 1's support and sales agents.

**Production:** https://flight-ai-two.vercel.app

**Repository:** https://github.com/enzo-prism/flight-ai

## Run locally

Python 3.10+ serves the site; no package installation or framework build is required:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/`. Use `.html` paths locally. Vercel redirects those paths to extensionless URLs in production with `cleanUrls: true`.

## Pages and ownership

| File | Purpose | Edit directly? |
| --- | --- | --- |
| `index.html`, `styles.css`, `app.js` | Marketing, customer stories, video player, animated hero | Yes |
| `sales.html` | Prepare a sales email draft; does not send or store inquiries | Yes |
| `product.html` | Product features, customer value, existing Trace quotation | **No:** generated |
| `updates.html`, `updates/*.html` | Release index and full release-period articles | **No:** generated |
| `content/releases.json` | Release content and source page references | Yes |
| `scripts/build-product-pages.py` | Product copy, shared page templates, validation, generation | Yes |
| `pages.css`, `pages.js` | Product/release styling, shareable search and filter restoration | Yes |
| `scripts/site_chrome.py` | Shared static header/footer for every public marketing page | Yes |
| `navigation.css`, `navigation.js` | Responsive navigation, product disclosure, keyboard and anchor handling | Yes |
| `app.html`, `product.css`, `product.js` | Focused Support/Sales concept preview: Priorities, Overview, Connections | Yes |
| `demo/*.mjs` | Fictional fixtures, state, routing, selectors and precomputed analysis boundary | Yes |
| `assets/` | Brand, customer media, connector icons, ASCII animation | Preserve provenance |
| `vercel.json`, `.vercelignore` | Static hosting and authoring-file exclusions | Yes |

There are no application server endpoints or runtime package dependencies. The marketing homepage loads Lordicon from its CDN; product and release pages use local assets. `product.js` is the existing demo application, not the new product marketing page's controller.

## Edit product and release content

```sh
python3 scripts/build-product-pages.py
```

Commit both source and generated HTML. The same command also refreshes shared headers and footers in `index.html` and `sales.html`; their main content remains hand-authored. Edit `scripts/site_chrome.py` for navigation, not individual page headers. The generator validates all release content before writing, derives coverage dates from the records, and refuses duplicate/unsafe slugs or unlisted release HTML. It does not delete retired pages automatically.

All new-page content and navigation work without JavaScript, including a mobile menu fallback. Search and category filtering are progressive enhancements. Search covers release summaries, highlights, customer benefits, fixes, and foundation notes.

The product menu uses native disclosure. All marketing pages share Product, Integrations, Customers, Updates, Contact sales, and Try the demo. Mobile menus support Escape, outside click, keyboard focus, compact-height scrolling, and breakpoint reset. Release filters are shareable through `q`/`type` URL parameters, with optional session storage preserving breadcrumb return context. See [navigation behavior](docs/navigation.md).

Read [the editing guide](docs/content-maintenance.md) and [the PDF source map](docs/product-content-sources.md) before adding claims or releases.

## Verify

Python 3.10+ and Node.js 22+ are sufficient for the committed checks:

```sh
python3 scripts/build-product-pages.py --check
python3 -m unittest discover -s tests -v
python3 scripts/verify-site.py
node --check navigation.js
node --check pages.js
node --check app.js
node --check product.js
node --check assets/icons.js
node --test tests/demo-*.test.mjs
git diff --check
```

GitHub Actions runs these checks for main pushes and pull requests. They validate generated-content freshness, content boundaries, safe slugs and dates, search indexing, local links/assets/fragments, page headings, duplicate IDs, and JavaScript syntax. They do not replace browser checks or live deployment readback. See [the review](docs/product-release-review.md) for tested browser behavior and remaining limitations.

### Browser verification

The optional browser checks need Playwright and axe-core as development tools only. Install them in a scratch directory and use a running local server:

```sh
npm install --prefix work/demo-qa --no-audit --no-fund playwright@1.62.1 axe-core@4.13.0
work/demo-qa/node_modules/.bin/playwright install chromium
export PLAYWRIGHT_MODULE="$PWD/work/demo-qa/node_modules/playwright"
export AXE_MODULE="$PWD/work/demo-qa/node_modules/axe-core/axe.min.js"
export SITE_URL="http://127.0.0.1:8080"
node tests/browser/core.cjs
node tests/browser/edges.cjs
node tests/browser/continuity.cjs
```

`CHROME_PATH` optionally selects an already installed Chrome executable. The suites use isolated browser contexts and fictional data only. Core exercises actions, copying, reloads, metrics, Tower, reset, and mobile Escape. Edges checks WCAG A/AA rules with axe, responsive layouts, history/scroll, malformed or blocked storage, and asset failures. Continuity checks focus and prior regression cases. Human comprehension and manual screen-reader testing remain separate checks.

## Deploy

Follow [the deployment runbook](docs/deployment.md). Verify the linked Vercel project before publishing. Production is an explicit action; a local commit or successful static check does not deploy the site.

## Real product versus demo

Product and release pages describe capabilities documented in the supplied Mach 1 Feature Updates PDF. This repository does **not** implement the production Mach 1 platform.

The concept preview opens immediately into fictional customer conversations. It has no sign-in, model calls, live integrations, uploads, credentials, or Send action. Assignments, statuses, editable drafts, and activity remain browser-local; Tower stops at Awaiting approval. Its proposed capabilities are separate from the real product. See [the focused preview guide](docs/focused-preview.md) for architecture, counting rules, direct Support/Sales/Overview links, storage boundaries, and future pilot responsibilities. The sales form prepares a mailto draft and explains that the visitor must send it themselves. There is no lead submission endpoint.

## Assets and attribution

- Brand assets in `assets/brand/` were sourced from mach1ai.com.
- Sidebar icons in `assets/icons.js` use Lucide (ISC).
- Connector SVGs use svgl, Simple Icons, and the existing Google fallback.
- Customer proof is reused from the existing site; the new product-page quotation preserves Craig McGowan's attribution to Trace.
- Customer media notes: `assets/customers/videos/README.md`.
- `assets/mail/` contains 56-frame ASCII animation tiers derived from semicolons-dev/asciify's `animations/mail`. The previous project notes record no upstream license file and use for this demo per owner direction. Treat broader reuse as a separate review.
