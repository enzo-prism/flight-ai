# Mach 1 website and product

Mach 1 combines a marketing website, release archive, authenticated conversation workspace, and a separate fictional sample. The real product uses Supabase authentication and tenant storage, read-only OAuth connectors, and bounded Jev analysis. Provider configuration and live verification are separate from implemented code.

**Production:** https://flight-ai-two.vercel.app

**Repository:** https://github.com/enzo-prism/flight-ai

## Run locally

Use Node.js 22 and Python 3.10+:

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:8092/`. The local server serves only the explicit `public/` build output and `/api/product`. Run the build again after editing browser assets. To use configured development services, load an ignored environment file:

```sh
node --env-file=.env.local scripts/dev-product.mjs
```

Without service configuration, the product displays unavailable services honestly. `/sample.html` works without authentication or external services. Vercel uses extensionless `/app` and `/sample` routes with `cleanUrls: true`.

## Pages and ownership

| File | Purpose | Edit directly? |
| --- | --- | --- |
| `index.html`, `styles.css`, `app.js` | Marketing, customer stories, media | Yes |
| `sales.html` | Prepare a sales email draft; does not submit inquiries | Yes |
| `product.html` | Product overview and sourced customer proof | No: generated |
| `updates.html`, `updates/*.html` | Release archive and full release articles | No: generated |
| `content/releases.json` | Release content and source page references | Yes |
| `scripts/build-product-pages.py`, `scripts/site_chrome.py` | Content generation and shared marketing header/footer | Yes |
| `pages.css`, `pages.js`, `navigation.css`, `navigation.js` | Editorial pages and website navigation | Yes |
| `app.html`, `live.css`, `live-app.js` | Real sign-in, connector onboarding, Sales/Support workspace | Yes |
| `api/product.mjs`, `server/*.mjs` | Authenticated API, provider adapters, analysis, encryption | Yes |
| `db/*.sql` | Tenant schema, RLS, atomic operations and scan locks | Version deliberately |
| `preview.html`, `preview.js`, `preview.css` | Guided tools and Sales/Support setup using sample preferences only | Yes |
| `sample.html`, `product.css`, `product.js`, `sample-polish.css`, `demo/*.mjs` | Separate fictional, browser-local concept preview | Yes |
| `customer-stories.css`, `updates-design.css` | Customer-story and release presentation | Yes |
| `scripts/build-site.mjs` | Explicit public-asset allowlist | Yes |
| `assets/` | Brand, customer media, connector icons | Preserve provenance |
| `vercel.json`, `.vercelignore` | Build/deployment configuration | Yes |

`public/` is generated and disposable. Never deploy the whole repository as static output: server code, database files, environment files, tests, and docs must remain outside it.

## Edit product and release content

```sh
python3 scripts/build-product-pages.py
```

Commit source and generated HTML. This also updates the shared header/footer in `index.html` and `sales.html`; their main content remains hand-authored. Edit `scripts/site_chrome.py` rather than individual generated headers. The generator validates release records, dates, and slugs before writing.

Marketing navigation and release reading work without JavaScript. Search and category filters are progressive enhancements with shareable `q`/`type` URLs. **Get Started** leads to the guided design preview at `/preview`; it hands off to the fictional workspace at `/sample`. The separate authenticated implementation remains at `/app` and still requires provider configuration. See [navigation](docs/navigation.md), [content maintenance](docs/content-maintenance.md), and [PDF provenance](docs/product-content-sources.md).

## Verify

```sh
npm ci
python3 scripts/build-product-pages.py --check
python3 -m unittest discover -s tests -v
python3 scripts/verify-site.py
npm run build
npm test
node --check live-app.js
node --check navigation.js
node --check pages.js
node --check app.js
node --check product.js
git diff --check
```

`npm test` runs the sample and product unit suites. They cover source fixtures, routing/state, provider normalization and error boundaries, Jev response validation, authentication/tenant guards, and backend scan behavior. Mock tests do not prove provider authorization or live analysis.

### Browser verification

Install pinned browser tooling in scratch space, then run against the local product server:

```sh
npm install --prefix work/browser-qa --no-audit --no-fund playwright@1.62.1 axe-core@4.13.0
work/browser-qa/node_modules/.bin/playwright install chromium
export PLAYWRIGHT_MODULE="$PWD/work/browser-qa/node_modules/playwright"
export AXE_MODULE="$PWD/work/browser-qa/node_modules/axe-core/axe.min.js"
export SITE_URL="http://127.0.0.1:8092"
node tests/browser/preview.cjs
node tests/browser/product.cjs
node tests/browser/core.cjs
node tests/browser/edges.cjs
node tests/browser/continuity.cjs
```

`CHROME_PATH` can select an installed Chrome executable. The product browser suite mocks API responses to verify onboarding, connectors, role selection, evidence, outcomes, drafts, metrics, logout, and accessibility. The other three suites exercise `/sample.html` and fictional data only. Manual screen-reader and customer usability checks remain separate.

Authenticated service and database integration checks require an explicitly selected development project. See [product onboarding](docs/product-onboarding.md) for their effects and commands. They are intentionally not run by ordinary CI.

## Real product and sample boundaries

The real `/app` contains no seeded customer conversations. Users authenticate, authorize configured sources, choose Sales or Support, and explicitly run bounded scans. Evidence comes from imported messages, and analytics come from persisted records. Drafts are saved and copied; messages are not sent to customers. A configured adapter is not a connected account, and a connected account is not evidence of a completed scan.

At implementation verification, Supabase email authentication was enabled; Google, Apple, and SSO were disabled. Connector OAuth application credentials and the AI Gateway key were absent. Until those are configured and tested, customers cannot complete live connector analysis. This is an operational snapshot, not a permanent capability setting; check `/api/product?action=config` when deploying. See [connector setup](docs/connector-setup.md) and [product onboarding](docs/product-onboarding.md).

The `/sample` preview opens directly into clearly fictional conversations without sign-in. Its state remains browser-local, and Tower stops at Awaiting approval. It never becomes a user's real workspace. See [focused preview](docs/focused-preview.md). Release articles describe the supplied Mach 1 feature source; they do not independently prove every described capability exists in this implementation.

## Deploy

Follow [the deployment runbook](docs/deployment.md). Verify the project, migration version, environment readiness, CI, production alias, and public API separately. A local build or green unit suite is not deployment proof.

## Assets and attribution

- Brand assets in `assets/brand/` came from mach1ai.com.
- Sidebar icons in `assets/icons.js` use Lucide (ISC).
- Connector SVGs use svgl, Simple Icons, and the existing Google fallback.
- Customer proof is reused from the existing site; Craig McGowan's quotation remains attributed to Trace.
- Customer media notes: `assets/customers/videos/README.md`.
- `assets/mail/` ASCII frames derive from semicolons-dev/asciify's `animations/mail`. Earlier project notes record no upstream license file and use for this demo per owner direction; broader reuse requires separate review.
