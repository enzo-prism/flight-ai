# Mach 1 preview design

Updated September 20, 2026. This revision follows the request to prioritize beautiful, simple UX over production engineering for the sample site.

## Journey

Get Started → welcome → choose sample tools → Sales or Support → ready → sample workspace.

- `preview.html`, `preview.js`, `preview.css` own the guided entrance. No email, password, OAuth consent, connector credentials, or real API requests are collected or made.
- A validated preference object in `mach1.preview.setup.v1` remembers tool choices and focus. Storage failure does not block the journey. Users can go directly to the sample or replay setup.
- `sample.html` retains the existing fictional fixtures and interaction engine. `sample-polish.css` scopes the new design to that experience, preserving the separate real product's CSS behavior.
- Sales and Support route directly to their corresponding sample priorities. Evidence, ownership, drafts, outcomes, undo, filters, analytics, and history remain interactive.
- `app.html`, `live-app.js`, and the backend remain a separate implementation. Their provider requirements have not been waived or presented as completed by this design revision.

## Design choices

The welcome experience uses quiet surfaces, restrained green accents, real connector logos, generous spacing, and one primary action per step. The workspace adds a data-derived priority spotlight, clearer hierarchy, refined conversation cards, and more focused evidence/detail surfaces. Motion respects reduced-motion preferences.

Product updates now use themed archive cards, Lucide icons, semantic feature illustrations, prominent customer-benefit callouts, and release contents links. The illustrations explain capabilities rather than claiming to be screenshots or live customer data. Release content remains generated from the existing sourced records.

Customer stories now lead with one Praktika feature, with two related clips behind a disclosure. DNSFilter and Trace each have a distinct outcome-led company card. Existing quotes, speaker context, five video sources, posters, captions, and transcripts are retained. Supplemental clips pause when their disclosure closes. Logo proof avoids repeating the earlier unsourced-looking metric wall.

## Verification

Use `npm test`, Python content/link checks, `npm run build`, and the browser suites. The new `tests/browser/preview.cjs` covers both lens handoffs, tool selection, back/reload, keyboard skip, 390px and 320px layouts, blocked storage, zero real-service calls, and accessibility scans. Existing sample suites protect its working interactions; the separate real-product browser suite protects that earlier implementation.

Review localhost before publishing. A preview redesign does not establish production authentication, connector access, or Jev service readiness.

Verification completed locally: 73 Node tests, seven Python tests, generated-page checks, 588 local references, all six browser suites, and a Vercel production-target build. The browser checks include accessibility and legacy `/app#/support/...` sample links.
