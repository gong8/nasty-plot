import { z } from "zod"
import {
  nonEmptyString,
  gameTypeSchema,
  aiDifficultySchema,
  battleModeSchema,
  natureSchema,
  pokemonTypeSchema,
  statusSchema,
  weatherSchema,
  terrainSchema,
} from "./common.schemas"

const pokemonCalcSchema = z.object({
  pokemonId: nonEmptyString,
  level: z.number().int().min(1).max(100),
  ability: z.string().optional(),
  item: z.string().optional(),
  nature: natureSchema.optional(),
  evs: z.record(z.string(), z.number()).optional(),
  ivs: z.record(z.string(), z.number()).optional(),
  boosts: z.record(z.string(), z.number()).optional(),
  teraType: pokemonTypeSchema.optional(),
  status: statusSchema.optional(),
})

export const battleCreateSchema = z.object({
  formatId: nonEmptyString,
  gameType: gameTypeSchema.optional(),
  mode: battleModeSchema.default("play"),
  aiDifficulty: aiDifficultySchema.nullable().optional(),
  team1Paste: nonEmptyString,
  team1Name: z.string().optional(),
  team2Paste: nonEmptyString,
  team2Name: z.string().optional(),
  team1Id: z.string().nullable().optional(),
  team2Id: z.string().nullable().optional(),
  winnerId: z.string().nullable().optional(),
  turnCount: z.number().int().optional(),
  protocolLog: nonEmptyString,
  commentary: z.array(z.unknown()).nullable().optional(),
  turns: z
    .array(
      z.object({
        turnNumber: z.number().int(),
        team1Action: z.string(),
        team2Action: z.string(),
        stateSnapshot: z.string(),
        winProbTeam1: z.number().optional(),
      }),
    )
    .optional(),
  chatSessionId: z.string().nullable().optional(),
})

export const battleListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  teamId: z.string().optional(),
})

export const battleImportSchema = z
  .object({
    replayUrl: z.string().optional(),
    rawLog: z.string().optional(),
    autoMatchTeams: z.boolean().default(true),
    autoCreateTeams: z.boolean().default(true),
    inferSets: z.boolean().default(true),
  })
  .refine((data) => data.replayUrl || data.rawLog, {
    message: "Either replayUrl or rawLog is required",
  })

export const batchSimulationSchema = z.object({
  formatId: nonEmptyString,
  simFormatId: z.string().optional(),
  gameType: gameTypeSchema.optional(),
  aiDifficulty: aiDifficultySchema.optional(),
  team1Paste: nonEmptyString,
  team1Name: z.string().optional(),
  team2Paste: nonEmptyString,
  team2Name: z.string().optional(),
  totalGames: z.number().int().min(1),
})

export const battleCommentarySchema = z.object({
  mode: nonEmptyString,
  state: z.unknown().optional(),
  recentEntries: z.array(z.unknown()).optional(),
  allEntries: z.array(z.unknown()).optional(),
  turnEntries: z.array(z.unknown()).optional(),
  prevTurnEntries: z.array(z.unknown()).optional(),
  team1Name: z.string().optional(),
  team2Name: z.string().optional(),
  winner: z.string().nullable().optional(),
  totalTurns: z.number().optional(),
})

export const battleCommentaryUpdateSchema = z.object({
  turn: z.number().int(),
  text: z.string(),
})

export const battleExportSearchSchema = z.object({
  format: z.enum(["showdown", "json"]).default("showdown"),
})

export const damageCalcSchema = z.object({
  attacker: pokemonCalcSchema,
  defender: pokemonCalcSchema,
  move: nonEmptyString,
  field: z
    .object({
      weather: weatherSchema.optional(),
      terrain: terrainSchema.optional(),
      isReflect: z.boolean().optional(),
      isLightScreen: z.boolean().optional(),
      isAuroraVeil: z.boolean().optional(),
      isCritical: z.boolean().optional(),
      isDoubles: z.boolean().optional(),
    })
    .optional(),
})

export const matchupMatrixSchema = z.object({
  teamId: nonEmptyString,
  formatId: nonEmptyString,
  threatIds: z.array(z.string()).optional(),
})
