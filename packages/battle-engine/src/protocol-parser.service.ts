import { getRawMove } from "@nasty-plot/pokemon-data"
import { camelCaseToDisplayName, toId, type MoveCategory, type PokemonType } from "@nasty-plot/core"
import { type BattleState, type BattleLogEntry, type BattleActionSet } from "./types"
import { PROTOCOL_HANDLERS } from "./protocol-handlers"
import {
  parseHp,
  parseStatusFromHp,
  parseDetails,
  makeEmptyPokemon,
  applyHpUpdate,
  isPokemonType,
} from "./protocol-handlers/utils"

type Side = "p1" | "p2"

/**
 * Process a single protocol line and mutate the battle state.
 * Returns a BattleLogEntry if the line produces a log message.
 */
export function processLine(state: BattleState, line: string): BattleLogEntry | null {
  const parts = line.split("|")
  if (parts.length < 2) return null
  const cmd = parts[1]
  const args = parts.slice(2)

  const handler = PROTOCOL_HANDLERS[cmd]
  if (handler) return handler(state, cmd, args)

  // No-op commands and unknown commands return null
  return null
}

/**
 * Process a multi-line protocol chunk (typically one full update).
 *
 * Handles `|split|<side>` markers from @pkmn/sim: after a split marker,
 * the next line is the owner's view (exact HP) and the line after is the
 * spectator view (percentage HP). We keep the owner's view and skip the
 * spectator duplicate.
 */
export function processChunk(state: BattleState, chunk: string): BattleLogEntry[] {
  const entries: BattleLogEntry[] = []
  const lines = chunk.split("\n").filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // |split|<side> means the next two lines are the same event from
    // different perspectives. Process the first (owner, exact HP) and
    // skip the second (spectator, percentage HP).
    if (line.startsWith("|split|")) {
      // Process the owner line (i+1), skip the spectator line (i+2)
      if (i + 1 < lines.length) {
        const entry = processLine(state, lines[i + 1])
        if (entry) {
          entries.push(entry)
          state.log.push(entry)
          state.fullLog.push(entry)
        }
      }
      i += 2 // skip past both the owner and spectator lines
      continue
    }

    const entry = processLine(state, line)
    if (entry) {
      entries.push(entry)
      state.log.push(entry)
      state.fullLog.push(entry)
    }
  }

  return entries
}

/**
 * Parse a |request| JSON to extract available actions.
 */
export function parseRequest(requestJson: string): {
  actions: BattleActionSet | null
  teamPreview: boolean
  wait: boolean
  forceSwitch: boolean
  side?: { name: string; id: string; pokemon: RequestPokemon[] }
} {
  const req = JSON.parse(requestJson)

  if (req.wait) {
    return { actions: null, teamPreview: false, wait: true, forceSwitch: false }
  }

  if (req.teamPreview) {
    return { actions: null, teamPreview: true, wait: false, forceSwitch: false, side: req.side }
  }

  if (req.forceSwitch) {
    // In doubles, forceSwitch is an array like [true, false].
    // Only return forceSwitch actions for slot 0 if slot 0 needs to switch.
    const forceArr: boolean[] = Array.isArray(req.forceSwitch) ? req.forceSwitch : [req.forceSwitch]

    if (forceArr[0]) {
      const switches = extractSwitches(req.side?.pokemon || [])
      return {
        actions: {
          moves: [],
          canTera: false,
          switches,
          forceSwitch: true,
          activeSlot: 0,
        },
        teamPreview: false,
        wait: false,
        forceSwitch: true,
        side: req.side,
      }
    }
    // Slot 0 doesn't need to switch -- fall through to normal move extraction
  }

  // Normal turn: extract moves and switches
  const active = req.active?.[0]
  const moves = extractMoves(active)

  const canTera = active?.canTerastallize != null
  const switches = extractSwitches(req.side?.pokemon || [])

  return {
    actions: {
      moves,
      canTera,
      switches,
      forceSwitch: false,
      activeSlot: 0,
    },
    teamPreview: false,
    wait: false,
    forceSwitch: false,
    side: req.side,
  }
}

/**
 * Parse a |request| JSON to extract available actions for a specific active slot.
 * Used for doubles where each active slot gets its own action set.
 */
export function parseRequestForSlot(
  requestJson: string,
  slotIndex: number,
): {
  actions: BattleActionSet | null
  teamPreview: boolean
  wait: boolean
  forceSwitch: boolean
  side?: { name: string; id: string; pokemon: RequestPokemon[] }
} {
  const req = JSON.parse(requestJson)

  if (req.wait) {
    return { actions: null, teamPreview: false, wait: true, forceSwitch: false }
  }

  if (req.teamPreview) {
    return { actions: null, teamPreview: true, wait: false, forceSwitch: false, side: req.side }
  }

  // Handle forceSwitch array in doubles
  if (req.forceSwitch) {
    const forceArr: boolean[] = Array.isArray(req.forceSwitch) ? req.forceSwitch : [req.forceSwitch]
    if (!forceArr[slotIndex]) {
      // This slot doesn't need to switch
      return { actions: null, teamPreview: false, wait: false, forceSwitch: false }
    }
    const switches = extractSwitches(req.side?.pokemon || [])
    return {
      actions: {
        moves: [],
        canTera: false,
        switches,
        forceSwitch: true,
        activeSlot: slotIndex,
      },
      teamPreview: false,
      wait: false,
      forceSwitch: true,
      side: req.side,
    }
  }

  const active = req.active?.[slotIndex]
  if (!active) {
    return { actions: null, teamPreview: false, wait: false, forceSwitch: false }
  }

  const moves = extractMoves(active)
  const canTera = active?.canTerastallize != null
  const switches = extractSwitches(req.side?.pokemon || [])

  return {
    actions: {
      moves,
      canTera,
      switches,
      forceSwitch: false,
      activeSlot: slotIndex,
    },
    teamPreview: false,
    wait: false,
    forceSwitch: false,
    side: req.side,
  }
}

function extractMoves(active: RequestActive | undefined): BattleActionSet["moves"] {
  return (active?.moves || []).map((m: RequestMove) => {
    const moveData = getRawMove(m.id)
    return {
      name: m.move,
      id: m.id,
      pp: m.pp,
      maxPp: m.maxpp,
      type: (moveData?.type || m.type || "Normal") as PokemonType,
      disabled: m.disabled || false,
      target: m.target || "normal",
      basePower: moveData?.basePower ?? 0,
      category: (moveData?.category ?? "Status") as MoveCategory,
      accuracy: moveData?.accuracy === true ? true : (moveData?.accuracy ?? 100),
      description: moveData?.shortDesc || moveData?.desc || "",
    }
  })
}

function extractSwitches(pokemon: RequestPokemon[]): BattleActionSet["switches"] {
  return pokemon
    .map((p, i) => {
      const hpData = parseHp(p.condition || "0/0")
      const status = parseStatusFromHp(p.condition || "")
      const details = parseDetails(p.details)
      return {
        index: i + 1, // 1-indexed
        name: details.species,
        pokemonId: toId(details.species),
        hp: hpData.hp,
        maxHp: hpData.maxHp,
        status,
        fainted: hpData.hp === 0 || p.condition === "0 fnt",
        active: p.active ?? false,
      }
    })
    .filter((p) => !p.fainted && !p.active)
}

/** Update side pokemon data from request side info */
export function updateSideFromRequest(
  state: BattleState,
  side: Side,
  reqSide: { name: string; id: string; pokemon: RequestPokemon[] },
) {
  state.sides[side].name = reqSide.name

  for (let i = 0; i < reqSide.pokemon.length; i++) {
    const reqPoke = reqSide.pokemon[i]
    const details = parseDetails(reqPoke.details)
    const hpData = parseHp(reqPoke.condition || "100/100")
    const status = parseStatusFromHp(reqPoke.condition || "")

    // Find existing or create
    let pokemon = state.sides[side].team.find(
      (p) => p.name === details.species || p.pokemonId === toId(details.species),
    )

    if (!pokemon) {
      pokemon = makeEmptyPokemon()
      pokemon.name = details.species
      pokemon.pokemonId = toId(details.species)
      pokemon.nickname = reqPoke.ident?.replace(/^p[12][a-d]?: /, "") || details.species
      pokemon.level = details.level
      state.sides[side].team.push(pokemon)
    }

    // Request data is authoritative, but "0 fnt" returns maxHp=0 -- preserve
    // existing maxHp so fainted Pokemon show 0/maxHp instead of 0/0.
    const effectiveMaxHp = hpData.maxHp > 0 ? hpData.maxHp : pokemon.maxHp
    applyHpUpdate(pokemon, { hp: hpData.hp, maxHp: effectiveMaxHp }, status)
    pokemon.item = reqPoke.item || ""
    pokemon.ability = reqPoke.baseAbility || reqPoke.ability || ""
    pokemon.teraType =
      reqPoke.teraType && isPokemonType(reqPoke.teraType) ? reqPoke.teraType : undefined

    // Parse stats
    if (reqPoke.stats) {
      pokemon.stats = {
        hp: hpData.maxHp || pokemon.maxHp,
        atk: reqPoke.stats.atk || 0,
        def: reqPoke.stats.def || 0,
        spa: reqPoke.stats.spa || 0,
        spd: reqPoke.stats.spd || 0,
        spe: reqPoke.stats.spe || 0,
      }
    }

    // Parse moves
    if (reqPoke.moves) {
      pokemon.moves = reqPoke.moves.map((m: string) => {
        const moveData = getRawMove(m)
        return {
          id: m,
          name: moveData?.name || camelCaseToDisplayName(m),
          pp: 0,
          maxPp: 0,
          type: (moveData?.type || "Normal") as PokemonType,
          disabled: false,
          target: moveData?.target || "normal",
        }
      })
    }

    // Mark active
    if (reqPoke.active) {
      const activeIdx = state.sides[side].active.findIndex((a) => a === pokemon)
      if (activeIdx === -1) {
        // Find first empty slot or first slot
        const emptyIdx = state.sides[side].active.findIndex((a) => a === null)
        if (emptyIdx !== -1) {
          state.sides[side].active[emptyIdx] = pokemon
        } else if (state.sides[side].active.length === 0) {
          state.sides[side].active.push(pokemon)
        }
      }
    }
  }
}

/** Request JSON types from @pkmn/sim */

interface RequestActive {
  moves?: RequestMove[]
  canTerastallize?: string
}

interface RequestMove {
  move: string
  id: string
  pp: number
  maxpp: number
  type?: string
  disabled?: boolean
  target?: string
}

interface RequestPokemon {
  ident?: string
  details: string
  condition: string
  active?: boolean
  stats?: { atk: number; def: number; spa: number; spd: number; spe: number }
  moves: string[]
  baseAbility?: string
  ability?: string
  item?: string
  pokeball?: string
  teraType?: string
}
