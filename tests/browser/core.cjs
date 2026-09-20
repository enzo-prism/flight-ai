const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = process.env.SITE_URL || "http://127.0.0.1:8080";
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
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/sample.html");
  await page
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  assert.equal(await page.locator(".conversation-row").count(), 7);
  assert.match(
    await page.locator(".conversation-row").first().innerText(),
    /Maya Chen[\s\S]*Waiting 3h/,
  );
  await page.locator(".conversation-row").first().click();
  assert.equal((await page.locator(".evidence-list mark").count()) > 0, true);
  await page.locator("#finding-owner").selectOption({ index: 1 });
  assert.match(await page.locator("#toast").innerText(), /Assigned/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator("#finding-owner").inputValue(), "");
  await page
    .getByRole("button", { name: "Start working", exact: true })
    .click();
  assert.match(await page.locator(".detail-meta").innerText(), /In progress/);
  await page
    .getByRole("button", { name: "Draft follow-up", exact: true })
    .click();
  const draft = await page.locator("#follow-up-draft").inputValue();
  assert.ok(draft.includes("["));
  await page
    .locator("#follow-up-draft")
    .fill(
      "Hi Maya,\n[Verified recovery steps]. Please confirm whether you can sign in.",
    );
  await page.getByRole("button", { name: "Copy draft", exact: true }).click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /Verified recovery/,
  );
  await page.getByRole("button", { name: "Close draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Draft follow-up", exact: true })
    .click();
  assert.match(
    await page.locator("#follow-up-draft").inputValue(),
    /Verified recovery/,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Draft follow-up", exact: true })
    .click();
  assert.match(
    await page.locator("#follow-up-draft").inputValue(),
    /Verified recovery/,
  );
  await page.getByRole("button", { name: "Mark handled", exact: true }).click();
  await page
    .locator("#outcome-text")
    .fill("Reviewed the recovery guidance and prepared a follow-up.");
  await page.getByRole("button", { name: "Save outcome", exact: true }).click();
  assert.match(await page.locator(".detail-meta").innerText(), /Handled/);
  await page
    .getByRole("button", { name: "Reopen finding", exact: true })
    .click();
  assert.match(
    await page.locator(".activity-list").innerText(),
    /Marked handled[\s\S]*Started working/,
  );
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page
    .locator("#outcome-text")
    .fill("Needs a human review of another source.");
  await page
    .getByRole("button", { name: "Dismiss finding", exact: true })
    .click();
  assert.match(await page.locator(".detail-meta").innerText(), /Dismissed/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.match(await page.locator(".detail-meta").innerText(), /Open/);
  await page
    .getByRole("button", { name: "Preview the workflow", exact: false })
    .click();
  await page.locator("#workflow-approver").selectOption({ index: 2 });
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  assert.match(
    await page.locator("#workflow-result").innerText(),
    /Awaiting approval[\s\S]*No message was sent/,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#modal").evaluate((e) => e.open), false);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  assert.equal(await page.locator(".metric-value").first().innerText(), "24");
  await page.locator(".metric").first().click();
  await page.waitForFunction(
    () => document.querySelectorAll(".conversation-row").length === 24,
  );
  assert.equal(await page.locator(".conversation-row").count(), 24);
  assert.ok(
    (await page
      .locator(".conversation-row")
      .filter({ hasText: "No finding" })
      .count()) > 0,
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.locator(".pattern-row").first().getByRole("link").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".conversation-row").length === 4,
  );
  assert.equal(await page.locator(".conversation-row").count(), 4);
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  assert.equal(await page.locator(".conversation-row").count(), 7);
  await page.locator(".conversation-row").first().click();
  assert.ok((await page.locator(".evidence-list mark").count()) > 0);
  await page
    .getByRole("button", { name: "Back to conversations", exact: false })
    .click();
  await page.getByRole("link", { name: "Connections", exact: true }).click();
  await page.getByRole("heading", { name: "Understand the source" }).waitFor();
  assert.ok(
    (await page.getByText("Sample source", { exact: true }).count()) > 0,
  );
  await page
    .getByRole("button", { name: "Analyze your conversations", exact: true })
    .click();
  assert.match(await page.locator("#modal").innerText(), /cannot ingest/);
  await page.keyboard.press("Escape");
  await page.locator(".demo-menu summary").click();
  await page
    .getByRole("button", { name: "Reset sample workspace", exact: true })
    .click();
  await page
    .locator("#modal")
    .getByRole("button", { name: "Reset sample workspace", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  assert.equal(await page.locator(".conversation-row").count(), 7);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.locator(".conversation-row").first().click();
  assert.equal(
    await page.locator(".detail-pane").getAttribute("aria-modal"),
    "true",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".detail-pane").count(), 0);
  assert.equal(
    await page
      .locator(".conversation-row")
      .first()
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (process.env.SCREENSHOT_PATH)
    await page.screenshot({
      path: process.env.SCREENSHOT_PATH,
      fullPage: true,
    });
  await page.goto(base + "/sample.html#/old-agents");
  await page
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  assert.match(page.url(), /#\/support\/priorities$/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: core Support/Sales, assign/undo, status/history, drafts/copy/reload, Tower, metrics/patterns, reset, mobile/escape, retired routes; no browser exceptions",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
