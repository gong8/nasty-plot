import { processLine, processChunk, parseRequest } from "../protocol-parser";
import type { BattleState } from "../types";
import { createInitialState } from "../battle-manager";

function makeState(): BattleState {
  const state = createInitialState("test", "singles");
  state.sides.p1.name = "Player";
  state.sides.p2.name = "Opponent";
  return state;
}

describe("protocol-parser", () => {
  describe("processLine", () => {
    it("parses |turn| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|turn|3");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("turn");
      expect(state.turn).toBe(3);
    });

    it("parses |switch| messages and updates state", () => {
      const state = makeState();
      const entry = processLine(state, "|switch|p1a: Garchomp|Garchomp, L100, M|319/319");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("switch");
      expect(state.sides.p1.team).toHaveLength(1);
      expect(state.sides.p1.team[0].name).toBe("Garchomp");
      expect(state.sides.p1.team[0].hp).toBe(319);
      expect(state.sides.p1.team[0].maxHp).toBe(319);
      expect(state.sides.p1.team[0].hpPercent).toBe(100);
      expect(state.sides.p1.active[0]).toBe(state.sides.p1.team[0]);
    });

    it("parses |move| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|move|p1a: Garchomp|Earthquake|p2a: Heatran");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("move");
      expect(entry!.message).toContain("Earthquake");
    });

    it("parses |-damage| messages and updates HP", () => {
      const state = makeState();
      // First switch in a Pokemon
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      // Then damage it
      const entry = processLine(state, "|-damage|p1a: Garchomp|200/319");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("damage");
      const pokemon = state.sides.p1.active[0];
      expect(pokemon!.hp).toBe(200);
      expect(pokemon!.maxHp).toBe(319);
    });

    it("parses |-heal| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|200/319");
      const entry = processLine(state, "|-heal|p1a: Garchomp|280/319");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("heal");
      expect(state.sides.p1.active[0]!.hp).toBe(280);
    });

    it("parses |faint| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      const entry = processLine(state, "|faint|p1a: Garchomp");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("faint");
      expect(state.sides.p1.active[0]!.fainted).toBe(true);
      expect(state.sides.p1.active[0]!.hp).toBe(0);
    });

    it("parses |-status| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      const entry = processLine(state, "|-status|p1a: Garchomp|brn");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("status");
      expect(state.sides.p1.active[0]!.status).toBe("brn");
    });

    it("parses |-curestatus| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-status|p1a: Garchomp|par");
      processLine(state, "|-curestatus|p1a: Garchomp|par");

      expect(state.sides.p1.active[0]!.status).toBe("");
    });

    it("parses |-boost| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      const entry = processLine(state, "|-boost|p1a: Garchomp|atk|2");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("boost");
      expect(state.sides.p1.active[0]!.boosts.atk).toBe(2);
    });

    it("parses |-unboost| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-unboost|p1a: Garchomp|def|1");

      expect(state.sides.p1.active[0]!.boosts.def).toBe(-1);
    });

    it("parses |-weather| messages", () => {
      const state = makeState();
      processLine(state, "|-weather|Sandstorm|[from] ability: Sand Stream|[of] p1a: Tyranitar");

      expect(state.field.weather).toBe("Sand");
    });

    it("clears weather on none", () => {
      const state = makeState();
      processLine(state, "|-weather|Sandstorm");
      processLine(state, "|-weather|none");

      expect(state.field.weather).toBe("");
    });

    it("parses |-sidestart| for hazards", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Stealth Rock");

      expect(state.sides.p1.sideConditions.stealthRock).toBe(true);
    });

    it("parses |-sidestart| for spikes (stacks)", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Spikes");
      processLine(state, "|-sidestart|p1: Player|move: Spikes");

      expect(state.sides.p1.sideConditions.spikes).toBe(2);
    });

    it("parses |-sideend| for hazard removal", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Stealth Rock");
      processLine(state, "|-sideend|p1: Player|move: Stealth Rock");

      expect(state.sides.p1.sideConditions.stealthRock).toBe(false);
    });

    it("parses |-sidestart| for screens", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Reflect");

      expect(state.sides.p1.sideConditions.reflect).toBe(5);
    });

    it("parses |-terastallize| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-terastallize|p1a: Garchomp|Ground");

      expect(state.sides.p1.active[0]!.isTerastallized).toBe(true);
      expect(state.sides.p1.active[0]!.teraType).toBe("Ground");
      expect(state.sides.p1.canTera).toBe(false);
    });

    it("parses |win| messages", () => {
      const state = makeState();
      state.sides.p1.name = "Player";
      const entry = processLine(state, "|win|Player");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("win");
      expect(state.winner).toBe("p1");
      expect(state.phase).toBe("ended");
    });

    it("parses |-fieldstart| for terrain", () => {
      const state = makeState();
      processLine(state, "|-fieldstart|move: Electric Terrain");

      expect(state.field.terrain).toBe("Electric");
    });

    it("parses |-fieldend| for terrain", () => {
      const state = makeState();
      processLine(state, "|-fieldstart|move: Electric Terrain");
      processLine(state, "|-fieldend|move: Electric Terrain");

      expect(state.field.terrain).toBe("");
    });

    it("parses |-item| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-item|p1a: Garchomp|Leftovers");

      expect(state.sides.p1.active[0]!.item).toBe("Leftovers");
    });

    it("parses |-enditem| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      state.sides.p1.active[0]!.item = "Focus Sash";
      processLine(state, "|-enditem|p1a: Garchomp|Focus Sash");

      expect(state.sides.p1.active[0]!.item).toBe("");
    });

    it("parses |-crit| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|-crit|p2a: Heatran");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("crit");
    });

    it("parses |-supereffective| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|-supereffective|p2a: Heatran");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("supereffective");
    });

    it("returns null for unknown or irrelevant messages", () => {
      const state = makeState();
      expect(processLine(state, "|upkeep")).toBeNull();
      expect(processLine(state, "|")).toBeNull();
      expect(processLine(state, "")).toBeNull();
    });

    it("handles HP with status condition", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319 par");

      const pokemon = state.sides.p1.active[0]!;
      expect(pokemon.hp).toBe(319);
      expect(pokemon.status).toBe("par");
    });

    it("handles fainted HP string", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-damage|p1a: Garchomp|0 fnt");

      const pokemon = state.sides.p1.active[0]!;
      expect(pokemon.hp).toBe(0);
      expect(pokemon.fainted).toBe(true);
    });
  });

  describe("processChunk", () => {
    it("processes multiple lines at once", () => {
      const state = makeState();
      const chunk = [
        "|switch|p1a: Garchomp|Garchomp, L100|319/319",
        "|switch|p2a: Heatran|Heatran, L100|311/311",
        "|turn|1",
      ].join("\n");

      const entries = processChunk(state, chunk);

      expect(entries).toHaveLength(3);
      expect(state.sides.p1.active[0]!.name).toBe("Garchomp");
      expect(state.sides.p2.active[0]!.name).toBe("Heatran");
      expect(state.turn).toBe(1);
    });

    it("adds entries to fullLog", () => {
      const state = makeState();
      processChunk(state, "|turn|1");
      processChunk(state, "|turn|2");

      expect(state.fullLog).toHaveLength(2);
    });
  });

  describe("parseRequest", () => {
    it("parses a normal turn request", () => {
      const request = JSON.stringify({
        active: [{
          moves: [
            { move: "Earthquake", id: "earthquake", pp: 16, maxpp: 16, target: "normal", type: "Ground" },
            { move: "Dragon Claw", id: "dragonclaw", pp: 24, maxpp: 24, target: "normal", type: "Dragon" },
          ],
          canTerastallize: "Ground",
        }],
        side: {
          name: "Player",
          id: "p1",
          pokemon: [
            {
              ident: "p1a: Garchomp",
              details: "Garchomp, L100, M",
              condition: "319/319",
              active: true,
              stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
              moves: ["earthquake", "dragonclaw", "swordsdance", "scaleshot"],
              baseAbility: "roughskin",
              item: "lifeorb",
              teraType: "Ground",
            },
            {
              ident: "p1: Heatran",
              details: "Heatran, L100, M",
              condition: "311/311",
              active: false,
              stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
              moves: ["magmastorm", "earthpower", "flashcannon", "taunt"],
              baseAbility: "flashfire",
              item: "leftovers",
              teraType: "Fairy",
            },
          ],
        },
      });

      const result = parseRequest(request);

      expect(result.teamPreview).toBe(false);
      expect(result.wait).toBe(false);
      expect(result.actions).not.toBeNull();
      expect(result.actions!.moves).toHaveLength(2);
      expect(result.actions!.moves[0].name).toBe("Earthquake");
      expect(result.actions!.canTera).toBe(true);
      expect(result.actions!.switches).toHaveLength(2); // both non-fainted pokemon
    });

    it("parses a force switch request", () => {
      const request = JSON.stringify({
        forceSwitch: [true],
        side: {
          name: "Player",
          id: "p1",
          pokemon: [
            {
              ident: "p1a: Garchomp",
              details: "Garchomp, L100",
              condition: "0 fnt",
              active: true,
              stats: {},
              moves: [],
            },
            {
              ident: "p1: Heatran",
              details: "Heatran, L100",
              condition: "311/311",
              active: false,
              stats: {},
              moves: [],
            },
          ],
        },
      });

      const result = parseRequest(request);

      expect(result.actions).not.toBeNull();
      expect(result.actions!.forceSwitch).toBe(true);
      expect(result.actions!.moves).toHaveLength(0);
      expect(result.actions!.switches.length).toBeGreaterThan(0);
    });

    it("parses a team preview request", () => {
      const request = JSON.stringify({
        teamPreview: true,
        side: {
          name: "Player",
          id: "p1",
          pokemon: [
            { details: "Garchomp, L100", condition: "319/319", moves: [] },
          ],
        },
      });

      const result = parseRequest(request);

      expect(result.teamPreview).toBe(true);
      expect(result.actions).toBeNull();
    });

    it("parses a wait request", () => {
      const request = JSON.stringify({ wait: true });
      const result = parseRequest(request);

      expect(result.wait).toBe(true);
      expect(result.actions).toBeNull();
    });
  });
});
