import { z } from "zod"

export const seedSchema = z.object({
  formatId: z.string().optional(),
  force: z.boolean().default(false),
})

export const recommendSchema = z.object({
  teamId: z.string().min(1, "Missing required field: teamId"),
  limit: z.number().int().min(1).max(50).optional(),
  weights: z
    .object({
      usage: z.number(),
      coverage: z.number(),
    })
    .optional(),
})

export const itemsSearchSchema = z.object({
  search: z.string().optional().default(""),
  formatId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})
