const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = process.env.SITE_URL || "http://127.0.0.1:8093";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(x.message));
  let user = null,
    workspace = null,
    connections = [],
    findings = [],
    conversations = [],
    scans = [];
  const catalog = ["gmail", "microsoft", "hubspot", "zendesk", "intercom"].map(
    (id, i) => ({
      id,
      name: ["Gmail", "Microsoft 365", "HubSpot", "Zendesk", "Intercom"][i],
      description: "Read-only conversation source",
      ready: true,
    }),
  );
  await page.route("**/api/product?*", async (route) => {
    const req = route.request(),
      action = new URL(req.url()).searchParams.get("action"),
      body = req.postDataJSON();
    let data = { ok: true };
    if (action === "config")
      data = {
        serviceReady: true,
        analysisReady: true,
        auth: { email: true, google: true, apple: true, sso: true },
        connectors: catalog,
      };
    if (action === "session") data = { user, workspace, connections };
    if (action === "auth.signup" || action === "auth.login") {
      user = { id: "test-user", email: "person@example.invalid" };
      data = { ok: true, confirmationRequired: false };
    }
    if (action === "workspace" && req.method() === "POST") {
      workspace = {
        id: "test-workspace",
        name: "My workspace",
        lens: null,
        ...workspace,
        ...body,
      };
      data = { ok: true, workspace };
    }
    if (action === "workspace" && req.method() === "GET")
      data = {
        workspace,
        connections,
        findings,
        conversations,
        runs: scans,
        coverage: { partial: false },
      };
    if (action === "connector.start") {
      connections = [
        {
          id: "test-connection",
          provider: body.provider,
          status: "authorized",
          last_synced_at: null,
          has_more: true,
        },
      ];
      data = { url: base + "/app.html?connected=1" };
    }
    if (action === "connector.disconnect") {
      connections = [];
    }
    if (action === "scan") {
      const now = new Date().toISOString();
      conversations = [
        {
          id: "test-conversation",
          subject: "Access request",
          customer: { name: "Test Customer", company: "Example" },
          messages: [
            {
              id: "m1",
              sender: "Test Customer",
              at: now,
              text: "How can I restore access?",
            },
          ],
          reviewed_at: now,
        },
      ];
      findings = [
        {
          id: "test-finding",
          conversation_id: "test-conversation",
          type: "unanswered",
          title: "Access question remains open",
          summary: "No answer in the reviewed messages.",
          reason: "Customer asked for recovery guidance.",
          priority: "attention",
          status: "open",
          owner: null,
          analysis_current: true,
          evidence: [{ messageId: "m1", quote: "How can I restore access?" }],
          suggestion: "Verify recovery guidance.",
          draft: "Hi, [verified recovery steps].",
          activity: [],
        },
      ];
      scans = [
        {
          id: "run",
          status: "completed",
          reviewed_count: 1,
          has_more: false,
          started_at: now,
          finished_at: now,
        },
      ];
      connections[0].last_synced_at = now;
      connections[0].has_more = false;
    }
    if (action === "finding.update") {
      const f = findings.find((f) => f.id === body.id);
      Object.assign(f, body);
      if (body.dismissReason) f.dismiss_reason = body.dismissReason;
    }
    if (action === "auth.logout") {
      user = null;
      workspace = null;
      connections = [];
    }
    await route.fulfill({ json: data });
  });
  const scan = async (label) => {
    if (!process.env.AXE_MODULE) return;
    await page.addScriptTag({ path: require.resolve(process.env.AXE_MODULE) });
    const r = await page.evaluate(() =>
      axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    assert.deepEqual(
      r.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      [],
      label,
    );
    console.log("Accessibility passed:", label);
  };
  await page.goto(base + "/app.html");
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  await scan("account entry");
  await page.getByLabel("Work email").fill("person@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-test-password");
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  await page.getByRole("heading", { name: "Connect your tools" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Continue →", exact: true })
      .isDisabled(),
    true,
  );
  await scan("connector selection");
  await page
    .locator(".connector-option")
    .first()
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await page.getByText("Authorized", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page
    .getByRole("heading", { name: "How will you use Mach 1?" })
    .waitFor();
  await page.locator("input[value=sales]").check();
  await scan("role selection");
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await page.getByRole("heading", { name: "What needs attention" }).waitFor();
  assert.equal(workspace.lens, "sales");
  assert.equal(await page.locator(".conversation-row").count(), 0);
  await scan("real empty workspace");
  await page.getByRole("link", { name: "Connections", exact: true }).click();
  await page
    .getByRole("heading", { name: "Connect your conversations" })
    .waitFor();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Scan next batch" }).click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Last analysis:"),
  );
  await page.getByRole("link", { name: "Priorities", exact: true }).click();
  await page.locator(".conversation-row").click();
  await page.getByRole("heading", { name: "Conversation evidence" }).waitFor();
  assert.equal(
    await page.locator("mark").first().innerText(),
    "How can I restore access?",
  );
  await page.locator("#customer-draft").fill("Edited [verified details].");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForFunction(() =>
    document.querySelector("#live-status").textContent.includes("Draft saved"),
  );
  assert.equal(findings[0].draft, "Edited [verified details].");
  await page.getByRole("button", { name: "Copy draft" }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "Edited [verified details].",
  );
  await scan("finding evidence and actions");
  await page.locator("select[name=status]").selectOption("handled");
  await page.locator("[name=note]").fill("Guidance reviewed.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForFunction(() =>
    document.querySelector(".detail-meta").innerText.includes("Handled"),
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.locator(".metrics-grid").waitFor();
  assert.equal(await page.locator(".metric-value").nth(1).innerText(), "0");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await scan("mobile overview");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 0);
  await scan("mobile sign in");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mocked-provider product onboarding, connector authorization, Sales config, scan, evidence, drafts, outcomes, derived metrics, logout; no credentials in browser storage. Live services tested separately.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
