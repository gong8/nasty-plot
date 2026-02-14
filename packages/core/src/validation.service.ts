import { MAX_SINGLE_EV, MAX_TOTAL_EVS } from "./constants"
import type { TeamData, TeamSlotData } from "./types"
import { getTotalEvs } from "./stat-calc.service"

export interface ValidationError {
  field: string
  message: string
}

function checkDuplicates(
  slots: TeamSlotData[],
  getKey: (slot: TeamSlotData) => string | undefined,
  fieldName: string,
  label: string,
): ValidationError[] {
  const errors: ValidationError[] = []
  const seen = new Set<string>()
  for (const slot of slots) {
    const key = getKey(slot)
    if (!key) continue
    if (seen.has(key)) {
      errors.push({
        field: `slot.${slot.position}.${fieldName}`,
        message: `Duplicate ${label}: ${key}`,
      })
    }
    seen.add(key)
  }
  return errors
}

function validateSlot(slot: TeamSlotData): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = `slot.${slot.position}`

  if (!slot.pokemonId) {
    errors.push({ field: `${prefix}.pokemonId`, message: "Must select a Pokemon" })
  }

  const evTotal = getTotalEvs(slot.evs)
  if (evTotal > MAX_TOTAL_EVS) {
    errors.push({
      field: `${prefix}.evs`,
      message: `EV total (${evTotal}) exceeds maximum of ${MAX_TOTAL_EVS}`,
    })
  }

  for (const [stat, value] of Object.entries(slot.evs)) {
    if (value < 0 || value > MAX_SINGLE_EV) {
      errors.push({
        field: `${prefix}.evs.${stat}`,
        message: `${stat} EVs (${value}) must be between 0 and ${MAX_SINGLE_EV}`,
      })
    }
  }

  if (!slot.moves[0]) {
    errors.push({ field: `${prefix}.moves`, message: "Must have at least one move" })
  }

  const seenMoves = new Set<string>()
  for (let i = 0; i < slot.moves.length; i++) {
    const move = slot.moves[i]
    if (!move) continue
    const moveLower = move.toLowerCase()
    if (seenMoves.has(moveLower)) {
      errors.push({ field: `${prefix}.moves.${i}`, message: `Duplicate move: ${move}` })
    }
    seenMoves.add(moveLower)
  }

  return errors
}

export function validateTeam(team: TeamData): {
  valid: boolean
  errors: ValidationError[]
} {
  const errors: ValidationError[] = [
    ...checkDuplicates(team.slots, (s) => s.pokemonId, "pokemonId", "species"),
    ...checkDuplicates(team.slots, (s) => s.item?.trim() || undefined, "item", "item"),
    ...team.slots.flatMap(validateSlot),
  ]

  return { valid: errors.length === 0, errors }
}
