import { processLine, processChunk, parseRequest, updateSideFromRequest } from "@nasty-plot/battle-engine";
import type { BattleState } from "@nasty-plot/battle-engine";
import { createInitialState } from "@nasty-plot/battle-engine";

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

  describe("processLine - additional protocol messages", () => {
    it("parses |-fail| with valid ident", () => {
      const state = makeState();
      const entry = processLine(state, "|-fail|p1a: Garchomp");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("info");
      expect(entry!.message).toContain("Garchomp");
      expect(entry!.message).toContain("failed");
    });

    it("returns null for |-fail| with no ident", () => {
      const state = makeState();
      const entry = processLine(state, "|-fail|");

      expect(entry).toBeNull();
    });

    it("parses |-miss| with valid ident", () => {
      const state = makeState();
      const entry = processLine(state, "|-miss|p1a: Garchomp");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("info");
      expect(entry!.message).toContain("Garchomp");
      expect(entry!.message).toContain("missed");
    });

    it("returns null for |-miss| with no ident", () => {
      const state = makeState();
      const entry = processLine(state, "|-miss|");

      expect(entry).toBeNull();
    });

    it("returns null for |-activate| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-activate|p1a: Garchomp|ability: Rough Skin")).toBeNull();
    });

    it("returns null for |-hint| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-hint|Some helpful hint")).toBeNull();
    });

    it("returns null for |-combine| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-combine")).toBeNull();
    });

    it("returns null for |-waiting| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-waiting|p1a: Garchomp|p2a: Heatran")).toBeNull();
    });

    it("returns null for |-prepare| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-prepare|p1a: Garchomp|Solar Beam")).toBeNull();
    });

    it("returns null for |-mustrecharge| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-mustrecharge|p1a: Garchomp")).toBeNull();
    });

    it("returns null for |-nothing| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-nothing")).toBeNull();
    });

    it("returns null for |-notarget| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-notarget|p1a: Garchomp")).toBeNull();
    });

    it("returns null for |-ohko| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-ohko")).toBeNull();
    });

    it("returns null for |-hitcount| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-hitcount|p2a: Heatran|3")).toBeNull();
    });

    it("returns null for |-singlemove| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-singlemove|p1a: Garchomp|Destiny Bond")).toBeNull();
    });

    it("returns null for |-singleturn| messages", () => {
      const state = makeState();
      expect(processLine(state, "|-singleturn|p1a: Garchomp|Protect")).toBeNull();
    });

    it("returns null for chat messages (c, c:, chat, j, l, n)", () => {
      const state = makeState();
      expect(processLine(state, "|c|~SomeUser|hello")).toBeNull();
      expect(processLine(state, "|c:|1234567890|~SomeUser|hello")).toBeNull();
      expect(processLine(state, "|chat|~SomeUser|hello")).toBeNull();
      expect(processLine(state, "|j|~SomeUser")).toBeNull();
      expect(processLine(state, "|l|~SomeUser")).toBeNull();
      expect(processLine(state, "|n|~SomeUser|oldname")).toBeNull();
    });

    it("returns null for raw, html, debug, seed, error messages", () => {
      const state = makeState();
      expect(processLine(state, "|raw|<div>some html</div>")).toBeNull();
      expect(processLine(state, "|html|<b>bold</b>")).toBeNull();
      expect(processLine(state, "|debug|some debug info")).toBeNull();
      expect(processLine(state, "|seed|abc123")).toBeNull();
      expect(processLine(state, "|error|some error")).toBeNull();
    });

    it("returns null for unknown/unhandled protocol commands", () => {
      const state = makeState();
      expect(processLine(state, "|unknowncommand|foo|bar")).toBeNull();
      expect(processLine(state, "|totallynotathing|123")).toBeNull();
    });

    it("parses |tie| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|tie");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("win");
      expect(entry!.message).toContain("tie");
      expect(state.phase).toBe("ended");
    });

    it("parses |player| messages and updates side name", () => {
      const state = makeState();
      processLine(state, "|player|p1|Ash|avatar123|1000");

      expect(state.sides.p1.name).toBe("Ash");
    });

    it("parses |player| with empty name defaults to player id", () => {
      const state = makeState();
      processLine(state, "|player|p2||avatar123");

      expect(state.sides.p2.name).toBe("p2");
    });

    it("parses |gametype| for doubles", () => {
      const state = makeState();
      processLine(state, "|gametype|doubles");

      expect(state.format).toBe("doubles");
    });

    it("returns null for |teamsize|, |gen|, |tier|, |rule|, |rated|, |clearpoke|, |teampreview|, |start|", () => {
      const state = makeState();
      expect(processLine(state, "|teamsize|p1|6")).toBeNull();
      expect(processLine(state, "|gen|9")).toBeNull();
      expect(processLine(state, "|tier|[Gen 9] OU")).toBeNull();
      expect(processLine(state, "|rule|Sleep Clause Mod")).toBeNull();
      expect(processLine(state, "|rated|")).toBeNull();
      expect(processLine(state, "|clearpoke")).toBeNull();
      expect(processLine(state, "|teampreview")).toBeNull();
      expect(processLine(state, "|start")).toBeNull();
    });

    it("returns null for |t:| timestamp", () => {
      const state = makeState();
      expect(processLine(state, "|t:|1700000000")).toBeNull();
    });

    it("parses |cant| messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      const entry = processLine(state, "|cant|p1a: Garchomp|par");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("cant");
      expect(entry!.message).toContain("can't move");
      expect(entry!.message).toContain("par");
    });

    it("parses |-resisted| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|-resisted|p2a: Heatran");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("resisted");
      expect(entry!.message).toContain("not very effective");
    });

    it("parses |-immune| messages", () => {
      const state = makeState();
      const entry = processLine(state, "|-immune|p2a: Heatran");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("immune");
      expect(entry!.message).toContain("no effect");
    });

    it("parses |-ability| messages and updates pokemon ability", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-ability|p1a: Garchomp|Rough Skin");

      expect(state.sides.p1.active[0]!.ability).toBe("Rough Skin");
    });

    it("parses |-start| volatile status messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      const entry = processLine(state, "|-start|p1a: Garchomp|Substitute");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("start");
      expect(state.sides.p1.active[0]!.volatiles).toContain("Substitute");
    });

    it("parses |-start| typechange for Protean/Terastallization", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-start|p1a: Garchomp|typechange|Ground");

      expect(state.sides.p1.active[0]!.types).toEqual(["Ground"]);
    });

    it("does not duplicate volatile status", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-start|p1a: Garchomp|Substitute");
      processLine(state, "|-start|p1a: Garchomp|Substitute");

      expect(state.sides.p1.active[0]!.volatiles.filter((v) => v === "Substitute")).toHaveLength(1);
    });

    it("parses |-end| volatile status removal", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-start|p1a: Garchomp|Substitute");
      processLine(state, "|-end|p1a: Garchomp|Substitute");

      expect(state.sides.p1.active[0]!.volatiles).not.toContain("Substitute");
    });

    it("parses |drag| messages like switch", () => {
      const state = makeState();
      const entry = processLine(state, "|drag|p1a: Garchomp|Garchomp, L100|319/319");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("switch");
      expect(entry!.message).toContain("dragged out");
      expect(state.sides.p1.active[0]!.name).toBe("Garchomp");
    });

    it("parses |replace| messages like switch", () => {
      const state = makeState();
      const entry = processLine(state, "|replace|p1a: Zoroark|Zoroark, L100|255/255");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("switch");
      expect(entry!.message).toContain("appeared");
    });

    it("parses weather upkeep and decrements turns", () => {
      const state = makeState();
      processLine(state, "|-weather|Sandstorm");
      expect(state.field.weatherTurns).toBe(5);

      processLine(state, "|-weather|Sandstorm|[upkeep]");
      expect(state.field.weatherTurns).toBe(4);
    });

    it("parses |-fieldstart| for Trick Room", () => {
      const state = makeState();
      processLine(state, "|-fieldstart|move: Trick Room");

      expect(state.field.trickRoom).toBe(5);
    });

    it("parses |-fieldend| for Trick Room", () => {
      const state = makeState();
      processLine(state, "|-fieldstart|move: Trick Room");
      processLine(state, "|-fieldend|move: Trick Room");

      expect(state.field.trickRoom).toBe(0);
    });

    it("parses |-sidestart| and |-sideend| for Toxic Spikes", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Toxic Spikes");
      expect(state.sides.p1.sideConditions.toxicSpikes).toBe(1);

      processLine(state, "|-sidestart|p1: Player|move: Toxic Spikes");
      expect(state.sides.p1.sideConditions.toxicSpikes).toBe(2);

      processLine(state, "|-sideend|p1: Player|move: Toxic Spikes");
      expect(state.sides.p1.sideConditions.toxicSpikes).toBe(0);
    });

    it("parses |-sidestart| for Sticky Web", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Sticky Web");
      expect(state.sides.p1.sideConditions.stickyWeb).toBe(true);

      processLine(state, "|-sideend|p1: Player|move: Sticky Web");
      expect(state.sides.p1.sideConditions.stickyWeb).toBe(false);
    });

    it("parses |-sidestart| for Light Screen and Aurora Veil", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Light Screen");
      expect(state.sides.p1.sideConditions.lightScreen).toBe(5);

      processLine(state, "|-sidestart|p1: Player|move: Aurora Veil");
      expect(state.sides.p1.sideConditions.auroraVeil).toBe(5);
    });

    it("parses |-sidestart| for Tailwind", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Tailwind");
      expect(state.sides.p1.sideConditions.tailwind).toBe(4);

      processLine(state, "|-sideend|p1: Player|move: Tailwind");
      expect(state.sides.p1.sideConditions.tailwind).toBe(0);
    });

    it("parses |-sideend| for Light Screen and Aurora Veil", () => {
      const state = makeState();
      processLine(state, "|-sidestart|p1: Player|move: Light Screen");
      processLine(state, "|-sideend|p1: Player|move: Light Screen");
      expect(state.sides.p1.sideConditions.lightScreen).toBe(0);

      processLine(state, "|-sidestart|p1: Player|move: Aurora Veil");
      processLine(state, "|-sideend|p1: Player|move: Aurora Veil");
      expect(state.sides.p1.sideConditions.auroraVeil).toBe(0);
    });

    it("parses boost amounts for sharply/drastically messages", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");

      const entry1 = processLine(state, "|-boost|p1a: Garchomp|atk|1");
      expect(entry1!.message).not.toContain("sharply");
      expect(entry1!.message).not.toContain("drastically");

      const entry2 = processLine(state, "|-boost|p1a: Garchomp|atk|2");
      expect(entry2!.message).toContain("sharply");

      const entry3 = processLine(state, "|-boost|p1a: Garchomp|spe|3");
      expect(entry3!.message).toContain("drastically");
    });

    it("clamps boosts to +6", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-boost|p1a: Garchomp|atk|3");
      processLine(state, "|-boost|p1a: Garchomp|atk|3");
      processLine(state, "|-boost|p1a: Garchomp|atk|3");

      expect(state.sides.p1.active[0]!.boosts.atk).toBe(6);
    });

    it("clamps unboosts to -6", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      processLine(state, "|-unboost|p1a: Garchomp|def|3");
      processLine(state, "|-unboost|p1a: Garchomp|def|3");
      processLine(state, "|-unboost|p1a: Garchomp|def|3");

      expect(state.sides.p1.active[0]!.boosts.def).toBe(-6);
    });

    it("parses |-enditem| messages and clears item", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      state.sides.p1.active[0]!.item = "Life Orb";
      const entry = processLine(state, "|-enditem|p1a: Garchomp|Life Orb");

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe("item");
      expect(entry!.message).toContain("consumed");
      expect(state.sides.p1.active[0]!.item).toBe("");
    });

    it("handles damage with source annotation", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      const entry = processLine(state, "|-damage|p1a: Garchomp|280/319|[from] Stealth Rock");

      expect(entry).not.toBeNull();
      expect(entry!.message).toContain("Stealth Rock");
    });

    it("handles heal with source annotation", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|200/319");
      const entry = processLine(state, "|-heal|p1a: Garchomp|220/319|[from] item: Leftovers");

      expect(entry).not.toBeNull();
      expect(entry!.message).toContain("restored");
      expect(entry!.message).toContain("item: Leftovers");
    });

    it("switch resets boosts and volatiles", () => {
      const state = makeState();
      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");
      state.sides.p1.active[0]!.boosts.atk = 4;
      state.sides.p1.active[0]!.volatiles.push("Substitute");

      processLine(state, "|switch|p1a: Garchomp|Garchomp, L100|319/319");

      expect(state.sides.p1.active[0]!.boosts.atk).toBe(0);
      expect(state.sides.p1.active[0]!.volatiles).toEqual([]);
    });

    it("parses weather types: SunnyDay, RainDance, Snow", () => {
      const state = makeState();
      processLine(state, "|-weather|SunnyDay");
      expect(state.field.weather).toBe("Sun");

      processLine(state, "|-weather|RainDance");
      expect(state.field.weather).toBe("Rain");

      processLine(state, "|-weather|Snow");
      expect(state.field.weather).toBe("Snow");

      processLine(state, "|-weather|Hail");
      expect(state.field.weather).toBe("Snow");
    });

    it("parses all terrain types", () => {
      const state = makeState();

      processLine(state, "|-fieldstart|move: Grassy Terrain");
      expect(state.field.terrain).toBe("Grassy");

      processLine(state, "|-fieldstart|move: Misty Terrain");
      expect(state.field.terrain).toBe("Misty");

      processLine(state, "|-fieldstart|move: Psychic Terrain");
      expect(state.field.terrain).toBe("Psychic");
    });
  });

  describe("updateSideFromRequest", () => {
    it("updates side name", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Ash",
        id: "p1",
        pokemon: [],
      });

      expect(state.sides.p1.name).toBe("Ash");
    });

    it("creates new pokemon on the team from request data", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
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
        ],
      });

      expect(state.sides.p1.team).toHaveLength(1);
      const pokemon = state.sides.p1.team[0];
      expect(pokemon.name).toBe("Garchomp");
      expect(pokemon.speciesId).toBe("garchomp");
      expect(pokemon.level).toBe(100);
      expect(pokemon.hp).toBe(319);
      expect(pokemon.maxHp).toBe(319);
      expect(pokemon.hpPercent).toBe(100);
      expect(pokemon.item).toBe("lifeorb");
      expect(pokemon.ability).toBe("roughskin");
      expect(pokemon.teraType).toBe("Ground");
    });

    it("parses stats from request pokemon", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: [],
          },
        ],
      });

      const pokemon = state.sides.p1.team[0];
      expect(pokemon.stats.hp).toBe(319);
      expect(pokemon.stats.atk).toBe(394);
      expect(pokemon.stats.def).toBe(226);
      expect(pokemon.stats.spa).toBe(176);
      expect(pokemon.stats.spd).toBe(206);
      expect(pokemon.stats.spe).toBe(333);
    });

    it("parses moves from request pokemon", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake", "dragonclaw"],
          },
        ],
      });

      const pokemon = state.sides.p1.team[0];
      expect(pokemon.moves).toHaveLength(2);
      expect(pokemon.moves[0].id).toBe("earthquake");
      expect(pokemon.moves[0].name).toBe("Earthquake");
      expect(pokemon.moves[1].id).toBe("dragonclaw");
      expect(pokemon.moves[1].name).toBe("Dragon Claw");
    });

    it("sets active pokemon in active slot", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            active: true,
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
          },
        ],
      });

      expect(state.sides.p1.active[0]).not.toBeNull();
      expect(state.sides.p1.active[0]!.name).toBe("Garchomp");
    });

    it("handles fainted pokemon (0 fnt condition)", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "0 fnt",
            stats: {},
            moves: [],
          },
        ],
      });

      const pokemon = state.sides.p1.team[0];
      expect(pokemon.hp).toBe(0);
      expect(pokemon.fainted).toBe(true);
    });

    it("handles pokemon with status in condition string", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "200/319 brn",
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: [],
          },
        ],
      });

      const pokemon = state.sides.p1.team[0];
      expect(pokemon.hp).toBe(200);
      expect(pokemon.status).toBe("brn");
    });

    it("updates existing pokemon instead of creating duplicate", () => {
      const state = makeState();
      // First call creates pokemon
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
            item: "lifeorb",
          },
        ],
      });

      // Second call should update, not duplicate
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "200/319",
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
            item: "choiceband",
          },
        ],
      });

      expect(state.sides.p1.team).toHaveLength(1);
      expect(state.sides.p1.team[0].hp).toBe(200);
      expect(state.sides.p1.team[0].item).toBe("choiceband");
    });

    it("handles pokemon with ability fallback (no baseAbility)", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: [],
            ability: "roughskin",
          },
        ],
      });

      expect(state.sides.p1.team[0].ability).toBe("roughskin");
    });

    it("uses species name as nickname when ident is missing", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            details: "Garchomp, L100",
            condition: "319/319",
            stats: {},
            moves: [],
          },
        ],
      });

      expect(state.sides.p1.team[0].nickname).toBe("Garchomp");
    });

    it("handles multiple pokemon with mixed conditions", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            active: true,
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
          },
          {
            ident: "p1: Heatran",
            details: "Heatran, L100",
            condition: "150/311 par",
            active: false,
            stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
            moves: ["magmastorm"],
          },
          {
            ident: "p1: Clefable",
            details: "Clefable, L100",
            condition: "0 fnt",
            active: false,
            stats: {},
            moves: [],
          },
        ],
      });

      expect(state.sides.p1.team).toHaveLength(3);
      expect(state.sides.p1.team[0].hpPercent).toBe(100);
      expect(state.sides.p1.team[1].hp).toBe(150);
      expect(state.sides.p1.team[1].status).toBe("par");
      expect(state.sides.p1.team[2].fainted).toBe(true);
    });

    it("handles pokemon without stats", () => {
      const state = makeState();
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            moves: [],
          },
        ],
      });

      // Should not error; stats should remain at defaults
      expect(state.sides.p1.team[0].stats).toBeDefined();
    });

    it("pushes to active when active array is empty", () => {
      const state = makeState();
      // Set active to an empty array to hit the push branch
      state.sides.p1.active = [];

      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            active: true,
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
          },
        ],
      });

      expect(state.sides.p1.active).toHaveLength(1);
      expect(state.sides.p1.active[0]!.name).toBe("Garchomp");
    });

    it("does not re-add pokemon already in active slot", () => {
      const state = makeState();
      // First, set up a pokemon in team and active
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            active: true,
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
          },
        ],
      });

      // Call again - should not duplicate in active
      updateSideFromRequest(state, "p1", {
        name: "Player",
        id: "p1",
        pokemon: [
          {
            ident: "p1a: Garchomp",
            details: "Garchomp, L100",
            condition: "300/319",
            active: true,
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
          },
        ],
      });

      // Still only 1 active
      const activeCount = state.sides.p1.active.filter((a) => a !== null).length;
      expect(activeCount).toBe(1);
      expect(state.sides.p1.team).toHaveLength(1);
    });
  });
});
