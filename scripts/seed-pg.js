// Seed entrypoint for PostgreSQL
const { createJiti } = require("jiti");

(async () => {
  const jiti = await createJiti(__filename);
  await jiti.import("../prisma/seed.mjs");
})().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
