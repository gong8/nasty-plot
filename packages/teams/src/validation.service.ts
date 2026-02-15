import { validateTeam as coreValidateTeam } from "@nasty-plot/core"
import type { TeamData, ValidationError } from "@nasty-plot/core"

export function validateTeam(team: TeamData): {
  valid: boolean
  errors: ValidationError[]
} {
  const result = coreValidateTeam(team)
  return { valid: result.errors.length === 0, errors: result.errors }
}
