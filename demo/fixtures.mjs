/** Fictional, precomputed sample records. No customer data or live integrations. */
export const SAMPLE_NOW = "2026-09-18T16:00:00Z";
export const SAMPLE_DATE = "September 18, 2026 · 16:00 UTC";
export const PERIODS = {
  current: { label: "September 14–18, 2026" },
  previous: { label: "September 7–11, 2026" },
};
export const TEAMMATES = [
  { id: "alex", name: "Alex Morgan" },
  { id: "sam", name: "Sam Rivera" },
  { id: "jordan", name: "Jordan Lee" },
];
export const SOURCES = [
  {
    id: "support-inbox",
    name: "Support inbox",
    description:
      "Fictional customer email threads, including questions, replies, and handoffs.",
  },
  {
    id: "sales-inbox",
    name: "Sales inbox",
    description:
      "Fictional buying conversations, including objections and promised next steps.",
  },
];
export const CONVERSATIONS = [];
export const FINDINGS = [];
const time = (day, clock) =>
  `2026-09-${String(day).padStart(2, "0")}T${clock}:00Z`;
function conversation(
  id,
  lens,
  name,
  company,
  subject,
  tags,
  lines,
  period = "current",
) {
  const c = {
    id,
    lens,
    period,
    customer: {
      name,
      company,
      initials: name
        .split(" ")
        .map((v) => v[0])
        .join(""),
    },
    subject,
    sourceId: lens === "support" ? "support-inbox" : "sales-inbox",
    tags,
    messages: lines.map(([day, clock, role, text], i) => ({
      id: `${id}-m${i + 1}`,
      sender: role === "customer" ? name : "Alex Morgan",
      role,
      at: time(day, clock),
      text,
    })),
  };
  CONVERSATIONS.push(c);
  return c;
}
function finding(c, suffix, options) {
  const { evidence = [0], ...rest } = options;
  const f = {
    id: `${c.id}-${suffix}`,
    conversationId: c.id,
    type: "unanswered",
    priority: "attention",
    status: "open",
    ownerId: null,
    waitingSince: c.messages[0].at,
    dueAt: null,
    initialActivity: [
      {
        id: `${c.id}-${suffix}-initial`,
        at: c.messages.at(-1).at,
        text: "Finding added from the fictional sample conversation.",
      },
    ],
    ...rest,
    evidence: evidence.map((index) => ({
      messageId: c.messages[index].id,
      quote: c.messages[index].text,
    })),
  };
  if (f.status === "handled" || f.status === "dismissed") {
    f.initialActivity.push({
      id: `${f.id}-reviewed`,
      at: c.messages.at(-1).at,
      text:
        f.status === "handled"
          ? `Marked handled: ${f.outcome}`
          : `Dismissed: ${f.dismissReason}`,
    });
  } else if (f.status === "in-progress") {
    f.initialActivity.push({
      id: `${f.id}-started`,
      at: c.messages.at(-1).at,
      text: "A teammate started working on this finding.",
    });
  }
  FINDINGS.push(f);
  return f;
}
let c = conversation(
  "support-maya",
  "support",
  "Maya Chen",
  "Northline",
  "Restore workspace access",
  ["access"],
  [
    [
      18,
      "12:10",
      "customer",
      "How do I restore access to our workspace? I cannot get past the sign-in screen.",
    ],
    [
      18,
      "12:40",
      "teammate",
      "The invoice is now marked paid. Your billing details are up to date.",
    ],
    [
      18,
      "13:00",
      "customer",
      "Thanks, but I still cannot sign in. How do I restore access?",
    ],
  ],
);
finding(c, "access", {
  type: "repeat",
  title: "Asked twice how to restore access",
  summary:
    "The latest reply addressed billing, but the access question remains unanswered.",
  reason:
    "The customer repeated an access request after a billing reply. No answer to the access question appears in this thread. High priority reflects blocked access; waiting time starts with the latest request.",
  priority: "high",
  waitingSince: time(18, "13:00"),
  evidence: [0, 1, 2],
  suggestion:
    "Check the access issue and reply with the verified recovery step. Assign a teammate to own the response.",
  draft:
    "Hi Maya, I can see that you still cannot sign in even though billing is up to date. [Add the verified recovery step or the specific information needed to investigate.] Please let us know what happens after that step.",
});
c = conversation(
  "support-jon",
  "support",
  "Jon Bell",
  "Alder Works",
  "Workspace invitation",
  ["access", "handoff"],
  [
    [
      18,
      "14:00",
      "customer",
      "My invitation says it has expired. Could someone help me get into the workspace?",
    ],
    [
      18,
      "14:15",
      "teammate",
      "I have passed this question to our workspace team.",
    ],
  ],
);
finding(c, "invitation", {
  title: "Invitation expired before first sign-in",
  summary: "An access question was passed on without a recovery step.",
  reason:
    "The thread contains an expired invitation report and a handoff, but no answer appears in this thread.",
  priority: "high",
  ownerId: "sam",
  suggestion:
    "Verify the invitation status and provide the appropriate next step.",
  draft:
    "Hi Jon, thanks for flagging the expired invitation. [Add the verified invitation or recovery instructions.]",
  evidence: [0, 1],
});
finding(c, "owner", {
  type: "handoff",
  title: "Handoff has no named recipient",
  summary: "The reply mentions a workspace team but does not name an owner.",
  reason:
    "The handoff reply names a team, but no individual accepts the work in this thread.",
  suggestion:
    "Confirm who will own the invitation issue and record that assignment.",
  draft:
    "Hi Jon, [name of confirmed owner] will be your point of contact for the invitation issue.",
  evidence: [1],
});
c = conversation(
  "support-priya",
  "support",
  "Priya Shah",
  "Juniper Studio",
  "Reset link loops back",
  ["access"],
  [
    [
      18,
      "14:30",
      "customer",
      "The password reset link takes me back to the same screen. Which step should I try next?",
    ],
  ],
);
finding(c, "reset", {
  title: "Reset link leads back to the same screen",
  summary: "The customer needs a recovery step to regain access.",
  reason:
    "The latest message asks for a next step. No answer appears in this thread.",
  status: "in-progress",
  ownerId: "alex",
  suggestion:
    "Check the reported reset behavior and provide a verified recovery step.",
  draft:
    "Hi Priya, I understand the reset link returns you to the same screen. [Add a verified recovery step or a specific diagnostic question.]",
});
c = conversation(
  "support-theo",
  "support",
  "Theo Grant",
  "Harbor Supply",
  "Export update promised",
  ["promise", "export"],
  [
    [
      17,
      "13:00",
      "customer",
      "Our export stops after the first page. Can you help?",
    ],
    [
      17,
      "14:00",
      "teammate",
      "I will post an update here by 15:00 UTC on September 17.",
    ],
    [18, "09:00", "customer", "Is there an update on the export issue?"],
  ],
);
finding(c, "update", {
  type: "promise",
  title: "Promised export update has not appeared",
  summary: "The promised September 17 update is overdue in this thread.",
  reason:
    "A teammate promised an update by September 17 at 15:00 UTC. The sample clock is past that deadline, and no later update appears in this thread.",
  waitingSince: time(18, "09:00"),
  dueAt: time(17, "15:00"),
  ownerId: "alex",
  suggestion:
    "Check the export investigation and share a verified update without inventing a completion date.",
  draft:
    "Hi Theo, the update promised for September 17 has not appeared here. [Add the verified status of the export investigation.] [Add a next update time only after confirming it.]",
  evidence: [1, 2],
});
c = conversation(
  "support-elena",
  "support",
  "Elena Ruiz",
  "Cedar House",
  "Duplicate invoice handoff",
  ["handoff", "billing"],
  [
    [
      18,
      "10:00",
      "customer",
      "We received two invoices for the same subscription period. Can you check which one applies?",
    ],
    [18, "10:20", "teammate", "The billing team will need to review this."],
  ],
);
finding(c, "billing", {
  type: "handoff",
  title: "Billing handoff needs an owner",
  summary: "The duplicate-invoice question has no named next owner.",
  reason:
    "The reply points to billing without a named recipient or an answer. This does not establish that no work happened elsewhere.",
  suggestion:
    "Assign someone to verify the invoices and answer which one applies.",
  draft:
    "Hi Elena, [confirmed owner] is reviewing the two invoices. [Add the verified invoice information before using this reply.]",
  evidence: [0, 1],
});
c = conversation(
  "support-leo",
  "support",
  "Leo Park",
  "Wren Design",
  "Clarifying an export reply",
  ["export"],
  [
    [
      18,
      "11:00",
      "customer",
      "I think that answers it, unless the same limit also applies to scheduled exports.",
    ],
    [18, "11:10", "teammate", "Glad that helped."],
  ],
);
finding(c, "clarify", {
  title: "Scheduled-export question may still be open",
  summary: "A conditional question may have been missed in the closing reply.",
  reason:
    "The customer says the answer may depend on scheduled exports. That wording is ambiguous, so this needs human review; it is not evidence of a definite failure.",
  priority: "review",
  suggestion:
    "Check whether the scheduled-export limit was answered and clarify if necessary.",
  draft:
    "Hi Leo, to clarify the scheduled-export part of your question: [add the verified limit or behavior].",
  evidence: [0, 1],
});
c = conversation(
  "support-amara",
  "support",
  "Amara Okafor",
  "Pine & Co",
  "Notification preferences",
  ["notifications"],
  [
    [
      17,
      "15:00",
      "customer",
      "Where can I turn off the daily digest without disabling alerts?",
    ],
    [
      18,
      "08:00",
      "customer",
      "Following up on the daily digest setting. I still need alerts to stay on.",
    ],
  ],
);
finding(c, "digest", {
  type: "repeat",
  title: "Digest preference request repeated",
  summary: "Two messages ask how to keep alerts while turning off the digest.",
  reason:
    "The same preference question appears twice. No answer appears in this thread.",
  ownerId: "jordan",
  waitingSince: time(18, "08:00"),
  suggestion:
    "Verify the notification controls and explain the separate settings.",
  draft:
    "Hi Amara, you want to stop the daily digest while keeping alerts. [Add the verified settings path and available controls.]",
  evidence: [0, 1],
});
c = conversation(
  "support-iris",
  "support",
  "Iris Cole",
  "Willow Labs",
  "Access recovery follow-through",
  ["access"],
  [
    [16, "10:00", "customer", "My account cannot open our workspace."],
    [
      16,
      "10:30",
      "teammate",
      "Please try the new invitation in the separate invitation email.",
    ],
    [
      16,
      "11:00",
      "customer",
      "I received the invitation and will try it this afternoon.",
    ],
  ],
);
finding(c, "access", {
  title: "Access recovery step provided",
  summary: "A teammate recorded the recovery guidance as handled.",
  reason:
    "The recovery guidance is present. The customer has not confirmed successful access in this thread.",
  status: "handled",
  ownerId: "sam",
  suggestion:
    "Reopen if the customer reports that the invitation did not restore access.",
  draft:
    "Hi Iris, were you able to open the workspace with the new invitation?",
  outcome:
    "Provided the verified invitation step. Customer success is not confirmed.",
  evidence: [0, 1, 2],
});
c = conversation(
  "support-nora",
  "support",
  "Nora Evans",
  "Birch Systems",
  "Receipt location",
  ["billing"],
  [
    [
      16,
      "12:00",
      "customer",
      "Do I need a new receipt? Actually, I found the existing one in billing. All set.",
    ],
  ],
);
finding(c, "receipt", {
  title: "Receipt question already answered by customer",
  summary: "The customer found the receipt in the same message.",
  reason:
    "The complete message resolves the initial question. This sample finding was dismissed after review.",
  priority: "review",
  status: "dismissed",
  ownerId: "jordan",
  dismissReason: "Customer already found the receipt.",
  suggestion: "Keep dismissed unless a new question arrives.",
  draft: "Hi Nora, thanks for confirming you found the receipt.",
});

c = conversation(
  "sales-dana",
  "sales",
  "Dana Brooks",
  "Oakridge",
  "Security review before pilot",
  ["buying-question", "security"],
  [
    [
      18,
      "12:30",
      "customer",
      "Before we can approve a pilot, where is conversation data stored and how long is it retained?",
    ],
    [
      18,
      "12:45",
      "teammate",
      "The pilot package includes a kickoff session and a shared success plan.",
    ],
  ],
);
finding(c, "security", {
  title: "Security questions are blocking the pilot",
  summary:
    "The reply explained the pilot package but did not address storage or retention.",
  reason:
    "The buyer explicitly links approval to storage and retention answers. No answer to those questions appears in this thread.",
  priority: "high",
  suggestion:
    "Ask the appropriate specialist to verify storage and retention details before replying.",
  draft:
    "Hi Dana, your review needs specifics on storage and retention. [Insert verified data-location and retention details, with the relevant documentation.]",
  evidence: [0, 1],
});
c = conversation(
  "sales-omar",
  "sales",
  "Omar Hassan",
  "Maple Retail",
  "Evaluation material",
  ["promise", "buying-question"],
  [
    [
      17,
      "10:00",
      "customer",
      "Can you send the evaluation checklist? We need it for our internal review.",
    ],
    [
      17,
      "10:15",
      "teammate",
      "I will share the checklist here by 14:00 UTC on September 17.",
    ],
  ],
);
finding(c, "checklist", {
  type: "promise",
  title: "Promised evaluation checklist is missing",
  summary: "No checklist appears after the promised delivery time.",
  reason:
    "The stated September 17 deadline has passed on the sample clock. No checklist or delivery confirmation appears in this thread.",
  dueAt: time(17, "14:00"),
  ownerId: "alex",
  suggestion:
    "Locate the approved checklist and prepare a reply with the verified link.",
  draft:
    "Hi Omar, here is the evaluation checklist for your internal review: [verified checklist link]. [Add any confirmed context your reviewers need.]",
  evidence: [0, 1],
});
finding(c, "question", {
  title: "Request for evaluation material remains open",
  summary: "The buyer still needs the checklist to continue the review.",
  reason:
    "The requested checklist is not included anywhere in this sample thread.",
  ownerId: "alex",
  suggestion: "Verify and include the checklist link.",
  draft:
    "Hi Omar, the checklist for your evaluation is here: [verified checklist link].",
});
c = conversation(
  "sales-lena",
  "sales",
  "Lena Foster",
  "Ashford",
  "Pricing structure",
  ["buying-question", "pricing"],
  [
    [
      18,
      "09:30",
      "customer",
      "Does the quoted price include both support and sales conversations, or is each team billed separately?",
    ],
  ],
);
finding(c, "pricing", {
  title: "Buyer is waiting on pricing scope",
  summary: "The quote has not clarified whether both teams are included.",
  reason:
    "The buyer asks a specific question about the scope of a quote. No answer appears in this thread.",
  status: "in-progress",
  ownerId: "sam",
  suggestion: "Verify the quote terms and explain which teams are covered.",
  draft:
    "Hi Lena, regarding the quote scope: [add verified pricing and team-coverage terms].",
});
c = conversation(
  "sales-ben",
  "sales",
  "Ben Torres",
  "Elm Partners",
  "Implementation concern",
  ["objection", "implementation"],
  [
    [
      18,
      "10:30",
      "customer",
      "We are interested, but our team cannot take on a lengthy setup project this quarter.",
    ],
    [
      18,
      "10:45",
      "teammate",
      "There are several features your team could use.",
    ],
  ],
);
finding(c, "setup", {
  type: "objection",
  title: "Setup effort concern has not been addressed",
  summary: "The buyer raised team capacity; the reply returned to features.",
  reason:
    "The reply does not address the stated implementation concern. This is an unresolved objection in this thread, not a prediction that the deal will be lost.",
  suggestion:
    "Clarify the buyer’s capacity and verify the smallest feasible evaluation scope.",
  draft:
    "Hi Ben, I understand setup effort is the constraint this quarter. [Add verified setup requirements.] Would a discussion about a smaller evaluation scope be useful?",
  evidence: [0, 1],
});
c = conversation(
  "sales-sophie",
  "sales",
  "Sophie Tran",
  "Redwood",
  "Technical evaluation owner",
  ["handoff", "buying-question"],
  [
    [
      18,
      "11:30",
      "customer",
      "Who should our engineer speak to about read-only access for the evaluation?",
    ],
    [18, "11:45", "teammate", "Our technical team can help with that."],
  ],
);
finding(c, "handoff", {
  type: "handoff",
  title: "Technical next step has no named owner",
  summary: "The buyer asked for a contact and received only a team name.",
  reason: "No individual contact or accepted handoff appears in this thread.",
  suggestion:
    "Confirm the technical owner and introduce them with the buyer’s question.",
  draft:
    "Hi Sophie, [confirmed technical owner] is the right contact to discuss read-only access. [Add an agreed introduction or contact method.]",
  evidence: [0, 1],
});
c = conversation(
  "sales-marcus",
  "sales",
  "Marcus Reed",
  "Spruce Group",
  "Integration question",
  ["buying-question", "integration"],
  [
    [
      18,
      "08:00",
      "customer",
      "Can the evaluation use our existing support inbox without writing back to it?",
    ],
    [
      18,
      "13:00",
      "customer",
      "Checking on the read-only inbox question before I involve our admin.",
    ],
  ],
);
finding(c, "inbox", {
  type: "repeat",
  title: "Read-only inbox question asked twice",
  summary: "The buyer is waiting for an answer before involving their admin.",
  reason:
    "Two messages ask about read-only inbox access. No answer appears in this thread.",
  ownerId: "jordan",
  waitingSince: time(18, "13:00"),
  suggestion:
    "Verify the supported integration permissions and answer the specific read-only question.",
  draft:
    "Hi Marcus, regarding read-only access to your support inbox: [insert verified integration and permission details].",
  evidence: [0, 1],
});
c = conversation(
  "sales-ava",
  "sales",
  "Ava Kim",
  "Hawthorn",
  "Possible stakeholder request",
  ["buying-question"],
  [
    [
      18,
      "14:00",
      "customer",
      "This might be worth showing to operations, though I need to check whether they want to join first.",
    ],
  ],
);
finding(c, "stakeholder", {
  title: "Possible stakeholder next step needs review",
  summary:
    "The buyer may want operations involved, but has not requested a meeting.",
  reason:
    "The wording is tentative and contains no agreed next step. Human review should decide whether clarification would be helpful; no follow-up is overdue.",
  priority: "review",
  suggestion:
    "Review the context before deciding whether to offer a brief introduction.",
  draft:
    "Hi Ava, if operations would find it useful, we can discuss what information they need. [Add only a confirmed, relevant resource.]",
});
c = conversation(
  "sales-hugo",
  "sales",
  "Hugo Silva",
  "Linden",
  "Pilot scope clarified",
  ["buying-question"],
  [
    [16, "09:00", "customer", "Which inbox would be included in the pilot?"],
    [
      16,
      "09:30",
      "teammate",
      "The draft scope names only the shared support inbox. Please review the scope document before agreeing.",
    ],
  ],
);
finding(c, "scope", {
  title: "Pilot inbox scope clarified",
  summary: "The requested scope detail was provided for buyer review.",
  reason:
    "The thread includes a direct scope answer. The buyer has not approved the scope in this thread.",
  status: "handled",
  ownerId: "alex",
  outcome: "Provided the scope detail for buyer review.",
  suggestion: "Reopen if the buyer needs further clarification.",
  draft: "Hi Hugo, do you have any questions about the shared-inbox scope?",
  evidence: [0, 1],
});
c = conversation(
  "sales-ruby",
  "sales",
  "Ruby Wallace",
  "Aspen",
  "Timing belongs to the buyer",
  ["timing"],
  [
    [
      16,
      "11:00",
      "customer",
      "We are pausing this evaluation. I’ll return next month when the planning cycle opens.",
    ],
    [
      16,
      "11:20",
      "teammate",
      "Understood. We will wait for you to restart the conversation.",
    ],
  ],
);
// Deliberately unflagged: the buyer chose next month and no earlier promise exists.
c = conversation(
  "sales-eli",
  "sales",
  "Eli Price",
  "Beech",
  "Calendar reference clarified",
  ["timing"],
  [
    [
      16,
      "12:00",
      "customer",
      "The date in my previous message was for our internal planning meeting, not a meeting with your team.",
    ],
  ],
);
finding(c, "calendar", {
  title: "Internal date was not a sales commitment",
  summary: "The buyer clarified the date referred to their own planning.",
  reason:
    "No commitment by a teammate appears here. The timing interpretation was dismissed after review.",
  priority: "review",
  status: "dismissed",
  dismissReason: "The date was an internal meeting, not an agreed follow-up.",
  suggestion: "Keep dismissed; there is no agreed sales follow-up to enforce.",
  draft: "Hi Eli, thanks for clarifying the internal planning date.",
});

const quietTopics = [
  [
    "Report delivery",
    "reporting",
    "The weekly report arrived. Where can I change its recipients?",
    "You can manage recipients from the report settings page.",
    "Found the setting, thank you.",
  ],
  [
    "Timezone display",
    "settings",
    "Can reports show our local timezone?",
    "The timezone selector is in report settings.",
    "I changed it and the dates now look right.",
  ],
  [
    "Workspace naming",
    "settings",
    "Can we rename the workspace?",
    "Workspace administrators can edit its name in workspace settings.",
    "That worked, thanks.",
  ],
  [
    "Export format",
    "export",
    "Is CSV available for this report?",
    "The export menu includes a CSV option for this report.",
    "Downloaded the CSV successfully.",
  ],
  [
    "Digest schedule",
    "notifications",
    "Where is the weekly digest schedule?",
    "The schedule is listed under notification preferences.",
    "I found it. No further questions.",
  ],
  [
    "Review agenda",
    "evaluation",
    "Can we focus our next review on the sample findings?",
    "Yes, the draft agenda is limited to reviewing the sample findings.",
    "That is the scope we wanted.",
  ],
  [
    "Documentation location",
    "documentation",
    "Where is the evaluation guide?",
    "The guide is attached to the evaluation email you received yesterday.",
    "I have the attachment now.",
  ],
  [
    "Team labels",
    "settings",
    "Are the team names editable in the workspace?",
    "The team settings page includes the display-name field.",
    "That answers my question.",
  ],
  [
    "Review ownership",
    "handoff",
    "Who owns our next review?",
    "I am the named owner for the review and will remain your contact.",
    "Thanks for confirming ownership.",
  ],
  [
    "Existing receipt",
    "billing",
    "I needed the receipt but found it in the billing email.",
    "Thanks for confirming you found it.",
    "All set here.",
  ],
  [
    "Evaluation paused",
    "timing",
    "We have chosen to pause until next month. No action needed this week.",
    "Understood, we will wait for your update.",
    "Thank you.",
  ],
  [
    "Checklist received",
    "evaluation",
    "The checklist came through. We will review it internally.",
    "Let us know if any questions arise during your review.",
    "Will do.",
  ],
  [
    "Access checked",
    "settings",
    "The link works now; I can see the workspace.",
    "Thanks for checking and confirming.",
    "No further help needed.",
  ],
  [
    "Data example",
    "documentation",
    "Can you point me to the fictional example?",
    "The demo workspace is labeled Sample workspace throughout.",
    "That is the example I needed.",
  ],
  [
    "Notification labels",
    "notifications",
    "What does the daily digest label mean?",
    "It refers to the daily summary, separate from individual alerts.",
    "Clear now, thanks.",
  ],
  [
    "Review complete",
    "evaluation",
    "Our internal review is complete; there are no further questions today.",
    "Thanks for the update.",
    "We will reach out if anything changes.",
  ],
  [
    "Export confirmed",
    "export",
    "The export completed and the file opens correctly.",
    "Thank you for confirming the result.",
    "All set.",
  ],
  [
    "Billing period",
    "billing",
    "Which period does this receipt cover?",
    "The receipt lists the service period beneath the invoice date.",
    "I see the dates now.",
  ],
  [
    "Contact confirmed",
    "handoff",
    "Is Alex our contact for this review?",
    "Yes, I am the owner of this review.",
    "Great, thank you.",
  ],
  [
    "Guide understood",
    "documentation",
    "The guide answers our setup questions.",
    "Glad the guide covered what you needed.",
    "We have nothing else to ask today.",
  ],
];
const names = [
  "Tessa Lane",
  "Noah Ellis",
  "Zoe Carter",
  "Isaac Moore",
  "Nina Patel",
  "Evan Clarke",
  "Grace Lin",
  "Oscar James",
  "Alice Wong",
  "Caleb Stone",
  "Mila Ross",
  "Felix Ward",
  "Chloe Adams",
  "Adam West",
  "Sana Ali",
  "Lucas Hart",
  "Isla Young",
  "Daniel Fox",
  "Mina Blake",
  "Aaron Chen",
];
function fill(lens, period, target) {
  let count = CONVERSATIONS.filter(
    (c) => c.lens === lens && c.period === period,
  ).length;
  for (let i = 0; count < target; i++, count++) {
    const [subject, tag, question, reply, confirmation] = quietTopics[i];
    conversation(
      `${lens}-${period}-quiet-${i + 1}`,
      lens,
      names[i],
      `${["Fern", "Clover", "Laurel", "Acacia", "Poplar"][i % 5]} ${["Studio", "Works", "Labs", "Partners"][Math.floor(i / 5)]}`,
      subject,
      [tag],
      [
        [period === "current" ? 15 : 8, "09:00", "customer", question],
        [period === "current" ? 15 : 8, "09:20", "teammate", reply],
        [period === "current" ? 15 : 8, "10:00", "customer", confirmation],
      ],
      period,
    );
  }
}
for (const lens of ["support", "sales"]) {
  fill(lens, "current", 24);
  if (lens === "support") {
    for (const [suffix, name, company] of [
      ["drew", "Drew Fields", "Magnolia"],
      ["jules", "Jules Hart", "Sequoia"],
    ]) {
      c = conversation(
        `support-previous-${suffix}`,
        lens,
        name,
        company,
        "Access recovery",
        ["access"],
        [
          [
            9,
            "09:00",
            "customer",
            "I cannot open the workspace with my existing invitation.",
          ],
          [
            9,
            "09:30",
            "teammate",
            "Please use the replacement invitation in the invitation email.",
          ],
          [
            9,
            "10:00",
            "customer",
            "The replacement invitation worked. I can access the workspace.",
          ],
        ],
        "previous",
      );
      finding(c, "access", {
        title: "Earlier access request answered",
        summary:
          "The customer confirmed access after the replacement invitation.",
        reason:
          "The thread contains recovery guidance and customer confirmation.",
        status: "handled",
        ownerId: "sam",
        outcome: "Customer confirmed restored access.",
        suggestion:
          "No further action is indicated by this sample conversation.",
        draft: "Thanks for confirming that you can access the workspace.",
        evidence: [0, 1, 2],
      });
    }
  }
  fill(lens, "previous", 20);
}
