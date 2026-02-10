import { Dex } from "@pkmn/dex";
import type { PokemonType } from "@nasty-plot/core";
import type {
  BattleState,
  BattlePokemon,
  BattleLogEntry,
  BattleLogType,
  BattleActionSet,
  StatusCondition,
  Weather,
  Terrain,
  BoostTable,
} from "./types";

const dex = Dex.forGen(9);

/**
 * Protocol Parser
 *
 * Parses @pkmn/sim protocol messages into BattleState mutations.
 * Protocol reference: https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md
 */

type Side = "p1" | "p2";

/** Parse "p1a: Garchomp" → { side: "p1", slot: "a", name: "Garchomp" } */
function parsePokemonIdent(ident: string): { side: Side; slot: string; name: string } | null {
  const match = ident.match(/^(p[12])([a-d]?):\s*(.+)$/);
  if (!match) return null;
  return {
    side: match[1] as Side,
    slot: match[2] || "a",
    name: match[3].trim(),
  };
}

/** Parse "100/319" → { hp: 100, maxHp: 319 } or percentage like "78/100" */
function parseHp(hpStr: string): { hp: number; maxHp: number } {
  if (hpStr === "0 fnt") return { hp: 0, maxHp: 0 };
  const parts = hpStr.split(" ")[0]; // Strip conditions like "100/319 par"
  const [hp, maxHp] = parts.split("/").map(Number);
  return { hp: hp || 0, maxHp: maxHp || 0 };
}

/** Parse status from HP string like "100/319 par" */
function parseStatusFromHp(hpStr: string): StatusCondition {
  const parts = hpStr.split(" ");
  if (parts.length > 1) {
    const status = parts[1] as StatusCondition;
    if (["brn", "par", "slp", "frz", "psn", "tox"].includes(status)) {
      return status;
    }
  }
  return "";
}

/** Parse "Garchomp, L100, M" → species details */
function parseDetails(details: string): { species: string; level: number; gender: string } {
  const parts = details.split(",").map((s) => s.trim());
  const species = parts[0];
  let level = 100;
  let gender = "";

  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith("L")) {
      level = parseInt(parts[i].slice(1), 10);
    } else if (parts[i] === "M" || parts[i] === "F") {
      gender = parts[i];
    }
  }

  return { species, level, gender };
}

/** Convert a species display name like "Great Tusk" to an ID like "greattusk". */
function toSpeciesId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Slot letter to 0-based index */
function slotIndex(slot: string): number {
  return slot.charCodeAt(0) - "a".charCodeAt(0);
}

function defaultBoosts(): BoostTable {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
}

function makeEmptyPokemon(): BattlePokemon {
  return {
    speciesId: "",
    name: "",
    nickname: "",
    level: 100,
    types: [],
    hp: 0,
    maxHp: 0,
    hpPercent: 0,
    status: "",
    fainted: false,
    item: "",
    ability: "",
    isTerastallized: false,
    moves: [],
    stats: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    boosts: defaultBoosts(),
    volatiles: [],
  };
}

/**
 * Find a Pokemon on a side by nickname (search active first, then team).
 */
function findPokemon(state: BattleState, side: Side, name: string): BattlePokemon | null {
  const s = state.sides[side];
  // Check active
  for (const p of s.active) {
    if (p && (p.nickname === name || p.name === name)) return p;
  }
  // Check team
  for (const p of s.team) {
    if (p.nickname === name || p.name === name) return p;
  }
  return null;
}

/**
 * Process a single protocol line and mutate the battle state.
 * Returns a BattleLogEntry if the line produces a log message.
 */
export function processLine(
  state: BattleState,
  line: string
): BattleLogEntry | null {
  const parts = line.split("|");
  // Protocol lines start with |, so parts[0] is empty
  if (parts.length < 2) return null;
  const cmd = parts[1];
  const args = parts.slice(2);

  switch (cmd) {
    case "turn": {
      const turnNum = parseInt(args[0], 10);
      state.turn = turnNum;
      state.log = [];
      return logEntry("turn", `=== Turn ${turnNum} ===`, turnNum);
    }

    case "switch":
    case "drag":
    case "replace": {
      // |switch|p1a: Garchomp|Garchomp, L100, M|319/319
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const details = parseDetails(args[1]);
      const hpData = args[2] ? parseHp(args[2]) : { hp: 100, maxHp: 100 };
      const status = args[2] ? parseStatusFromHp(args[2]) : "";

      const side = state.sides[ident.side];
      const idx = slotIndex(ident.slot);

      // Find or create the pokemon in team
      let pokemon = side.team.find(
        (p) => p.name === details.species || p.nickname === ident.name
      );

      if (!pokemon) {
        // New pokemon we haven't seen
        pokemon = makeEmptyPokemon();
        pokemon.name = details.species;
        pokemon.speciesId = toSpeciesId(details.species);
        pokemon.nickname = ident.name;
        pokemon.level = details.level;
        side.team.push(pokemon);
      }

      pokemon.hp = hpData.hp;
      // Only increase maxHp — the sim outputs percentage HP (X/100) for the
      // opponent's perspective, so a second chunk can corrupt absolute values.
      // The authoritative source is updateSideFromRequest (|request| data).
      if (hpData.maxHp > pokemon.maxHp) pokemon.maxHp = hpData.maxHp;
      pokemon.hpPercent = pokemon.maxHp > 0 ? Math.round((pokemon.hp / pokemon.maxHp) * 100) : 0;
      pokemon.status = status;
      pokemon.fainted = hpData.hp === 0;
      pokemon.boosts = defaultBoosts();
      pokemon.volatiles = [];

      // Set as active
      side.active[idx] = pokemon;

      const verb = cmd === "switch" ? "sent out" : cmd === "drag" ? "was dragged out" : "appeared";
      return logEntry("switch",
        `${side.name} ${verb} ${ident.name}!`,
        state.turn, ident.side);
    }

    case "move": {
      // |move|p1a: Garchomp|Earthquake|p2a: Heatran
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const moveName = args[1];

      return logEntry("move",
        `${ident.name} used ${moveName}!`,
        state.turn, ident.side);
    }

    case "-damage":
    case "-heal": {
      // |-damage|p1a: Garchomp|219/319
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const hpData = parseHp(args[1]);
      const status = parseStatusFromHp(args[1]);
      const pokemon = findPokemon(state, ident.side, ident.name);

      const prevPercent = pokemon?.hpPercent ?? 100;

      if (pokemon) {
        pokemon.hp = hpData.hp;
        // Only increase maxHp — percentage-format HP from the opponent's
        // perspective (X/100) must not overwrite the real absolute value.
        if (hpData.maxHp > pokemon.maxHp) pokemon.maxHp = hpData.maxHp;
        pokemon.hpPercent = pokemon.maxHp > 0 ? Math.round((pokemon.hp / pokemon.maxHp) * 100) : 0;
        if (status) pokemon.status = status;
        pokemon.fainted = pokemon.hp === 0;
      }

      const isHeal = cmd === "-heal";
      const newPercent = pokemon?.hpPercent ?? 0;
      const delta = Math.abs(newPercent - prevPercent);
      const source = args[2] ? ` (${args[2].replace("[from] ", "")})` : "";
      const hpDetail = delta > 0 ? ` (${newPercent}%, ${isHeal ? "+" : "-"}${delta}%)` : ` (${newPercent}%)`;
      return logEntry(
        isHeal ? "heal" : "damage",
        `${ident.name} ${isHeal ? "restored" : "lost"} HP!${hpDetail}${source}`,
        state.turn, ident.side
      );
    }

    case "faint": {
      // |faint|p1a: Garchomp
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) {
        pokemon.hp = 0;
        pokemon.hpPercent = 0;
        pokemon.fainted = true;
      }
      return logEntry("faint", `${ident.name} fainted!`, state.turn, ident.side);
    }

    case "-status": {
      // |-status|p1a: Garchomp|brn
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const statusId = args[1] as StatusCondition;
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) pokemon.status = statusId;

      const statusNames: Record<string, string> = {
        brn: "burned", par: "paralyzed", slp: "fell asleep",
        frz: "was frozen", psn: "was poisoned", tox: "was badly poisoned",
      };
      return logEntry("status",
        `${ident.name} ${statusNames[statusId] || `got ${statusId}`}!`,
        state.turn, ident.side);
    }

    case "-curestatus": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) pokemon.status = "";
      return logEntry("status", `${ident.name} was cured!`, state.turn, ident.side);
    }

    case "-boost": {
      // |-boost|p1a: Garchomp|atk|2
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const stat = args[1] as keyof BoostTable;
      const amount = parseInt(args[2], 10);
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon && stat in pokemon.boosts) {
        pokemon.boosts[stat] = Math.min(6, pokemon.boosts[stat] + amount);
      }

      const stages = amount === 1 ? "" : amount === 2 ? " sharply" : " drastically";
      return logEntry("boost",
        `${ident.name}'s ${stat} rose${stages}!`,
        state.turn, ident.side);
    }

    case "-unboost": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const stat = args[1] as keyof BoostTable;
      const amount = parseInt(args[2], 10);
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon && stat in pokemon.boosts) {
        pokemon.boosts[stat] = Math.max(-6, pokemon.boosts[stat] - amount);
      }

      const stages = amount === 1 ? "" : amount === 2 ? " sharply" : " drastically";
      return logEntry("unboost",
        `${ident.name}'s ${stat} fell${stages}!`,
        state.turn, ident.side);
    }

    case "-weather": {
      // |-weather|Sandstorm|[from] ability: Sand Stream|[of] p1a: Tyranitar
      const weather = args[0];
      if (weather === "none") {
        state.field.weather = "";
        state.field.weatherTurns = 0;
        return logEntry("weather", "The weather cleared!", state.turn);
      }
      const weatherMap: Record<string, Weather> = {
        Sandstorm: "Sand",
        SunnyDay: "Sun",
        RainDance: "Rain",
        Snow: "Snow",
        Hail: "Snow",
        DesolateLand: "Desolate Land",
        PrimordialSea: "Primordial Sea",
        DeltaStream: "Delta Stream",
      };
      state.field.weather = weatherMap[weather] || (weather as Weather);
      if (args[1] !== "[upkeep]") {
        state.field.weatherTurns = 5; // Default, abilities may modify
      } else {
        state.field.weatherTurns = Math.max(0, state.field.weatherTurns - 1);
      }
      return logEntry("weather", `The weather is ${weather}!`, state.turn);
    }

    case "-fieldstart": {
      // |-fieldstart|move: Electric Terrain
      const fieldName = args[0]?.replace("move: ", "");
      const terrainMap: Record<string, Terrain> = {
        "Electric Terrain": "Electric",
        "Grassy Terrain": "Grassy",
        "Misty Terrain": "Misty",
        "Psychic Terrain": "Psychic",
      };
      if (fieldName in terrainMap) {
        state.field.terrain = terrainMap[fieldName];
        state.field.terrainTurns = 5;
      }
      if (fieldName === "Trick Room") {
        state.field.trickRoom = 5;
      }
      return logEntry("terrain", `${fieldName} started!`, state.turn);
    }

    case "-fieldend": {
      const fieldName = args[0]?.replace("move: ", "");
      if (fieldName?.endsWith("Terrain")) {
        state.field.terrain = "";
        state.field.terrainTurns = 0;
      }
      if (fieldName === "Trick Room") {
        state.field.trickRoom = 0;
      }
      return logEntry("terrain", `${fieldName} ended!`, state.turn);
    }

    case "-sidestart": {
      // |-sidestart|p1: Player|move: Stealth Rock
      const sideMatch = args[0]?.match(/^(p[12])/);
      if (!sideMatch) return null;
      const side = sideMatch[1] as Side;
      const hazard = args[1]?.replace("move: ", "");
      const sc = state.sides[side].sideConditions;

      switch (hazard) {
        case "Stealth Rock": sc.stealthRock = true; break;
        case "Spikes": sc.spikes = Math.min(3, sc.spikes + 1); break;
        case "Toxic Spikes": sc.toxicSpikes = Math.min(2, sc.toxicSpikes + 1); break;
        case "Sticky Web": sc.stickyWeb = true; break;
        case "Reflect": sc.reflect = 5; break;
        case "Light Screen": sc.lightScreen = 5; break;
        case "Aurora Veil": sc.auroraVeil = 5; break;
        case "Tailwind": sc.tailwind = 4; break;
      }

      return logEntry("hazard", `${hazard} was set on ${side}'s side!`, state.turn, side);
    }

    case "-sideend": {
      const sideMatch = args[0]?.match(/^(p[12])/);
      if (!sideMatch) return null;
      const side = sideMatch[1] as Side;
      const hazard = args[1]?.replace("move: ", "");
      const sc = state.sides[side].sideConditions;

      switch (hazard) {
        case "Stealth Rock": sc.stealthRock = false; break;
        case "Spikes": sc.spikes = 0; break;
        case "Toxic Spikes": sc.toxicSpikes = 0; break;
        case "Sticky Web": sc.stickyWeb = false; break;
        case "Reflect": sc.reflect = 0; break;
        case "Light Screen": sc.lightScreen = 0; break;
        case "Aurora Veil": sc.auroraVeil = 0; break;
        case "Tailwind": sc.tailwind = 0; break;
      }

      return logEntry("hazard", `${hazard} ended on ${side}'s side!`, state.turn, side);
    }

    case "-item": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const itemName = args[1];
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) pokemon.item = itemName;
      return logEntry("item", `${ident.name}'s ${itemName} was revealed!`, state.turn, ident.side);
    }

    case "-enditem": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const itemName = args[1];
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) pokemon.item = "";
      return logEntry("item", `${ident.name}'s ${itemName} was consumed!`, state.turn, ident.side);
    }

    case "-ability": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const abilityName = args[1];
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) pokemon.ability = abilityName;
      return logEntry("ability", `${ident.name}'s ${abilityName} activated!`, state.turn, ident.side);
    }

    case "-start": {
      // Volatile status: |-start|p1a: Garchomp|Substitute
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const condition = args[1]?.replace("move: ", "");
      const pokemon = findPokemon(state, ident.side, ident.name);

      if (condition === "typechange" && args[2]) {
        // Terastallization or Protean/Libero type change
        if (pokemon) {
          const newTypes = args[2].split("/").map((t) => t.trim()) as PokemonType[];
          pokemon.types = newTypes;
        }
      }

      if (pokemon && condition) {
        if (!pokemon.volatiles.includes(condition)) {
          pokemon.volatiles.push(condition);
        }
      }

      return logEntry("start", `${ident.name}: ${condition} started!`, state.turn, ident.side);
    }

    case "-end": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const condition = args[1]?.replace("move: ", "");
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon && condition) {
        pokemon.volatiles = pokemon.volatiles.filter((v) => v !== condition);
      }
      return logEntry("end", `${ident.name}: ${condition} ended!`, state.turn, ident.side);
    }

    case "-terastallize": {
      // |-terastallize|p1a: Garchomp|Ground
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const teraType = args[1] as PokemonType;
      const pokemon = findPokemon(state, ident.side, ident.name);
      if (pokemon) {
        pokemon.teraType = teraType;
        pokemon.isTerastallized = true;
      }
      state.sides[ident.side].canTera = false;
      state.sides[ident.side].hasTerastallized = true;
      return logEntry("tera",
        `${ident.name} terastallized into ${teraType} type!`,
        state.turn, ident.side);
    }

    case "-crit": {
      const ident = parsePokemonIdent(args[0]);
      return logEntry("crit", `A critical hit!`, state.turn, ident?.side);
    }

    case "-supereffective": {
      const ident = parsePokemonIdent(args[0]);
      return logEntry("supereffective", `It's super effective!`, state.turn, ident?.side);
    }

    case "-resisted": {
      const ident = parsePokemonIdent(args[0]);
      return logEntry("resisted", `It's not very effective...`, state.turn, ident?.side);
    }

    case "-immune": {
      const ident = parsePokemonIdent(args[0]);
      return logEntry("immune", `It had no effect!`, state.turn, ident?.side);
    }

    case "cant": {
      const ident = parsePokemonIdent(args[0]);
      if (!ident) return null;
      const reason = args[1] || "unknown";
      return logEntry("cant", `${ident.name} can't move! (${reason})`, state.turn, ident.side);
    }

    case "win": {
      const winnerName = args[0];
      state.winner = state.sides.p1.name === winnerName ? "p1" : "p2";
      state.phase = "ended";
      return logEntry("win", `${winnerName} won the battle!`, state.turn);
    }

    case "tie": {
      state.phase = "ended";
      return logEntry("win", "The battle ended in a tie!", state.turn);
    }

    case "player": {
      // |player|p1|PlayerName|avatar|rating
      const playerId = args[0] as Side;
      const playerName = args[1];
      if (playerId === "p1" || playerId === "p2") {
        state.sides[playerId].name = playerName || playerId;
      }
      return null;
    }

    case "teamsize": {
      // We'll learn about team via switches
      return null;
    }

    case "gametype": {
      if (args[0] === "doubles") {
        state.format = "doubles";
      }
      return null;
    }

    case "gen": {
      return null;
    }

    case "tier":
    case "rule":
    case "rated":
    case "clearpoke":
    case "teampreview":
    case "start":
    case "upkeep":
    case "":
    case "t:":
      return null;

    case "-fail": {
      const ident = parsePokemonIdent(args[0] || "");
      if (ident) {
        return logEntry("info", `${ident.name}'s move failed!`, state.turn, ident.side);
      }
      return null;
    }

    case "-miss": {
      const ident = parsePokemonIdent(args[0] || "");
      if (ident) {
        return logEntry("info", `${ident.name}'s attack missed!`, state.turn, ident.side);
      }
      return null;
    }

    case "-activate": {
      const ident = parsePokemonIdent(args[0] || "");
      if (!ident) return null;
      const effect = args[1] || "";

      // Air Balloon pop
      if (effect === "item: Air Balloon") {
        const pokemon = findPokemon(state, ident.side, ident.name);
        if (pokemon) pokemon.item = "";
        return logEntry("item", `${ident.name}'s Air Balloon popped!`, state.turn, ident.side);
      }

      // Disguise
      if (effect === "ability: Disguise" || effect === "Disguise") {
        return logEntry("ability", `${ident.name}'s Disguise was busted!`, state.turn, ident.side);
      }

      // Generic activate
      const cleanEffect = effect.replace(/^(ability|item|move): /, "");
      return logEntry("info", `${ident.name}'s ${cleanEffect} activated!`, state.turn, ident.side);
    }

    case "-prepare": {
      const ident = parsePokemonIdent(args[0] || "");
      if (!ident) return null;
      const moveName = args[1] || "a move";
      return logEntry("move", `${ident.name} is preparing ${moveName}!`, state.turn, ident.side);
    }

    case "-hint":
    case "-combine":
    case "-waiting":
    case "-mustrecharge":
    case "-nothing":
    case "-notarget":
    case "-ohko":
    case "-hitcount":
    case "-singlemove":
    case "-singleturn":
    case "c":
    case "c:":
    case "chat":
    case "j":
    case "l":
    case "n":
    case "raw":
    case "html":
    case "debug":
    case "seed":
    case "error":
      return null;

    default:
      return null;
  }
}

/**
 * Process a multi-line protocol chunk (typically one full update).
 */
export function processChunk(state: BattleState, chunk: string): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const lines = chunk.split("\n").filter(Boolean);

  for (const line of lines) {
    const entry = processLine(state, line);
    if (entry) {
      entries.push(entry);
      state.log.push(entry);
      state.fullLog.push(entry);
    }
  }

  return entries;
}

/**
 * Parse a |request| JSON to extract available actions.
 */
export function parseRequest(requestJson: string): {
  actions: BattleActionSet | null;
  teamPreview: boolean;
  wait: boolean;
  forceSwitch: boolean;
  side?: { name: string; id: string; pokemon: RequestPokemon[] };
} {
  const req = JSON.parse(requestJson);

  if (req.wait) {
    return { actions: null, teamPreview: false, wait: true, forceSwitch: false };
  }

  if (req.teamPreview) {
    return { actions: null, teamPreview: true, wait: false, forceSwitch: false, side: req.side };
  }

  if (req.forceSwitch) {
    // Forced switch after KO
    const switches = extractSwitches(req.side?.pokemon || []);
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
    };
  }

  // Normal turn: extract moves and switches
  const active = req.active?.[0];
  const moves = extractMoves(active);

  const canTera = active?.canTerastallize != null;
  const switches = extractSwitches(req.side?.pokemon || []);

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
  };
}

/**
 * Parse a |request| JSON to extract available actions for a specific active slot.
 * Used for doubles where each active slot gets its own action set.
 */
export function parseRequestForSlot(requestJson: string, slotIndex: number): {
  actions: BattleActionSet | null;
  teamPreview: boolean;
  wait: boolean;
  forceSwitch: boolean;
  side?: { name: string; id: string; pokemon: RequestPokemon[] };
} {
  const req = JSON.parse(requestJson);

  if (req.wait) {
    return { actions: null, teamPreview: false, wait: true, forceSwitch: false };
  }

  if (req.teamPreview) {
    return { actions: null, teamPreview: true, wait: false, forceSwitch: false, side: req.side };
  }

  // Handle forceSwitch array in doubles
  if (req.forceSwitch) {
    const forceArr: boolean[] = Array.isArray(req.forceSwitch) ? req.forceSwitch : [req.forceSwitch];
    if (!forceArr[slotIndex]) {
      // This slot doesn't need to switch
      return { actions: null, teamPreview: false, wait: false, forceSwitch: false };
    }
    const switches = extractSwitches(req.side?.pokemon || []);
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
    };
  }

  const active = req.active?.[slotIndex];
  if (!active) {
    return { actions: null, teamPreview: false, wait: false, forceSwitch: false };
  }

  const moves = extractMoves(active);
  const canTera = active?.canTerastallize != null;
  const switches = extractSwitches(req.side?.pokemon || []);

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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMoves(active: any): BattleActionSet["moves"] {
  return (active?.moves || []).map((m: RequestMove) => {
    const moveData = dex.moves.get(m.id);
    return {
      name: m.move,
      id: m.id,
      pp: m.pp,
      maxPp: m.maxpp,
      type: (moveData?.type || m.type || "Normal") as PokemonType,
      disabled: m.disabled || false,
      target: m.target || "normal",
      basePower: moveData?.basePower ?? 0,
      category: (moveData?.category ?? "Status") as "Physical" | "Special" | "Status",
      accuracy: moveData?.accuracy === true ? true : (moveData?.accuracy ?? 100),
      description: moveData?.shortDesc || moveData?.desc || "",
    };
  });
}

function extractSwitches(pokemon: RequestPokemon[]): BattleActionSet["switches"] {
  return pokemon
    .map((p, i) => {
      const hpData = parseHp(p.condition || "0/0");
      const status = parseStatusFromHp(p.condition || "");
      const details = parseDetails(p.details);
      return {
        index: i + 1, // 1-indexed
        name: details.species,
        speciesId: toSpeciesId(details.species),
        hp: hpData.hp,
        maxHp: hpData.maxHp,
        status,
        fainted: hpData.hp === 0 || p.condition === "0 fnt",
      };
    })
    .filter((p) => !p.fainted);
}

/** Update side pokemon data from request side info */
export function updateSideFromRequest(
  state: BattleState,
  side: Side,
  reqSide: { name: string; id: string; pokemon: RequestPokemon[] }
) {
  state.sides[side].name = reqSide.name;

  for (let i = 0; i < reqSide.pokemon.length; i++) {
    const reqPoke = reqSide.pokemon[i];
    const details = parseDetails(reqPoke.details);
    const hpData = parseHp(reqPoke.condition || "100/100");
    const status = parseStatusFromHp(reqPoke.condition || "");

    // Find existing or create
    let pokemon = state.sides[side].team.find(
      (p) => p.name === details.species || p.speciesId === toSpeciesId(details.species)
    );

    if (!pokemon) {
      pokemon = makeEmptyPokemon();
      pokemon.name = details.species;
      pokemon.speciesId = toSpeciesId(details.species);
      pokemon.nickname = reqPoke.ident?.replace(/^p[12][a-d]?: /, "") || details.species;
      pokemon.level = details.level;
      state.sides[side].team.push(pokemon);
    }

    pokemon.hp = hpData.hp;
    // Request data is authoritative (absolute HP), but "0 fnt" returns
    // maxHp=0 — preserve the existing maxHp so fainted Pokemon show 0/maxHp
    // instead of 0/0.
    if (hpData.maxHp > 0) pokemon.maxHp = hpData.maxHp;
    pokemon.hpPercent = pokemon.maxHp > 0 ? Math.round((pokemon.hp / pokemon.maxHp) * 100) : 0;
    pokemon.status = status;
    pokemon.fainted = hpData.hp === 0;
    pokemon.item = reqPoke.item || "";
    pokemon.ability = reqPoke.baseAbility || reqPoke.ability || "";
    pokemon.teraType = reqPoke.teraType as PokemonType | undefined;

    // Parse stats
    if (reqPoke.stats) {
      pokemon.stats = {
        hp: hpData.maxHp || pokemon.maxHp,
        atk: reqPoke.stats.atk || 0,
        def: reqPoke.stats.def || 0,
        spa: reqPoke.stats.spa || 0,
        spd: reqPoke.stats.spd || 0,
        spe: reqPoke.stats.spe || 0,
      };
    }

    // Parse moves
    if (reqPoke.moves) {
      pokemon.moves = reqPoke.moves.map((m: string) => {
        const moveData = dex.moves.get(m);
        return {
          id: m,
          name: moveData?.name || m.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s: string) => s.toUpperCase()),
          pp: 0,
          maxPp: 0,
          type: (moveData?.type || "Normal") as PokemonType,
          disabled: false,
          target: moveData?.target || "normal",
        };
      });
    }

    // Mark active
    if (reqPoke.active) {
      const activeIdx = state.sides[side].active.findIndex((a) => a === pokemon);
      if (activeIdx === -1) {
        // Find first empty slot or first slot
        const emptyIdx = state.sides[side].active.findIndex((a) => a === null);
        if (emptyIdx !== -1) {
          state.sides[side].active[emptyIdx] = pokemon;
        } else if (state.sides[side].active.length === 0) {
          state.sides[side].active.push(pokemon);
        }
      }
    }
  }
}

function logEntry(type: BattleLogType, message: string, turn: number, side?: Side): BattleLogEntry {
  return { type, message, turn, side };
}

/** Request JSON types from @pkmn/sim */

interface RequestMove {
  move: string;
  id: string;
  pp: number;
  maxpp: number;
  type?: string;
  disabled?: boolean;
  target?: string;
}

interface RequestPokemon {
  ident?: string;
  details: string;
  condition: string;
  active?: boolean;
  stats?: { atk: number; def: number; spa: number; spd: number; spe: number };
  moves: string[];
  baseAbility?: string;
  ability?: string;
  item?: string;
  pokeball?: string;
  teraType?: string;
}
