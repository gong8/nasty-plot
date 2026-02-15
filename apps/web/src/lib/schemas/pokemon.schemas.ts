import { z } from "zod"

export const pokemonSearchSchema = z.object({
  search: z.string().optional().default(""),
  type: z.string().optional(),
  formatId: z.string().optional(),
  sort: z.enum(["dex", "name", "bst", "usage"]).optional().default("dex"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const pokemonLearnsetSearchSchema = z.object({
  formatId: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
})

export const pokemonSetsSearchSchema = z.object({
  formatId: z.string().min(1, "Missing required query parameter: format"),
})

export const pokemonMegaFormSearchSchema = z.object({
  item: z.string().min(1, "Missing ?item= query parameter"),
})

export const pokemonPopularitySearchSchema = z.object({
  formatId: z.string().min(1, "format query param is required"),
})
