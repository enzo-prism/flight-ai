# Focused preview implementation review

Reviewed September 19, 2026 against the supplied conversation-preview specification.

## Delivered

| Requirement | Implementation and evidence |
| --- | --- |
| Immediate value, no onboarding | Support opens with seven grouped conversations; Maya is first, unassigned, waiting 3h |
| Same experience for Sales | Shared shell/components with separate fixtures, vocabulary, derived metrics and direct URL |
| Traceable interpretation | Every finding references existing timestamped messages with exact quote substrings; all source quotes validated |
| Useful actions | Assign/Undo, Start working, editable persisted drafts/Copy, outcome-required Handled, reason-required Dismiss, history-preserving Reopen |
| Honest boundaries | No Send, authentication, upload, credential form, real model call, external action or fake live connection |
| Grounded leadership | Every metric/pattern leads to the matching records, including reviewed conversations without findings; current/previous denominators derived |
| Contextual Tower | Configurable walkthrough ends Awaiting approval; explicit no-send result; commercial contact link |
| Responsive continuity | Adjacent desktop detail, full-screen mobile detail, filters/selection/scroll/history preservation, focus fallback when a row leaves a filter |
| Durable local behavior | Versioned validated state; reload persistence; malformed/blocked storage fallback; reset restricted to one namespace |
| Maintainability | Separate fixtures/state/router/selectors/analysis adapter, documented contracts, committed unit and browser tests, CI |

## Local validation

- 17 Node tests: evidence/chronology, grouping, deterministic ranking, filtered identity, all metric and pattern drilldowns, negative next-month example, state/action/Undo rules, reset isolation, malformed/unavailable storage, safe routing and history.
- 7 existing Python tests: release content and generation checks remain passing.
- Static verification: 14 HTML pages, 535 local references; generated content current; JavaScript syntax and whitespace checks passing.
- Three browser suites: complete Support/Sales journeys; assignment, draft copy/reload, handled/dismissed/reopen and history; exact Overview record counts; Tower controls and approval boundary; pilot explanation; reset; deep links, Back/Forward and scroll; unavailable/malformed storage.
- Independent browser regression review confirmed eight integration fixes: action focus, stale closed-state explanation, filtered Back focus, disclosure continuity, canceled delayed search, destination heading focus, invalid mobile selection recovery, and mobile Escape focus.
- Nine axe WCAG A/AA scans across Priorities, evidence, draft, Tower, Overview, Connections, mobile, and 200% equivalent layout: zero violations. Generic-container naming findings were fixed with named search/region landmarks. Remaining automatic contrast-review flags concern pseudo-element backgrounds or decorative arrow glyphs; the flat text/background palette was reviewed separately, with tested text combinations above 4.5:1.
- Responsive widths: 320, 390, 720, 901, 1024 and 1440 CSS pixels; compact 390×320 layout; no horizontal page overflow. A 720 CSS-pixel viewport checks the available layout space of a 1440px browser at 200% zoom. Mobile form controls use 16px type to avoid iOS focus zoom.

Browser scripts are in `tests/browser/`; setup and overrides are in README. They run in isolated contexts with fictional data, and can target the production URL without touching real customer records.

## Evidence limits

Automated accessibility-tree/keyboard checks and palette review do not replace a manual screen-reader session. No prospective-user comprehension study has been conducted. The brief's first-minute reactions and final usability question remain goals to validate with people, rather than established customer findings. This concept is not a production conversation-analysis backend.

## Release verification

After pushing, verify GitHub main and CI, Vercel's production commit/alias, static module delivery, and the live browser suites separately. A local pass alone is not proof of production behavior. The task's final delivery records that live readback.
