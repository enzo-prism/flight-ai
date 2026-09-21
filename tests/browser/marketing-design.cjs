const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = process.env.SITE_URL || "http://127.0.0.1:8100";
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const p = await b.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  async function scan(label, selector) {
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      label + " overflow",
    );
    if (process.env.AXE_MODULE) {
      await p.addScriptTag({ path: require.resolve(process.env.AXE_MODULE) });
      const v = await p.evaluate(
        async (s) =>
          (
            await axe.run(s ? document.querySelector(s) : document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            })
          ).violations.map((x) => ({
            id: x.id,
            targets: x.nodes.map((n) => n.target),
          })),
        selector,
      );
      assert.deepEqual(v, [], label);
    }
    console.log("PASS:", label);
  }
  await p.goto(base + "/index.html#customers");
  await p.locator("#story-praktika").waitFor();
  assert.equal(await p.locator("#customers video").count(), 5);
  assert.equal(
    await p.locator("#customers video track[kind=captions]").count(),
    5,
  );
  assert.equal(
    await p.locator(".site-demo").getAttribute("href"),
    "preview.html",
  );
  await scan("customer stories desktop", "#customers");
  const clips = p
    .locator("#customers details")
    .filter({ has: p.getByText("More from Daniel at Praktika") });
  await clips.locator(":scope > summary").click();
  assert.equal(await clips.getAttribute("open"), "");
  await scan("expanded supplemental stories", "#customers");
  await clips.locator(":scope > summary").click();
  await p.setViewportSize({ width: 390, height: 844 });
  await scan("customer stories mobile", "#customers");
  for (const width of [1440, 390]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.goto(base + "/updates.html");
    await p.locator("#releaseList").waitFor();
    await scan("release archive " + width);
    await p.locator("#releaseSearch").fill("cost");
    await p.waitForFunction(() =>
      document.querySelector(".result-count").textContent.includes("1"),
    );
    const visible = p.locator(".release-row:visible");
    assert.equal(await visible.count(), 1);
    await visible.getByRole("link", { name: "Explore the update" }).click();
    await p.locator(".release-visual").first().waitFor();
    await scan("cost release " + width);
    assert.match(await p.locator("h1").innerText(), /usage costs/);
  }
  assert.deepEqual(errors, []);
  await b.close();
  console.log(
    "PASS: story grouping, captions, disclosures, preview CTA, release filtering and article navigation.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
