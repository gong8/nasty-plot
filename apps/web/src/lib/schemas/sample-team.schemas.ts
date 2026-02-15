import { z } from "zod"
import { nonEmptyString, formatIdSchema } from "./common.schemas"

export const sampleTeamCreateSchema = z.object({
  name: nonEmptyString,
  formatId: formatIdSchema,
  paste: nonEmptyString,
  archetype: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
})

export const sampleTeamListSearchSchema = z.object({
  formatId: z.string().optional(),
  archetype: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const sampleTeamImportSchema = z.object({
  pastes: z.array(
    z.object({
      name: z.string().min(1),
      paste: z.string().min(1),
      archetype: z.string().optional(),
    }),
  ),
  formatId: formatIdSchema,
  source: z.string().optional(),
})
