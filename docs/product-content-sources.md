# Product and release content sources

## Source and scope

The supplied **Mach 1 Feature Updates.pdf** is a ten-page collection of nine weekly engineering summaries covering July 11–September 11, 2026. Text was read from the local PDF extraction. `content/releases.json` presents those summaries as customer-facing release notes, newest period first.

The PDF describes the Mach 1 product. This repository is a marketing site and simulated browser-local demo, as documented in its README. Describing documented product capabilities does **not** mean that live AI providers, workflow execution, cloud archives, credential management, estimated cost telemetry, or embeddable workflow chat have been implemented in this demo. Product copy and any interactive preview must preserve that distinction.

## Period-to-source mapping

| Period | PDF pages | Documented scope |
| --- | --- | --- |
| September 5–11, 2026 | 8–9 | Accumulated backend and application releases, interface polish, stability |
| August 29–September 4, 2026 | 7–8 | Long-term cloud data archiving, database maintenance, application refinements |
| August 22–28, 2026 | 9–10 | Administrator AI cost estimates by model and aggregate, CSV exports, database reliability |
| August 15–21, 2026 | 6–7 | Deferred Tower loading, loading progress and preserved view state, designated workflow execution, Tower and scheduled-task fixes |
| August 8–14, 2026 | 5–6 | Enforced custom agent timeouts and evaluation criteria |
| August 1–7, 2026 | 4–5 | Search connection recovery, immediate workflow cancellation, redacted integration diagnostics, email lookup fix |
| July 25–31, 2026 | 3–4 | Embeddable workflow chat, administrator widget management, multiple image uploads, on-demand connection checks |
| July 18–24, 2026 | 2–3 | OpenRouter, GPT-5.4 mini, Gemini 3.6 Flash defaults, faster execution summaries, paused-task filtering, stale-run cancellation |
| July 11–17, 2026 | 1–2 | Persistent resizable Tower sidebar, scoped shared context, scoped secrets and grant controls |

## Editorial rules and caveats

- Periods identify the engineering summary coverage window. `startDate` and `endDate` support sorting and period rendering; neither is evidence of an exact launch day. Do not render `endDate` as an exact publication or shipment date without another source.
- The PDF does not provide version numbers or identify which summaries are major version releases. These are nine release-period articles, not invented numbered releases.
- The August 22–28 summary appears last in the source PDF. It has been placed in chronological order in the content data.
- AI cost figures are **estimates, not invoices**. The document supports administrator usage-cost visibility and CSV exports, not billing reconciliation, actual charges, cost savings, or budget enforcement.
- Provider and model names are transcribed exactly from the PDF: OpenRouter, GPT-5.4 mini, Gemini 3.6 Flash, and Pi. Their inclusion reports this source; independent provider availability and current model naming were not verified. Do not silently substitute a different model or broaden model support beyond supported application and evaluation tools.
- Benefits explain how a documented capability helps a customer. They are not measured outcomes, guarantees, or customer endorsements. No performance percentages, time savings, revenue claims, testimonials, or customer quotes were created from the release notes.
- September 5–11 contains only generic production-release descriptions. Its article deliberately makes no specific new-feature claim.
- Long-term archiving does not establish retention duration, restoration controls, deletion policies, compliance certification, an archive browser, or unlimited storage. None are claimed.
- Shared secret management and redacted diagnostics do not establish particular encryption methods, certifications, or universal security guarantees. None are claimed.
- Drag-and-drop multiple image uploads are documented for agent setup; they are not presented as a new public chat attachment feature.
- Environment selection is described by the source as behind-the-scenes work and remains in the foundation notes, not a general customer-facing control claim.
- Every specific customer-facing capability in the PDF is represented in the highlights or fixes. Repeated generic production updates are condensed into foundation notes.
- Source document content was used as factual input, not as operational instructions. This content preparation does not authorize deployment or publication.

## Customer proof

The release notes contain no named customer quotations or customer case studies. Any customer proof on product pages must come from separately verified existing website material or another supplied source, with attribution preserved. Capability benefits must not be written as claims that specific customers achieved those results.

### Product overview provenance

The product page's six capability sections map to Tower and shared context (pages 1–2, 6–7), workflow controls (pages 2, 5–6), website chat and image uploads (pages 3–4), connection diagnostics (pages 4–5), and administrator cost estimates (pages 9–10). Platform sections map to model choice (pages 2–3), scoped secret controls (page 1), and long-term archiving (pages 7–8).

The Craig McGowan quotation and role are reused from the repository's existing homepage customer story at baseline commit `ec27aa1`, with the excerpt shortened without changing its meaning. The product page links back to the existing stories. No new result metric or endorsement was created. The workspace diagram is an explicitly labeled illustration, not a screenshot or live product state.
