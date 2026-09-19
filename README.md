# Mach 1 — demo site

Single-page marketing site for **Mach 1**, whose AI agents
are specialized for customer support and sales. Clean, spacious,
Cursor/Apple/OpenAI-inspired design with subtle aviation theming and animated
Lordicon icons throughout.

Brand assets (logo + mark, light and dark) live under `assets/brand/` and are
sourced from mach1ai.com.

## Stack

- Static HTML + CSS + JS — no build step, no dependencies
- Icons: [Lordicon](https://lordicon.com) animated icons via CDN
- Hosting: Vercel (static)

## Develop

Open `index.html` directly, or serve locally:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## Deploy

```sh
vercel --prod
```

## Structure

| File         | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `index.html` | Marketing page markup, copy, Lordicon embeds, real Mach 1 customer proof |
| `styles.css` | Marketing design system, layout, responsive, motion  |
| `app.js`     | Landing interactions (routed into the demo app)      |
| `app.html`   | Self-serve demo app shell: signin, onboarding, admin |
| `product.css`| shadcn-style zinc theme + responsive app shell       |
| `product.js` | Hash router + 24 views, demo state (localStorage)    |
| `assets/icons.js` | Inline sidebar icons (Lucide, ISC — see lucide.dev) |
| `assets/brand/` | Mach 1 logo + mark PNGs (light/dark, from mach1ai.com) |
| `assets/connectors/` | Brand SVGs: svgl routes + Simple Icons (Zendesk/Intercom/HubSpot/Snowflake, absent from svgl) + flat Google G. Demo-app fallbacks + homepage strip logos |
| `assets/mail/` | Packed ASCII mail tiers (low/medium/high.json, 56 frames each) powering the hero — envelope morphing into a paper plane; frames trimmed to content bbox from semicolons-dev/asciify `animations/mail` (no upstream license file; used for this demo per owner direction) |
| `vercel.json`| Static hosting config                                |

Demo flow: landing “Try Mach 1” → `app.html` fake Google sign-in →
onboarding (connect context, choose agents) → workspace (overview,
connections, agents, billing with Growth/Enterprise upsell). All state is
local; OAuth, usage, and checkout are simulated.

## Product and release pages

- `product.html`: customer-facing overview of the documented Mach 1 product.
- `updates.html`: searchable release index with category filters.
- `updates/*.html`: one complete article per documented release period.
- `content/releases.json`: editable, chronologically ordered release content.
- `pages.css` / `pages.js`: responsive editorial styling and progressive enhancements.
- `scripts/build-product-pages.py`: standard-library generator for committed static HTML.
- `docs/product-content-sources.md`: PDF page mapping, claim boundaries, and editorial rules.

After changing release content or the page template, regenerate with:

```sh
python3 scripts/build-product-pages.py
```

Generation is an authoring step, not a hosting requirement. Commit the generated HTML along with source changes. The complete content and all navigation work without JavaScript; search and filtering progressively enhance the release index. Relative `.html` links work both with a local Python server and Vercel clean-URL redirects.

The source PDF covers weekly release periods, not numbered major versions or exact launch dates. Retain the date-range labels. Product capabilities describe the documented Mach 1 platform; the existing browser demo remains simulated. The product illustration is explicitly labeled, and demo links say so.

Product-page customer quotation: Craig McGowan, Trace, reused from the existing homepage customer story without adding results claims.
