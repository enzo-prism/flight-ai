const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const axePath = require.resolve(
  process.env.AXE_MODULE || "axe-core/axe.min.js",
);
const base = process.env.SITE_URL || "http://127.0.0.1:8080";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  let scans = [];
  let failures = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  const scan = async (name) => {
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(() =>
      axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    scans.push({
      name,
      violations: result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      incomplete: result.incomplete.map((v) => v.id),
    });
    console.log(name, JSON.stringify(scans.at(-1)));
  };
  await page.goto(base + "/sample.html");
  await page.locator(".conversation-row").first().waitFor();
  await scan("desktop priorities");
  await page.locator(".conversation-row").first().click();
  await scan("desktop evidence");
  await page
    .getByRole("button", { name: "Draft follow-up", exact: true })
    .click();
  await scan("desktop draft");
  await page
    .getByRole("button", { name: "Preview the workflow", exact: false })
    .click();
  await scan("Tower dialog");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("heading", { name: "Where the team needs help" })
    .waitFor();
  await scan("overview");
  await page.getByRole("link", { name: "Connections", exact: true }).click();
  await page.getByRole("heading", { name: "Understand the source" }).waitFor();
  await scan("connections");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Priorities", exact: true }).click();
  await page.locator(".conversation-row").first().waitFor();
  await scan("mobile priorities");
  await page.evaluate(() => window.scrollTo(0, 500));
  const before = await page.evaluate(() => scrollY);
  await page.locator(".conversation-row").first().click();
  await scan("mobile detail");
  await page
    .getByRole("button", { name: "Start working", exact: true })
    .click();
  await page.keyboard.press("End");
  await page
    .getByRole("button", { name: "Back to conversations", exact: false })
    .click();
  assert.ok(
    Math.abs((await page.evaluate(() => scrollY)) - before) < 4,
    "restore mobile scroll",
  );
  await page.locator("#conversation-search").fill("Maya");
  await page.waitForFunction(
    () => document.querySelectorAll(".conversation-row").length === 1,
  );
  await page.locator(".conversation-row").click();
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector(".detail-pane"));
  assert.equal(await page.locator("#conversation-search").inputValue(), "Maya");
  await page.goForward();
  await page.locator(".detail-pane").waitFor();
  assert.match(
    await page.locator(".detail-heading").innerText(),
    /restore access/,
  );
  await page.goto(base + "/sample.html#/support/priorities?conversation=missing");
  await page.locator(".conversation-row").first().waitFor();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".detail-pane").count(), 0);
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 320 },
    { width: 720, height: 450 },
    { width: 901, height: 768 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(base + "/sample.html#/support/priorities");
    await page.locator(".conversation-row").first().waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      JSON.stringify(size),
    );
    await page.locator(".conversation-row").first().click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  // 720 CSS pixels models the layout space of a 1440px browser at 200% zoom.
  await page.setViewportSize({ width: 720, height: 450 });
  await scan("200 percent equivalent detail");
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  const bp = await blocked.newPage();
  await bp.goto(base + "/sample.html");
  await bp.getByText(/Browser storage is unavailable/).waitFor();
  await bp.locator(".conversation-row").first().click();
  await bp.getByRole("button", { name: "Start working", exact: true }).click();
  assert.match(await bp.locator(".detail-meta").innerText(), /In progress/);
  await bp.reload();
  await bp
    .getByRole("button", { name: "Start working", exact: true })
    .waitFor();
  const malformed = await browser.newContext();
  await malformed.addInitScript(() => {
    localStorage.setItem("mach1.preview.v2", '{"nope":true}');
    localStorage.setItem("keep-me", "still-here");
    localStorage.setItem("mach1.v1.example", "legacy");
  });
  const mp = await malformed.newPage();
  await mp.goto(base + "/sample.html");
  await mp.getByText(/Saved sample changes could not be read/).waitFor();
  await mp.locator(".demo-menu summary").click();
  await mp
    .getByRole("button", { name: "Reset sample workspace", exact: true })
    .click();
  await mp.locator('#modal [data-action="confirm-reset"]').click();
  assert.equal(
    await mp.evaluate(() => localStorage.getItem("keep-me")),
    "still-here",
  );
  assert.equal(
    await mp.evaluate(() => localStorage.getItem("mach1.v1.example")),
    "legacy",
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(
    scans.filter((s) => s.violations.length),
    [],
  );
  console.log(
    "PASS: " +
      scans.length +
      " accessibility scans; scroll/history/deep links, responsive widths, storageblocked/malformed/reset isolation; no failed assets or browser errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
