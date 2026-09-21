const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = process.env.SITE_URL || "http://127.0.0.1:8100";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [],
    apiCalls = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apiCalls.push(r.url());
  });
  async function check(label) {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      label + " overflow",
    );
    if (process.env.AXE_MODULE) {
      await page.addScriptTag({
        path: require.resolve(process.env.AXE_MODULE),
      });
      const violations = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      );
      assert.deepEqual(violations, [], label);
    }
    console.log("PASS:", label);
  }
  await page.goto(base + "/preview.html");
  await page
    .getByRole("heading", { name: "Less noise. More momentum." })
    .waitFor();
  await check("welcome");
  await page.getByRole("button", { name: "Make it yours" }).click();
  await page
    .getByRole("heading", { name: "Start with what you know." })
    .waitFor();
  await check("tool selection");
  for (const id of ["gmail", "zendesk"])
    await page.locator(`[data-tool=${id}]`).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Continue", exact: true })
      .isEnabled(),
    false,
  );
  await page.locator("[data-tool=hubspot]").click();
  assert.equal(
    await page.locator("[data-tool=hubspot]").getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("heading", { name: "What does a good day look like?" })
    .waitFor();
  await page.locator("input[value=sales]").check();
  await check("focus selection");
  await page.getByRole("button", { name: "See my workspace" }).click();
  await page
    .getByRole("heading", { name: "Your next clear step starts here." })
    .waitFor();
  assert.match(
    await page.locator(".workspace-ticket").innerText(),
    /sales workspace/i,
  );
  await check("ready");
  await page.getByRole("link", { name: "Change my focus" }).click();
  assert.equal(await page.locator("input[value=sales]").isChecked(), true);
  await page.getByRole("link", { name: "Back", exact: true }).click();
  assert.equal(
    await page.locator("[data-tool=hubspot]").getAttribute("aria-pressed"),
    "true",
  );
  await page.reload();
  assert.equal(
    await page.locator("[data-tool=hubspot]").getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("link", { name: "Skip to setup" }).focus();
  await page.keyboard.press("Enter");
  assert.match(page.url(), /#tools$/);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "H1");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "See my workspace" }).click();
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await page
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  assert.match(page.url(), /sales\/priorities/);
  assert.equal(
    await page.locator(".lens-switch button[aria-pressed=true]").innerText(),
    "Sales",
  );
  await page.goto(base + "/preview.html?focus=support#focus");
  await page.locator("input[value=support]").waitFor();
  assert.equal(await page.locator("input[value=support]").isChecked(), true);
  await page.getByRole("button", { name: "See my workspace" }).click();
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await page
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  assert.match(page.url(), /support\/priorities/);
  await page.goto(base + "/app.html#/support/priorities");
  await page
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  assert.match(page.url(), /sample\.html#\/support\/priorities/);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const step of ["welcome", "tools", "focus", "ready"]) {
      await page.goto(base + "/preview.html#" + step);
      await page.locator("h1").waitFor();
      await check(`${width}px ${step}`);
    }
  }
  const blocked = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Unavailable");
      },
    }),
  );
  const fallback = await blocked.newPage();
  await fallback.goto(base + "/preview.html#tools");
  await fallback.getByRole("button", { name: "Continue", exact: true }).click();
  await fallback.getByRole("button", { name: "See my workspace" }).click();
  await fallback.getByRole("button", { name: "Open my workspace" }).click();
  await fallback
    .getByRole("heading", { name: "What needs attention", exact: true })
    .waitFor();
  await blocked.close();
  assert.deepEqual(
    apiCalls,
    [],
    "Preview must not invoke real account or connector services",
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: preview selection, back/reload, keyboard skip, Sales/Support handoff, mobile, blocked storage; no real service calls.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
