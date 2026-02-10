import { Dex } from "@pkmn/dex";
import { Generations } from "@pkmn/data";
import { calculate, Pokemon, Move, Field } from "@smogon/calc";
import type {
  AIPlayer,
  BattleState,
  BattleActionSet,
  BattleAction,
  BattleFormat,
  BattlePokemon,
} from "../types";
import type { PokemonType } from "@nasty-plot/core";

const gens = new Generations(Dex);
const gen = gens.get(9);

// Type effectiveness chart for quick lookups without needing calc
const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {};

function getTypeEffectiveness(atkType: string, defTypes: string[]): number {
  let mult = 1;
  for (const defType of defTypes) {
    const species = Dex.types.get(atkType);
    if (!species?.exists) continue;
    const eff = Dex.types.get(atkType)?.damageTaken?.[defType];
    if (eff === 1) mult *= 2;
    else if (eff === 2) mult *= 0.5;
    else if (eff === 3) mult *= 0;
  }
  return mult;
}

/**
 * HeuristicAI uses type matchup awareness, switching logic, and situational
 * status move usage. Significantly smarter than GreedyAI.
 */
export class HeuristicAI implements AIPlayer {
  readonly difficulty = "heuristic" as const;

  async chooseAction(
    state: BattleState,
    actions: BattleActionSet
  ): Promise<BattleAction> {
    if (actions.forceSwitch) {
      return this.chooseBestSwitch(state, actions);
    }

    const myActive = state.sides.p2.active[0];
    const oppActive = state.sides.p1.active[0];

    if (!myActive || !oppActive) {
      return this.fallbackMove(actions);
    }

    // Score each possible action
    const scoredActions: { action: BattleAction; score: number }[] = [];

    // Score moves
    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i];
      if (move.disabled) continue;

      const score = this.scoreMove(move, myActive, oppActive, state);
      scoredActions.push({
        action: { type: "move", moveIndex: i + 1 },
        score,
      });
    }

    // Score switches (only if we have bad matchup)
    const matchupScore = this.evaluateMatchup(myActive, oppActive);
    if (matchupScore < -0.3) {
      // Bad matchup, consider switching
      for (const sw of actions.switches) {
        if (sw.fainted) continue;
        const swPokemon = state.sides.p2.team.find(
          (p) => p.name === sw.name || p.speciesId === sw.speciesId
        );
        if (!swPokemon) continue;

        const switchScore = this.scoreSwitchTarget(swPokemon, oppActive, myActive);
        scoredActions.push({
          action: { type: "switch", pokemonIndex: sw.index },
          score: switchScore,
        });
      }
    }

    // Pick highest scored action
    if (scoredActions.length === 0) {
      return this.fallbackMove(actions);
    }

    scoredActions.sort((a, b) => b.score - a.score);

    // Add some randomness to top choices (within 15% of best)
    const bestScore = scoredActions[0].score;
    const topChoices = scoredActions.filter(
      (a) => a.score >= bestScore * 0.85
    );

    const pick = topChoices[Math.floor(Math.random() * topChoices.length)];
    return pick.action;
  }

  private scoreMove(
    move: BattleActionSet["moves"][0],
    myPokemon: BattlePokemon,
    oppPokemon: BattlePokemon,
    state: BattleState
  ): number {
    let score = 0;
    const moveName = move.name;
    const moveData = Dex.moves.get(moveName);
    if (!moveData?.exists) return 0;

    // Damaging move scoring
    if (moveData.category !== "Status") {
      try {
        const attacker = new Pokemon(gen, myPokemon.name, {
          level: myPokemon.level,
          ability: myPokemon.ability || undefined,
          item: myPokemon.item || undefined,
        });
        const defender = new Pokemon(gen, oppPokemon.name, {
          level: oppPokemon.level,
          ability: oppPokemon.ability || undefined,
          item: oppPokemon.item || undefined,
          curHP: oppPokemon.hp,
        });
        const calcMove = new Move(gen, moveName);
        const result = calculate(gen, attacker, defender, calcMove, new Field());
        const damage = flattenDamage(result.damage);
        const avgDamage = damage.reduce((a, b) => a + b, 0) / damage.length;
        const maxDamage = Math.max(...damage);

        // Base score from damage percentage
        const dmgPercent = defender.maxHP() > 0 ? avgDamage / defender.maxHP() : 0;
        score += dmgPercent * 100;

        // Bonus for KO potential
        if (maxDamage >= oppPokemon.hp) {
          score += 50; // Can KO!
        }

        // STAB bonus (already in calc, but prefer STAB moves slightly)
        const myTypes = getSpeciesTypes(myPokemon.name);
        if (myTypes.includes(moveData.type as PokemonType)) {
          score += 5;
        }

        // Priority move bonus when opponent is low
        if (moveData.priority > 0 && oppPokemon.hpPercent < 30) {
          score += 20;
        }
      } catch {
        // Calc failed, use type effectiveness estimate
        const oppTypes = getSpeciesTypes(oppPokemon.name);
        const eff = getTypeEffectiveness(moveData.type, oppTypes as string[]);
        score += eff * 20;
      }
    } else {
      // Status move scoring
      score = this.scoreStatusMove(moveData, myPokemon, oppPokemon, state);
    }

    return score;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private scoreStatusMove(
    moveData: any,
    myPokemon: BattlePokemon,
    oppPokemon: BattlePokemon,
    state: BattleState
  ): number {
    const moveName = moveData.id;
    let score = 0;

    // Hazard moves: high value early game
    if (["stealthrock", "spikes", "toxicspikes", "stickyweb"].includes(moveName)) {
      const oppSide = state.sides.p1.sideConditions;
      if (moveName === "stealthrock" && !oppSide.stealthRock) {
        score = state.turn <= 3 ? 45 : 25;
      } else if (moveName === "spikes" && oppSide.spikes < 3) {
        score = state.turn <= 5 ? 35 : 15;
      } else if (moveName === "toxicspikes" && oppSide.toxicSpikes < 2) {
        score = state.turn <= 4 ? 30 : 12;
      } else if (moveName === "stickyweb" && !oppSide.stickyWeb) {
        score = state.turn <= 2 ? 40 : 20;
      }
      return score;
    }

    // Status inflicting moves
    if (["willowisp", "thunderwave", "toxic", "spore", "sleeppowder", "yawn"].includes(moveName)) {
      if (oppPokemon.status === "") {
        // Opponent has no status - good target
        score = 30;
        if (moveName === "spore" || moveName === "sleeppowder") score = 40; // Sleep is very strong
        if (moveName === "toxic") score = 35;
        if (moveName === "thunderwave") score = 25;
        if (moveName === "willowisp") score = 28;
      }
      return score;
    }

    // Setup moves
    if (["swordsdance", "nastyplot", "calmmind", "dragondance", "irondefense", "amnesia"].includes(moveName)) {
      // Setup when opponent can't threaten well
      const matchup = this.evaluateMatchup(myPokemon, oppPokemon);
      if (matchup > 0.2 && myPokemon.hpPercent > 70) {
        score = 35;
      }
      return score;
    }

    // Recovery moves
    if (["recover", "roost", "softboiled", "moonlight", "synthesis", "shoreup", "slackoff"].includes(moveName)) {
      if (myPokemon.hpPercent < 50) {
        score = 40;
      } else if (myPokemon.hpPercent < 75) {
        score = 20;
      }
      return score;
    }

    // Defog / Rapid Spin for hazard removal
    if (moveName === "defog" || moveName === "rapidspin") {
      const mySide = state.sides.p2.sideConditions;
      const hazardCount = (mySide.stealthRock ? 1 : 0) + mySide.spikes + mySide.toxicSpikes + (mySide.stickyWeb ? 1 : 0);
      if (hazardCount > 0) {
        score = 30 + hazardCount * 5;
      }
      return score;
    }

    // Default: small score for unknown status moves
    return 5;
  }

  private evaluateMatchup(myPokemon: BattlePokemon, oppPokemon: BattlePokemon): number {
    // Returns -1 to 1, where positive means favorable for myPokemon
    const myTypes = getSpeciesTypes(myPokemon.name);
    const oppTypes = getSpeciesTypes(oppPokemon.name);

    let myOffense = 0;
    let oppOffense = 0;

    // Check how well our types hit them
    for (const t of myTypes) {
      const eff = getTypeEffectiveness(t, oppTypes as string[]);
      if (eff > 1) myOffense += 0.3;
      if (eff < 1) myOffense -= 0.15;
    }

    // Check how well their types hit us
    for (const t of oppTypes) {
      const eff = getTypeEffectiveness(t, myTypes as string[]);
      if (eff > 1) oppOffense += 0.3;
      if (eff < 1) oppOffense -= 0.15;
    }

    return myOffense - oppOffense;
  }

  private scoreSwitchTarget(
    switchTarget: BattlePokemon,
    opponent: BattlePokemon,
    current: BattlePokemon
  ): number {
    let score = 0;

    // Good type matchup against opponent
    const matchup = this.evaluateMatchup(switchTarget, opponent);
    score += matchup * 40;

    // Health factor
    score += (switchTarget.hpPercent / 100) * 10;

    // Penalty for switching into something with bad matchup
    if (matchup < -0.3) {
      score -= 30;
    }

    // Bonus if we resist what the opponent likely uses
    const oppTypes = getSpeciesTypes(opponent.name);
    const switchTypes = getSpeciesTypes(switchTarget.name);
    for (const t of oppTypes) {
      const eff = getTypeEffectiveness(t, switchTypes as string[]);
      if (eff < 1) score += 10;
      if (eff === 0) score += 20;
    }

    return score;
  }

  private chooseBestSwitch(state: BattleState, actions: BattleActionSet): BattleAction {
    const oppActive = state.sides.p1.active[0];
    const available = actions.switches.filter((s) => !s.fainted);

    if (available.length === 0) {
      return { type: "switch", pokemonIndex: actions.switches[0]?.index || 1 };
    }

    if (!oppActive) {
      // No info about opponent, pick healthiest
      const best = available.reduce((a, b) =>
        (a.hp / a.maxHp) > (b.hp / b.maxHp) ? a : b
      );
      return { type: "switch", pokemonIndex: best.index };
    }

    // Score each switch target
    let bestScore = -Infinity;
    let bestIndex = available[0].index;

    for (const sw of available) {
      const pokemon = state.sides.p2.team.find(
        (p) => p.name === sw.name || p.speciesId === sw.speciesId
      );
      if (!pokemon) continue;

      const myActive = state.sides.p2.active[0];
      const score = this.scoreSwitchTarget(pokemon, oppActive, myActive || pokemon);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = sw.index;
      }
    }

    return { type: "switch", pokemonIndex: bestIndex };
  }

  private fallbackMove(actions: BattleActionSet): BattleAction {
    const enabledMoves = actions.moves.filter((m) => !m.disabled);
    if (enabledMoves.length > 0) {
      const idx = actions.moves.indexOf(enabledMoves[0]);
      return { type: "move", moveIndex: idx + 1 };
    }
    return { type: "move", moveIndex: 1 };
  }

  chooseLeads(teamSize: number, _gameType: BattleFormat): number[] {
    // Lead with first Pokemon (assumed to be the team's lead)
    return Array.from({ length: teamSize }, (_, i) => i + 1);
  }
}

function getSpeciesTypes(name: string): PokemonType[] {
  const species = Dex.species.get(name);
  if (species?.exists) return species.types as PokemonType[];
  return ["Normal"];
}

function flattenDamage(damage: number | number[] | number[][]): number[] {
  if (typeof damage === "number") return [damage];
  if (Array.isArray(damage) && damage.length > 0) {
    if (Array.isArray(damage[0])) {
      return (damage as number[][])[0];
    }
    return damage as number[];
  }
  return [0];
}
