import { z } from "zod"

export const formatPokemonSearchSchema = z.object({
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const formatUsageSearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
})

export const formatCoresSearchSchema = z.object({
  pokemonId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
