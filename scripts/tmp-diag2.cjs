const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  for (const vp of [{ width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 420, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
    const reqs = [];
    page.on("request", (r) => { if (r.url().includes("/api/articles")) reqs.push(r.method() + " " + r.url().slice(30)); });

    console.log("\n===== VIEWPORT", vp.width + "x" + vp.height, "=====");
    await page.goto("http://localhost:3000/blog", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const vis = await page.evaluate(() => {
      const wrap = document.querySelector('[data-slot="select-trigger"]');
      const r = wrap ? wrap.getBoundingClientRect() : null;
      const toggler = Array.from(document.querySelectorAll("button")).find((b) => b.querySelector("svg.lucide-sliders-horizontal"));
      return {
        selectVisible: r ? r.width > 0 && r.height > 0 : false,
        selectRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } : null,
        slidersButtonVisible: toggler ? getComputedStyle(toggler).display !== "none" : null,
        pageLabel: (Array.from(document.querySelectorAll("span")).find((s) => /стр|page|页/i.test(s.textContent)) || {}).textContent,
      };
    });
    console.log("FILTERS:", JSON.stringify(vis));

    // Click "Далее"
    const before = await page.evaluate(() => document.querySelector("h3") ? Array.from(document.querySelectorAll("h3")).map(h => h.textContent.slice(0, 40)) : []);
    const btn = page.getByRole("button", { name: "Далее" });
    const exists = await btn.count();
    if (exists) {
      await btn.click();
      await page.waitForTimeout(2500);
      const after = await page.evaluate(() => Array.from(document.querySelectorAll("h3")).map(h => h.textContent.slice(0, 40)));
      const label = await page.evaluate(() => (Array.from(document.querySelectorAll("span")).find((s) => /стр|page|页/i.test(s.textContent)) || {}).textContent);
      console.log("PAGINATION clicked. url:", page.url(), "label:", label);
      console.log("  first titles before:", JSON.stringify(before.slice(0, 2)));
      console.log("  first titles after :", JSON.stringify(after.slice(0, 2)));
      console.log("  changed:", JSON.stringify(before) !== JSON.stringify(after));
    } else {
      console.log("PAGINATION: no 'Далее' button");
    }
    console.log("API REQS:", JSON.stringify(reqs));
    console.log("ERRORS:", JSON.stringify(errs));
    await ctx.close();
  }
  await browser.close();
})();
