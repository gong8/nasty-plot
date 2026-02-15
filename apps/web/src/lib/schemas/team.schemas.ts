import { z } from "zod"
import {
  pokemonIdSchema,
  formatIdSchema,
  nonEmptyString,
  statsTableSchema,
  ivsTableSchema,
  natureSchema,
  pokemonTypeSchema,
} from "./common.schemas"

export const teamCreateSchema = z.object({
  name: nonEmptyString,
  formatId: formatIdSchema,
  mode: z.enum(["freeform", "guided"]).optional(),
  source: z.enum(["manual", "imported"]).optional(),
  notes: z.string().optional(),
})

export const teamUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    formatId: z.string().min(1).optional(),
    mode: z.enum(["freeform", "guided"]).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })

export const teamSlotSchema = z.object({
  pokemonId: pokemonIdSchema,
  position: z.number().int().min(1).max(6),
  nickname: z.string().optional(),
  ability: z.string().min(1),
  item: z.string().min(1),
  nature: natureSchema,
  teraType: pokemonTypeSchema.optional(),
  level: z.number().int().min(1).max(100).default(100),
  moves: z.tuple([
    z.string().min(1),
    z.string().optional(),
    z.string().optional(),
    z.string().optional(),
  ]),
  evs: statsTableSchema,
  ivs: ivsTableSchema,
})

export const teamSlotUpdateSchema = teamSlotSchema.partial()

export const teamImportSchema = z.object({
  paste: z.string().min(1, "paste is required"),
})

export const teamListSearchSchema = z.object({
  formatId: z.string().optional(),
  includeArchived: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const teamForkSchema = z.object({
  name: z.string().optional(),
  branchName: z.string().optional(),
  notes: z.string().optional(),
})

export const teamMergeSchema = z.object({
  teamAId: nonEmptyString,
  teamBId: nonEmptyString,
  decisions: z.array(
    z.object({
      pokemonId: z.string().min(1),
      source: z.enum(["teamA", "teamB"]),
    }),
  ),
  name: z.string().optional(),
  branchName: z.string().optional(),
  notes: z.string().optional(),
})

export const teamCompareSearchSchema = z.object({
  a: z.string().min(1, "Query param 'a' is required"),
  b: z.string().min(1, "Query param 'b' is required"),
})
