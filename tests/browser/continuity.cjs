const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = [];
  async function fresh(hash = "") {
    await page.goto(
      (process.env.SITE_URL || "http://127.0.0.1:8080") + "/sample.html" + hash,
    );
    await page.waitForSelector(".conversation-row");
    await page.evaluate(() => localStorage.removeItem("mach1.preview.v2"));
    await page.reload();
    await page.waitForSelector(".conversation-row");
  }
  async function focus() {
    return page.evaluate(() => ({
      tag: document.activeElement.tagName,
      id: document.activeElement.id,
      action: document.activeElement.dataset.action,
      text: document.activeElement.textContent.slice(0, 80),
    }));
  }
  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({ name, passed: false, error: e.message });
    }
  }
  await check("start and close draft retain action focus", async () => {
    await fresh();
    await page.locator('[data-conversation="support-maya"]').click();
    await page.locator('[data-action="start"]').click();
    assert.equal((await focus()).action, "draft");
    await page.locator('[data-action="draft"]').click();
    await page
      .locator("#follow-up-draft")
      .fill("Modified [verified recovery instruction].");
    await page.locator('[data-action="draft"]').click();
    assert.equal((await focus()).action, "draft");
    await page.locator('[data-action="draft"]').click();
    assert.equal(
      await page.locator("#follow-up-draft").inputValue(),
      "Modified [verified recovery instruction].",
    );
    assert.equal(
      await page.locator("#follow-up-draft").getAttribute("maxlength"),
      "20000",
    );
  });
  await check(
    "dismissal displays new reason after handled and reopened",
    async () => {
      await fresh();
      await page.locator('[data-conversation="support-maya"]').click();
      await page.locator('[data-action="handle"]').click();
      await page.locator("#outcome-text").fill("Old handled outcome unique");
      await page
        .getByRole("button", { name: "Save outcome", exact: true })
        .click();
      await page.locator('[data-action="reopen"]').click();
      await page.locator('[data-action="dismiss"]').click();
      await page.locator("#outcome-text").fill("New dismissal reason unique");
      await page
        .getByRole("button", { name: "Dismiss finding", exact: true })
        .click();
      const reason = page
        .locator(".detail-pane p")
        .filter({ has: page.locator("strong") })
        .filter({ hasText: "Recorded reason:" });
      assert.match(await reason.innerText(), /New dismissal reason unique/);
      assert.doesNotMatch(await reason.innerText(), /Old handled/);
    },
  );
  await check("filtered assignment Back uses search fallback", async () => {
    await fresh();
    await page.locator("#filter-owner").selectOption("unassigned");
    await page.locator('[data-conversation="support-maya"]').click();
    await page.locator("#finding-owner").selectOption({ index: 1 });
    await page.locator('[data-action="back"]').click();
    assert.equal((await focus()).id, "conversation-search");
    assert.equal(
      await page.locator("#filter-owner").inputValue(),
      "unassigned",
    );
  });
  await check(
    "More filters remains open with keyboard select focus",
    async () => {
      await fresh();
      await page.locator(".filter-popover summary").click();
      await page.locator("#filter-priority").focus();
      await page.locator("#filter-priority").selectOption("high");
      assert.equal(
        await page.locator(".filter-popover").evaluate((el) => el.open),
        true,
      );
      assert.equal((await focus()).id, "filter-priority");
    },
  );
  await check("pending search is canceled on lens switch", async () => {
    await fresh();
    await page.locator("#conversation-search").fill("Northline");
    await page.locator('[data-lens="sales"]').click();
    await page.waitForTimeout(260);
    assert.equal(await page.locator("#conversation-search").inputValue(), "");
    assert.match(page.url(), /#\/sales\/priorities$/);
  });
  await check("detail to Overview focuses heading", async () => {
    await fresh();
    await page.locator('[data-conversation="support-maya"]').click();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.waitForSelector(".metrics-grid");
    assert.equal((await focus()).tag, "H1");
  });
  await check(
    "invalid mobile selection normalizes without keyboard errors",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await fresh("#/support/priorities?conversation=unknown&finding=bad");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(".detail-pane").count(), 0);
      assert.doesNotMatch(page.url(), /conversation=/);
      await fresh("#/support/priorities?conversation=sales-jordan");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(".detail-pane").count(), 0);
    },
  );
  await check(
    "mobile detail initial focus and Escape returns row",
    async () => {
      await fresh();
      await page.locator('[data-conversation="support-maya"]').click();
      assert.equal((await focus()).id, "detail-title");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".detail-pane").count(), 0);
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.conversation),
        "support-maya",
      );
    },
  );
  console.log(JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  if (results.some((x) => !x.passed) || errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
