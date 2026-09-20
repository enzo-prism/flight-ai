import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateConversation,
  prepareConversation,
  buildEvaluationRequest,
  explicitDeadline,
  EVALUATION_MODEL,
  EVALUATION_URL,
  ANALYSIS_LIMITS,
} from "../server/analysis.mjs";

const now = "2026-09-19T16:00:00.000Z";
const conversation = {
  messages: [
    {
      id: "source-1",
      role: "customer",
      at: "2026-09-19T13:00:00Z",
      text: "How can I restore access?",
    },
  ],
};
function gateway(choices = {}, inspect = () => {}) {
  return async (url, options) => {
    const request = JSON.parse(options.body);
    inspect(url, options, request);
    const answers = Object.fromEntries(
      Object.entries(request.questions).map(([key, question]) => {
        const selected = choices[key] || "none";
        const choice =
          typeof selected === "object" ? selected.choice : selected;
        const probability =
          typeof selected === "object" ? selected.probability : 1;
        const probabilities = Object.fromEntries(
          Object.keys(question.criteria).map((candidate) => [
            candidate,
            candidate === choice ? probability : 0,
          ]),
        );
        if (probability < 1) probabilities.none = 1 - probability;
        return [key, { type: "choice", choice, probabilities }];
      }),
    );
    return {
      ok: true,
      json: async () => ({ model: EVALUATION_MODEL, answers }),
    };
  };
}
const options = (fetchImpl) => ({ now, apiKey: "mock-key", fetchImpl });

test("uses the documented evaluation endpoint and keeps source content out of instructions", async () => {
  const result = await evaluateConversation(
    conversation,
    "support",
    options(
      gateway({ unanswered: "m0" }, (url, config, request) => {
        assert.equal(url, EVALUATION_URL);
        assert.equal(config.redirect, "error");
        assert.equal(request.model, EVALUATION_MODEL);
        assert.equal(config.headers.Authorization, "Bearer mock-key");
        assert.equal(request.questions.unanswered.type, "choice");
        assert.ok(
          !request.questions.unanswered.instructions.includes(
            conversation.messages[0].text,
          ),
        );
        assert.equal(
          request.state.messages[0].text,
          conversation.messages[0].text,
        );
      }),
    ),
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.skipped, false);
  assert.equal(result.findings[0].priority, "attention");
  assert.deepEqual(result.findings[0].evidence, [
    { messageId: "source-1", quote: conversation.messages[0].text },
  ]);
  assert.match(result.findings[0].draft, /\[Answer/);
});

test("sales questions use buying intent rather than support blockers", async () => {
  const result = await evaluateConversation(
    conversation,
    "sales",
    options(
      gateway({ buying_question: "m0" }, (_, __, request) => {
        assert.ok(request.questions.buying_question);
        assert.ok(request.questions.objection);
        assert.ok(!request.questions.blocker);
      }),
    ),
  );
  assert.equal(result.findings[0].type, "unanswered");
});

test("normalizes simultaneous blocker and unanswered signals to one persistent finding", async () => {
  const data = {
    messages: [
      conversation.messages[0],
      {
        id: "blocked",
        role: "customer",
        at: "2026-09-19T14:00:00Z",
        text: "I cannot access any account settings.",
      },
    ],
  };
  const result = await evaluateConversation(
    data,
    "support",
    options(gateway({ unanswered: "m0", blocker: "m1" })),
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].type, "unanswered");
  assert.equal(result.findings[0].priority, "high");
  assert.equal(result.findings[0].evidence.length, 2);
});

test("typed no-findings remains empty, not manufactured insights", async () => {
  assert.deepEqual(
    (await evaluateConversation(conversation, "support", options(gateway())))
      .findings,
    [],
  );
});

test("uncertain selections and unknown source roles require human review", async () => {
  const uncertain = await evaluateConversation(
    conversation,
    "support",
    options(gateway({ unanswered: { choice: "m0", probability: 0.7 } })),
  );
  assert.equal(uncertain.findings[0].priority, "review");
  const unknown = await evaluateConversation(
    { messages: [{ ...conversation.messages[0], role: "unknown" }] },
    "support",
    options(gateway({ unanswered: "m0" })),
  );
  assert.equal(unknown.findings[0].priority, "review");
});

test("customer future intent never becomes an overdue team commitment even with mistaken model selection", async () => {
  const data = {
    messages: [
      {
        id: "return",
        role: "customer",
        at: "2026-09-01T12:00:00Z",
        text: "I will return next month.",
      },
    ],
  };
  const result = await evaluateConversation(
    data,
    "sales",
    options(gateway({ promise: "m0" })),
  );
  assert.deepEqual(result.findings, []);
});

test("time calculations require explicit timezone deadline in a teammate commitment", async () => {
  const data = {
    messages: [
      {
        id: "promise",
        role: "teammate",
        at: "2026-09-17T12:00:00Z",
        text: "I will restore access by 2026-09-18T15:00:00Z.",
      },
    ],
  };
  const result = await evaluateConversation(
    data,
    "support",
    options(gateway({ promise: "m0" })),
  );
  assert.equal(result.findings[0].priority, "high");
  assert.equal(result.findings[0].dueAt, "2026-09-18T15:00:00.000Z");
  assert.equal(explicitDeadline("I will do this next month."), null);
  assert.equal(explicitDeadline("I will do this by 2026-09-18."), null);
  assert.equal(
    explicitDeadline("The earlier incident happened 2026-09-18T15:00:00Z."),
    null,
  );
  assert.equal(
    explicitDeadline("By 2026-09-18T15:00:00Z or by 2026-09-19T15:00:00Z."),
    null,
  );
});

test("future timestamps never create negative waiting and are not sent for analysis", async () => {
  const data = {
    messages: [{ ...conversation.messages[0], at: "2027-01-01T00:00:00Z" }],
  };
  const result = await evaluateConversation(
    data,
    "support",
    options(() => {
      throw new Error("must not fetch");
    }),
  );
  assert.equal(result.coverage.excludedFutureMessages, 1);
  assert.deepEqual(result.findings, []);
  assert.equal(result.skipped, true);
  assert.equal(result.skipReason, "no_eligible_messages");
});

test("empty or whitespace-only sources are explicitly skipped rather than falsely reviewed", async () => {
  for (const data of [
    { messages: [] },
    { messages: [{ ...conversation.messages[0], text: "   " }] },
  ]) {
    const result = await evaluateConversation(
      data,
      "support",
      options(() => {
        throw new Error("must not fetch");
      }),
    );
    assert.equal(result.skipped, true);
    assert.equal(result.skipReason, "no_eligible_messages");
    assert.equal(result.coverage.analyzedMessages, 0);
    assert.deepEqual(result.findings, []);
  }
});

test("an explicit future commitment is not escalated merely because the promise is old", async () => {
  const data = {
    messages: [
      {
        id: "scheduled",
        role: "teammate",
        at: "2026-09-01T12:00:00Z",
        text: "I will send the report by 2026-10-01T15:00:00Z.",
      },
    ],
  };
  const result = await evaluateConversation(
    data,
    "support",
    options(gateway({ promise: "m0" })),
  );
  assert.equal(result.findings[0].priority, "attention");
  assert.equal(result.findings[0].dueAt, "2026-10-01T15:00:00.000Z");
});

test("truncated bounded evidence is an exact source substring and produces review priority", async () => {
  const data = {
    messages: Array.from({ length: 30 }, (_, i) => ({
      id: `long-${i}`,
      role: "customer",
      at: `2026-09-19T${String(i % 12).padStart(2, "0")}:00:00Z`,
      text: "a".repeat(4000),
    })),
  };
  const prepared = prepareConversation(data, now);
  assert.ok(prepared.messages.length <= ANALYSIS_LIMITS.messages);
  assert.ok(
    prepared.messages.reduce((sum, item) => sum + item.text.length, 0) <=
      ANALYSIS_LIMITS.totalCharacters,
  );
  const result = await evaluateConversation(
    data,
    "support",
    options(gateway({ unanswered: "m0" })),
  );
  assert.equal(result.coverage.truncated, true);
  assert.equal(result.findings[0].priority, "review");
  const evidence = result.findings[0].evidence[0];
  assert.ok(
    data.messages
      .find((item) => item.id === evidence.messageId)
      .text.includes(evidence.quote),
  );
});

test("rejects unsupported models, invented IDs, malformed probabilities and missing answers", async () => {
  for (const payload of [
    { model: "other-model", answers: {} },
    { model: EVALUATION_MODEL, answers: {} },
    {
      model: EVALUATION_MODEL,
      answers: {
        unanswered: {
          type: "choice",
          choice: "invented",
          probabilities: { invented: 1 },
        },
      },
    },
    {
      model: EVALUATION_MODEL,
      answers: {
        unanswered: {
          type: "choice",
          choice: "m0",
          probabilities: { none: 0, m0: 5 },
        },
      },
    },
  ])
    await assert.rejects(
      evaluateConversation(
        conversation,
        "support",
        options(async () => ({ ok: true, json: async () => payload })),
      ),
      { code: "INVALID_EVALUATION_RESPONSE" },
    );
});

test("invalid input and unconfigured analysis fail before network access", async () => {
  const fetchImpl = () => {
    throw new Error("must not fetch");
  };
  await assert.rejects(
    evaluateConversation(conversation, "unknown", options(fetchImpl)),
    { code: "INVALID_LENS" },
  );
  await assert.rejects(
    evaluateConversation(conversation, "support", {
      ...options(fetchImpl),
      apiKey: "",
    }),
    { code: "ANALYSIS_NOT_CONFIGURED" },
  );
  await assert.rejects(
    evaluateConversation(
      { messages: [conversation.messages[0], conversation.messages[0]] },
      "support",
      options(fetchImpl),
    ),
    { code: "INVALID_ANALYSIS_INPUT" },
  );
  assert.throws(
    () =>
      buildEvaluationRequest(
        prepareConversation(conversation, now),
        "other",
        now,
      ),
    { code: "INVALID_LENS" },
  );
});

test("timeouts and upstream errors never expose provider payloads or source text", async () => {
  await assert.rejects(
    evaluateConversation(conversation, "support", {
      ...options(() => new Promise(() => {})),
      timeoutMs: 5,
    }),
    { code: "ANALYSIS_TIMEOUT" },
  );
  await assert.rejects(
    evaluateConversation(
      conversation,
      "support",
      options(async () => ({
        ok: false,
        status: 429,
        json: async () => {
          throw new Error("must not read");
        },
      })),
    ),
    { code: "ANALYSIS_RATE_LIMITED" },
  );
  await assert.rejects(
    evaluateConversation(
      conversation,
      "support",
      options(async () => {
        throw new Error("secret provider payload");
      }),
    ),
    (failure) =>
      failure.code === "ANALYSIS_UNAVAILABLE" &&
      !failure.message.includes("secret"),
  );
});
