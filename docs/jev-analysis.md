# Jev conversation analysis

`server/analysis.mjs` calls the genuine evaluation-only `typesafe-ai/jev` model through Vercel AI Gateway. It uses the documented `POST https://ai-gateway.vercel.sh/v1/evaluate` endpoint, not a chat or text-generation API. The server requires `AI_GATEWAY_API_KEY`; this value never belongs in browser JavaScript.

Reference: [Vercel evaluation HTTP API](https://vercel.com/docs/ai-gateway/modalities/evaluation#http-api), checked September 19, 2026. This is a billed API. The automated tests inject mock fetch responses and do not spend credits or send customer data.

## Contract

```js
evaluateConversation(conversation, 'support' /* or 'sales' */, {
  now: new Date().toISOString(),
  apiKey: process.env.AI_GATEWAY_API_KEY,
  fetchImpl: fetch,
})
// => { model: 'typesafe-ai/jev', findings: [...], coverage: {...} }
```

Input messages contain unique source `id`, `role` (`customer`, `teammate`, or `unknown`), timestamp `at`, and original `text`. Output findings contain `type`, `title`, `summary`, `reason`, `priority`, `waitingSince`, `dueAt`, `evidence`, `suggestion`, and `draft`. `waitingSince` is null when the source timestamp cannot be established. Evidence entries contain the original `messageId` and an exact source substring as `quote`.

Support evaluates unanswered questions, repeated requests, outstanding team commitments and blocking problems. Sales evaluates unanswered buying questions, repeated requests, outstanding team commitments and buying objections. Each question returns a typed choice: one candidate source message, or `none`. The application validates every response, model identity, candidate reference and probability before accepting findings. Unsupported or partial responses fail the entire analysis rather than silently manufacturing successful results.

Persisted finding types follow the shared `unanswered`, `promise`, `repeat`, `handoff`, `objection` contract. Sales buying questions and support blockers normalize to `unanswered`. Simultaneous unanswered and blocker signals combine into one finding with both source references and the higher-priority supported signal; the database does not receive duplicate conversation/type pairs. The current evaluator does not infer handoffs.

## Boundaries

- Conversation text is evidence, never an instruction channel. Jev selects references; it cannot generate executable instructions, select tools, send messages, access credentials, modify permissions or create customer-facing free-form claims.
- At most the latest 20 eligible messages, 3,000 characters per message and 24,000 total message characters are submitted. Future-dated messages are excluded. Empty conversations do not trigger a model call. Coverage records the input/analyzed counts, exclusions and truncation; history outside the connector result is always unverified.
- Confidence below 0.55 produces no finding. Between 0.55 and 0.8, unknown roles, unknown timestamps, or truncated analysis produce **Review needed**. This is a triage policy, not a calibrated accuracy guarantee. Model probabilities are not shown as customer value scores.
- Timing and priority are computed in code. An explicit commitment deadline requires a teammate source, a single timezone-qualified ISO timestamp directly after `by`, `before`, or `on`, and a timestamp after the source message. Relative dates, date-only values, conflicting deadlines and customer plans to return later never create overdue team commitments.
- Clear blockers, overdue explicit commitments and evidence older than 48 hours receive high priority. An explicit commitment still scheduled in the future is not escalated just because its source message is old. The elapsed time is time since the selected source evidence, not a contractual SLA. The application does not infer missing replies in other channels, customer satisfaction, deal value, churn or revenue.
- Suggestions and editable drafts come from fixed templates with placeholders for verified facts. Jev does not compose promises or facts. There is no send operation in this module.
- Network requests have a 25-second ceiling, do not follow redirects and are not automatically retried. Provider errors are reduced to bounded messages; no provider payloads, credentials or conversation text are logged. `ANALYSIS_NOT_CONFIGURED`, `ANALYSIS_RATE_LIMITED`, `ANALYSIS_TIMEOUT`, `ANALYSIS_UNAVAILABLE`, `INVALID_ANALYSIS_INPUT`, `INVALID_LENS`, and `INVALID_EVALUATION_RESPONSE` identify failures.

## Verification

Run `node --test tests/product-analysis.test.mjs`. Tests cover the real HTTP request format through mocks, lens-specific questions, exact source evidence, empty outcomes, uncertain findings, customer future intent, explicit deadlines, future timestamps, truncated context, invalid source IDs, unsupported output, configuration errors and timeout/error redaction.

These tests verify the adapter and application safeguards. They do not establish Jev's empirical accuracy on customer data or prove a configured account can successfully invoke the model. A separately authorized live evaluation and a labeled, representative conversation set are required for those claims. Before admitting production customer data, review the AI Gateway/provider retention configuration and the applicable customer agreement; the adapter does not claim zero retention.
