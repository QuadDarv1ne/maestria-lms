import type { PrismaConfig } from "prisma";

// Prisma config file — replaces deprecated package.json#prisma field.
// Seed command: npx prisma db seed (uses prisma/seed.js)
export default {
  schema: "prisma/schema.prisma",
} satisfies PrismaConfig;
