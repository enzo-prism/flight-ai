import { CONVERSATIONS, FINDINGS, SAMPLE_NOW } from "./fixtures.mjs";
import { analyzeConversation } from "./analysis.mjs";
const NOW = Date.parse(SAMPLE_NOW);
const active = (f) => f.status === "open" || f.status === "in-progress";
const overdue = (f) =>
  f.type === "promise" && f.dueAt && Date.parse(f.dueAt) < NOW && active(f);
const unanswered = (f) =>
  ["unanswered", "repeat"].includes(f.type) &&
  f.priority !== "review" &&
  active(f);
const severity = { high: 0, attention: 1, review: 2 };
export function getConversation(id) {
  return CONVERSATIONS.find((c) => c.id === id);
}
export function getFinding(id, state = {}) {
  const fixture = FINDINGS.find((f) => f.id === id);
  if (!fixture) return undefined;
  const override = state?.findings?.[id] || {};
  return {
    ...fixture,
    ...override,
    activity: override.activity || fixture.initialActivity,
  };
}
function compare(a, b) {
  return (
    severity[a.priority] - severity[b.priority] ||
    Number(Boolean(overdue(b))) - Number(Boolean(overdue(a))) ||
    Date.parse(a.waitingSince) - Date.parse(b.waitingSince) ||
    a.id.localeCompare(b.id)
  );
}
export function getRows(lens, filters = {}, state = {}) {
  const f = {
    status: "active",
    owner: "all",
    q: "",
    type: "all",
    priority: "all",
    period: "current",
    tag: "all",
    metric: "all",
    ...filters,
  };
  const status =
    f.metric === "reviewed" ? "all" : f.metric === "open" ? "active" : f.status;
  const query = String(f.q || "")
    .trim()
    .toLocaleLowerCase();
  return CONVERSATIONS.filter(
    (c) =>
      c.lens === lens &&
      c.period === f.period &&
      (f.tag === "all" || c.tags.includes(f.tag)),
  )
    .map((conversation) => {
      const all = analyzeConversation(conversation.id).map((item) =>
        getFinding(item.id, state),
      );
      const findings = all
        .filter(
          (item) =>
            (status === "all" ||
              (status === "active" ? active(item) : item.status === status)) &&
            (f.owner === "all" ||
              (f.owner === "unassigned"
                ? !item.ownerId
                : item.ownerId === f.owner)) &&
            (f.type === "all" || item.type === f.type) &&
            (f.priority === "all" || item.priority === f.priority) &&
            (f.metric !== "overdue" || overdue(item)) &&
            (f.metric !== "unanswered" || unanswered(item)),
        )
        .sort(compare);
      const includeUnflagged =
        !all.length &&
        status === "all" &&
        f.owner === "all" &&
        f.type === "all" &&
        f.priority === "all" &&
        ["all", "reviewed"].includes(f.metric);
      const searchable = [
        conversation.customer.name,
        conversation.customer.company,
        conversation.subject,
        ...conversation.messages.map((m) => m.text),
        ...all.flatMap((item) => [item.title, item.summary]),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (findings.length || includeUnflagged) &&
        (!query || searchable.includes(query))
        ? { conversation, findings, primary: findings[0] || null }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.primary && b.primary
        ? compare(a.primary, b.primary)
        : a.primary
          ? -1
          : b.primary
            ? 1
            : a.conversation.id.localeCompare(b.conversation.id),
    );
}
export function getOverview(lens, state = {}) {
  const current = CONVERSATIONS.filter(
    (c) => c.lens === lens && c.period === "current",
  );
  const previous = CONVERSATIONS.filter(
    (c) => c.lens === lens && c.period === "previous",
  );
  const reviewed = current.length;
  const open = getRows(lens, { metric: "open" }, state).length;
  const thirdMetric = lens === "sales" ? "unanswered" : "overdue";
  const thirdLabel =
    lens === "sales" ? "Unanswered buying questions" : "Overdue promises";
  const third = getRows(lens, { metric: thirdMetric }, state).length;
  const definitions =
    lens === "sales"
      ? [
          {
            id: "buying-question",
            title: "Buying questions need a clear answer",
            topic: "mention buying questions or possible next steps",
          },
          {
            id: "handoff",
            title: "Handoffs need a named owner",
            topic: "mention a handoff or review owner",
          },
          {
            id: "objection",
            title: "Setup concerns need a practical response",
            topic: "raise a setup concern",
          },
        ]
      : [
          {
            id: "access",
            title: "Access issues keep coming back",
            topic: "mention access trouble",
          },
          {
            id: "handoff",
            title: "Handoffs need a clear owner",
            topic: "mention a handoff or review owner",
          },
          {
            id: "export",
            title: "Export questions need follow-through",
            topic: "mention exports",
          },
        ];
  const patterns = definitions.map(({ id, title, topic }) => {
    const currentCount = current.filter((c) => c.tags.includes(id)).length;
    const previousCount = previous.filter((c) => c.tags.includes(id)).length;
    const openCount = getRows(lens, { tag: id }, state).length;
    return {
      id,
      title,
      current: currentCount,
      previous: previousCount,
      currentTotal: reviewed,
      previousTotal: previous.length,
      open: openCount,
      description: `${currentCount} of ${reviewed} reviewed conversations ${topic} in the current sample week, compared with ${previousCount} of ${previous.length} in the previous sample week. ${openCount} currently ${openCount === 1 ? "has" : "have"} an open finding.`,
      filters: {
        status: "all",
        period: "current",
        tag: id,
        metric: "reviewed",
      },
    };
  });
  const decisions =
    lens === "sales"
      ? [
          {
            title: "Give buyers verified answers before the next step",
            description: `Review the ${third} conversation${third === 1 ? "" : "s"} with unanswered buying questions and decide who can verify each answer.`,
            filters: { metric: "unanswered" },
          },
          {
            title: "Make technical ownership explicit",
            description:
              "Review the handoff evidence and confirm an owner before promising an introduction.",
            filters: { tag: "handoff" },
          },
        ]
      : [
          {
            title: "Agree on a consistent access recovery response",
            description:
              "Review the access threads and decide which verified recovery guidance the team should use.",
            filters: { tag: "access" },
          },
          {
            title: "Review overdue commitments",
            description: `Check the ${third} conversation${third === 1 ? "" : "s"} with an overdue promise and decide what update can be provided.`,
            filters: { metric: "overdue" },
          },
        ];
  return {
    reviewed,
    open,
    third,
    thirdLabel,
    metrics: [
      {
        label: "Conversations reviewed",
        count: reviewed,
        filters: { metric: "reviewed", status: "all" },
      },
      {
        label: "Conversations with open findings",
        count: open,
        filters: { metric: "open" },
      },
      { label: thirdLabel, count: third, filters: { metric: thirdMetric } },
    ],
    patterns,
    decisions,
  };
}
export function waitingLabel(iso) {
  const elapsed = Math.max(0, NOW - Date.parse(iso));
  if (!Number.isFinite(elapsed)) return "—";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
export function priorityLabel(key) {
  return (
    {
      high: "High priority",
      attention: "Needs attention",
      review: "Review needed",
    }[key] || "Review needed"
  );
}
export function statusLabel(key) {
  return (
    {
      open: "Open",
      "in-progress": "In progress",
      handled: "Handled",
      dismissed: "Dismissed",
    }[key] || "Open"
  );
}
