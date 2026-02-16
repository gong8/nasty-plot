// ---------------------------------------------------------------------------
// Move scoring constants
// ---------------------------------------------------------------------------

export const GUARANTEED_KO_BONUS = 80
export const PARTIAL_KO_BASE = 40
export const PARTIAL_KO_SCALING = 40
export const PRIORITY_BONUS = 20
export const LOW_HP_THRESHOLD = 30
export const STAB_BONUS = 5

/** Fallback score multiplier when damage calc throws (uses type effectiveness * multiplier) */
export const TYPE_EFFECTIVENESS_FALLBACK_MULTIPLIER = 20

/** Default score for status-infliction moves not in the STATUS_INFLICTION_SCORES map */
export const DEFAULT_STATUS_INFLICTION_SCORE = 20

/** HP threshold (%) above which setup moves are considered worthwhile */
export const SETUP_HP_THRESHOLD = 60

/** Score for a setup move when the user is at low HP (risky) */
export const SETUP_LOW_HP_SCORE = 10

/** Score for a generic status move with no specific classification */
export const GENERIC_STATUS_MOVE_SCORE = 5

/** Minimum score for hazard removal when no hazards are present (still slightly useful for utility) */
export const NO_HAZARDS_REMOVAL_SCORE = 2

// ---------------------------------------------------------------------------
// Switch scoring constants
// ---------------------------------------------------------------------------

/** Score for switching to an unknown Pokemon (baseline) */
export const SWITCH_UNKNOWN_SCORE = 5

/** Score when no opponent is active (baseline switch score) */
export const SWITCH_NO_OPPONENT_SCORE = 10

export const SWITCH_SCORES = {
  RESIST_BONUS: 15,
  IMMUNITY_BONUS: 25,
  SE_COVERAGE_BONUS: 10,
  STEALTH_ROCK_PENALTY: 10,
  SPIKES_PENALTY_PER_LAYER: 5,
  STICKY_WEB_PENALTY: 5,
} as const

// ---------------------------------------------------------------------------
// Classification thresholds
// ---------------------------------------------------------------------------

/** Thresholds for classifying move quality relative to the best option */
export const CLASSIFICATION_GAP = {
  GOOD: 5,
  NEUTRAL: 15,
  INACCURACY: 30,
  MISTAKE: 60,
} as const

/** Switch score thresholds for explanation text */
export const SWITCH_EXPLANATION = {
  GOOD: 20,
  REASONABLE: 0,
} as const

// ---------------------------------------------------------------------------
// Move ID sets
// ---------------------------------------------------------------------------

export const STATUS_MOVE_IDS = new Set([
  "toxic",
  "willowisp",
  "thunderwave",
  "spore",
  "sleeppowder",
  "yawn",
])

export const SETUP_MOVE_IDS = new Set([
  "swordsdance",
  "nastyplot",
  "calmmind",
  "dragondance",
  "irondefense",
  "amnesia",
  "shellsmash",
])

export const RECOVERY_MOVE_IDS = new Set([
  "recover",
  "roost",
  "softboiled",
  "moonlight",
  "synthesis",
  "shoreup",
  "slackoff",
])

export const HAZARD_REMOVAL_IDS = new Set(["defog", "rapidspin"])

/** Layered hazards: move ID -> side condition key and max layers */
export const LAYERED_HAZARDS: Record<
  string,
  { key: "spikes" | "toxicSpikes"; max: number; label: string }
> = {
  spikes: { key: "spikes", max: 3, label: "Spikes" },
  toxicspikes: { key: "toxicSpikes", max: 2, label: "Toxic Spikes" },
}

/** Single-layer hazards: move ID -> side condition key */
export const SINGLE_HAZARDS: Record<string, { key: "stealthRock" | "stickyWeb"; label: string }> = {
  stealthrock: { key: "stealthRock", label: "Stealth Rock" },
  stickyweb: { key: "stickyWeb", label: "Sticky Web" },
}
