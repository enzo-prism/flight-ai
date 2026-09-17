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
| `assets/planet/` | Packed ASCII planet tiers (low/medium/high.json, 300 frames each) powering the hero; frames trimmed to content bbox from semicolons-dev/asciify `animations/planet` (no upstream license file; used for this demo per owner direction) |
| `vercel.json`| Static hosting config                                |

Demo flow: landing “Get started” → `app.html` fake Google sign-in →
onboarding (connect context, choose agents) → workspace (overview,
connections, agents, billing with Growth/Enterprise upsell). All state is
local; OAuth, usage, and checkout are simulated.
