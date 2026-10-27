const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 500)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 400)));
  page.on("requestfailed", (r) => failed.push(r.url().slice(0, 120) + " :: " + (r.failure() || {}).errorText));

  await page.goto("http://localhost:3000/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const initial = await page.evaluate(() => ({
    reactRoot: !!document.getElementById("__next") || !!document.querySelector("body > div"),
    scripts: document.scripts.length,
    cards: document.querySelectorAll("[role='button']").length,
    selectTriggers: document.querySelectorAll('[role="combobox"], [data-slot="select-trigger"]').length,
    paginationButtons: Array.from(document.querySelectorAll("button")).map((b) => b.textContent.trim()).filter(Boolean).slice(-6),
    paginationDisabled: Array.from(document.querySelectorAll("button")).map((b) => ({ t: b.textContent.trim(), d: b.disabled })).slice(-4),
  }));
  console.log("INITIAL:", JSON.stringify(initial, null, 1));

  // Click first card
  const card = page.locator("[role='button']").first();
  await card.click({ force: true });
  await page.waitForTimeout(2500);
  console.log("AFTER CARD CLICK url:", page.url());

  // Back to blog, try pagination "next"
  await page.goto("http://localhost:3000/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const nextBtn = page.locator("button", { hasText: /Дальше|Next|Вперёд|→/i }).last();
  const btnTexts = await page.locator("button").allTextContents();
  console.log("BUTTONS:", JSON.stringify(btnTexts));
  try {
    await nextBtn.click({ timeout: 4000 });
    await page.waitForTimeout(2500);
    console.log("AFTER NEXT url:", page.url());
    const count = await page.evaluate(() => document.querySelectorAll("[role='button']").length);
    console.log("cards after next:", count);
  } catch (e) {
    console.log("NEXT CLICK FAILED:", e.message.slice(0, 200));
  }

  console.log("JS ERRORS:", errors.length ? errors.slice(0, 5) : "none");
  console.log("FAILED REQUESTS:", failed.length ? failed.slice(0, 10) : "none");
  await browser.close();
})();
