// Full CommonJS seed script using jiti for TypeScript imports
const { createJiti } = require("jiti");
const path = require("path");

async function main() {
  console.log('Seeding database with CommonJS + jiti...');
  const jiti = await createJiti(__filename);
  
  // Import the seed.mjs through jiti which handles TS->JS transpilation
  const { default: seedModule } = await jiti.import(path.resolve(__dirname, "..", "prisma", "seed.mjs"));
  
  console.log('Seed module loaded successfully');
}

main().catch((e) => {
  console.error('Seed error:', e);
  process.exit(1);
});
