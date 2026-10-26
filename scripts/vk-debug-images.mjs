import { chromium } from "playwright";

const url = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("response", (response) => {
  if (response.url().includes("vkuserphoto")) {
    console.log(`[${response.status()}] ${response.url().slice(-100)}`);
  }
});

page.on("requestfailed", (request) => {
  if (request.url().includes("vkuserphoto")) {
    console.log(`[FAILED] ${request.url().slice(-100)} - ${request.failure()?.errorText}`);
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

const srcs = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".article-content img")).map((img) => ({
    src: img.src,
    naturalWidth: img.naturalWidth,
    complete: img.complete,
  }))
);

console.log("\n=== Image srcs ===");
srcs.forEach((s, i) => {
  console.log(`\n--- Image ${i + 1} (${s.naturalWidth}px) ---`);
  console.log(s.src);
});

await browser.close();
