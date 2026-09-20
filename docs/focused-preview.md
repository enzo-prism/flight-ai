# Focused conversation preview

## Purpose and boundaries

The September 19, 2026 concept brief replaces the old sign-in/onboarding and general agent demo with one loop: **notice → inspect evidence → choose a next step → follow through**. Its promise is “Know what needs attention. See why. Move it forward.”

This is a proposed experience, separate from the real Mach 1 capabilities documented in the supplied product-release PDF. Meridian, its teammates, accounts, conversations, findings, and outcomes are fictional. There is no model call, authentication, ingestion, credential collection, upload, live connection, or message sending. The contact page prepares an email that the visitor must review and send themselves.

Public entry points (use `app.html` locally):

- Support: `/app#/support/priorities`
- Sales: `/app#/sales/priorities`
- Leadership: `/app#/support/overview` or `/app#/sales/overview`

## Architecture

The static site has no framework build or application server. `app.html` loads `product.js` as an ES module and `product.css` for the preview only.

| Area | File | Responsibility |
| --- | --- | --- |
| Shell and interactions | `product.js`, `app.html` | Three destinations, lenses, evidence, dialogs, actions, focus and responsive continuity |
| Presentation | `product.css` | Monochrome surfaces, responsive list/detail, touch targets, focus, reduced motion and forced colors |
| Router | `demo/router.mjs` | Canonical hash URLs, selected conversation/finding, filters, history and retired-route redirects |
| Fixtures | `demo/fixtures.mjs` | Conversation messages, precomputed findings, people, sources and frozen clock |
| State | `demo/state.mjs` | Validated browser-local changes, drafts, activity, reversible actions and reset |
| Selectors | `demo/selectors.mjs` | Filtered grouped rows, deterministic ranking and derived overview/drilldowns |
| Future analysis boundary | `demo/analysis.mjs` | Isolated precomputed finding adapter; no network or model execution |

All demo modules are public static assets. Do not add `demo/` to `.vercelignore`.

## Sample data and counting rules

The clock is frozen at **September 18, 2026, 16:00 UTC**. Relative waiting times use that clock, never the visitor's current date. Each lens has 24 reviewed conversations in September 14–18 and 20 in September 7–11, including correctly unflagged records. Seven current conversations per lens initially have active findings. “Active” means Open or In progress.

The first Support finding is Maya Chen at Northline: she asked twice about restoring access; the intervening reply addressed billing. The last access request is at 13:00 UTC, so the row shows Waiting 3h. Support's access pattern is derived as 4/24 current versus 2/20 previous, with 3 currently open. Sales includes a buyer explicitly returning next month; that record has no overdue finding.

Rows group all matching findings by conversation. Ranking uses explicit severity, then overdue commitments, then longest wait. Filtering chooses the highest-ranked **matching** finding, so an Unassigned filter cannot display an unrelated assigned finding as its primary item.

Every Overview number counts distinct conversations. A conversation can contain several findings or questions. Support's third metric finds active overdue promises; Sales' third metric finds definite unanswered buying questions (uncertain review cases are excluded). Each metric and pattern supplies the same selector filters used by its destination list. Reviewed counts include unflagged conversations. Pattern topics do not imply that every related conversation is unresolved.

## State and honest actions

- Assign changes the owner; it never resolves a finding.
- Start working sets In progress. Drafting does not change status or send anything.
- Drafts are editable, include placeholders for unknown details, and persist while closed or across reloads when storage is available. Copy writes only after an explicit click; denied clipboard access selects the text and explains manual copying.
- Mark handled requires an outcome; it closes the finding without claiming customer-confirmed success.
- Dismiss requires a reason; it records review quality, not a better customer outcome.
- Reopen preserves prior activity and recorded outcomes/reasons. The detail shows the explanation for its current closed status.
- Undo reverses the most recent state action while retaining action/reversal history and later draft edits. Undo is session-local and is not retained across reloads.
- All sample action timestamps use the frozen clock. Sequential history order distinguishes actions performed at that same sample instant.

Only `mach1.preview.v2` is read/written/reset. Existing `mach1.v1.*` data and unrelated browser state are untouched. Storage is schema-validated; malformed data returns to the original sample with a notice. Blocked reads or writes keep an in-memory workspace with a visible reload limitation. Drafts are limited to 20,000 characters; outcome/reason fields to 1,000 characters.

## Navigation and accessibility

Shareable URLs encode the team, destination, period, status, owner, query, type, priority, topic, metric, and selected record. Unknown/retired destinations return to Support priorities; unknown records recover to a usable list. Back/Forward restore the route. Returning from detail restores list context and scroll; if assignment removes the selected row from a filter, focus returns to search.

Desktop uses adjacent evidence. At 900 CSS pixels and below, detail becomes a full-screen dialog with background controls inert, keyboard containment, and Escape/Back restoration. Native modal dialogs handle confirmation, outcomes, pilot explanation, and Tower. State changes use live announcements. No essential control depends on color or animation. Source messages, timestamps, highlighted evidence, and full context are available before actions.

Tower is contextual. Its approver, proposed source tool, escalation threshold, and history destination affect the local walkthrough. It stops at **Awaiting approval** and never calls a source tool. Basic evidence, assignment, and drafting are always available. Connections says **Sample source**, and the pilot CTA explains its email-interest boundary.

## Verification and future pilot work

Run the baseline checks in README plus `node --test tests/demo-*.test.mjs`. Browser suites cover full Support/Sales journeys and edge cases; see the documented browser commands in README. Automated accessibility checks supplement, rather than replace, manual assistive-technology testing.

Before expanding this concept, test comprehension with prospective support users, sales users, and leaders: can they inspect evidence, assign work, copy an edited draft, and name a real conversation they wish this had caught? Automated checks cannot establish these human usability outcomes.

For a real pilot, Jev would interpret bounded signals in permitted conversation data. Application code calculates timing and priority; templates or a writing model prepare prose. Evidence retrieval, authorization, tenant isolation, ingestion, retention, authentication, and approved action execution remain distinct production responsibilities.
