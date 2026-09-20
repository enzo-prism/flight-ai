import { FINDINGS } from "./fixtures.mjs";
/** Precomputed concept only. A future server would interpret permitted evidence;
 * application code remains responsible for timing, priority and execution rules.
 * This adapter performs no model call, ingestion, authentication or action. */
export function analyzeConversation(conversationId) {
  return FINDINGS.filter((f) => f.conversationId === conversationId).map(
    (f) => ({
      ...f,
      evidence: f.evidence.map((e) => ({ ...e })),
      initialActivity: f.initialActivity.map((e) => ({ ...e })),
    }),
  );
}
