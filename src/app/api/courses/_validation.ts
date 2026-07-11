import { z } from "zod";

export const coursesListQuerySchema = z.object({
  ids: z.string().optional(),
  category: z.string().optional(),
  search: z.string().max(200).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.enum(["popular", "new", "rating", "priceAsc", "priceDesc"]).optional(),
});
