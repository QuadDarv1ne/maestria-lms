// Seed script using CommonJS to avoid ES module issues with Prisma 7 adapters
const { createJiti } = require("jiti");
const path = require("path");

// Force process availability BEFORE importing seed.mjs
if (typeof globalThis.process === 'undefined') {
  globalThis.process = require('process');
}

async function runSeed() {
  const jiti = await createJiti(__filename);
  await jiti.import(path.resolve(__dirname, "..", "prisma", "seed.mjs"));
}

runSeed().catch((error) => {
  console.error("[seed] Failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});
