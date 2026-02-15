import { z } from "zod"

export const pokemonIdSchema = z.string().min(1, "pokemonId is required")
export const formatIdSchema = z.string().min(1, "formatId is required")
export const uuidSchema = z.string().uuid()
export const nonEmptyString = z.string().min(1)

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const statsTableSchema = z.object({
  hp: z.number().int().min(0).max(252),
  atk: z.number().int().min(0).max(252),
  def: z.number().int().min(0).max(252),
  spa: z.number().int().min(0).max(252),
  spd: z.number().int().min(0).max(252),
  spe: z.number().int().min(0).max(252),
})

export const ivsTableSchema = z.object({
  hp: z.number().int().min(0).max(31),
  atk: z.number().int().min(0).max(31),
  def: z.number().int().min(0).max(31),
  spa: z.number().int().min(0).max(31),
  spd: z.number().int().min(0).max(31),
  spe: z.number().int().min(0).max(31),
})

export const pokemonTypeSchema = z.enum([
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
])

export const natureSchema = z.enum([
  "Adamant",
  "Bashful",
  "Bold",
  "Brave",
  "Calm",
  "Careful",
  "Docile",
  "Gentle",
  "Hardy",
  "Hasty",
  "Impish",
  "Jolly",
  "Lax",
  "Lonely",
  "Mild",
  "Modest",
  "Naive",
  "Naughty",
  "Quiet",
  "Quirky",
  "Rash",
  "Relaxed",
  "Sassy",
  "Serious",
  "Timid",
])

export const gameTypeSchema = z.enum(["singles", "doubles"])

export const aiDifficultySchema = z.enum(["random", "greedy", "heuristic", "expert"])
export const battleModeSchema = z.enum(["play", "analyze", "batch", "imported"])

export const weatherSchema = z.enum([
  "None",
  "Sun",
  "Rain",
  "Sand",
  "Snow",
  "Harsh Sunshine",
  "Heavy Rain",
  "Strong Winds",
])

export const terrainSchema = z.enum(["None", "Electric", "Grassy", "Misty", "Psychic"])

export const statusSchema = z.enum([
  "None",
  "Healthy",
  "Burned",
  "Paralyzed",
  "Poisoned",
  "Badly Poisoned",
  "Asleep",
  "Frozen",
])
