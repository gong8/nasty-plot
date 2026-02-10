import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../api-client.js";

// Full type effectiveness chart
const TYPE_CHART: Record<string, Record<string, number>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: {
    Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5,
    Dragon: 0.5, Steel: 2,
  },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: {
    Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5,
  },
  Grass: {
    Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5,
    Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5,
  },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: {
    Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5,
    Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5,
  },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: {
    Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0,
    Bug: 0.5, Rock: 2, Steel: 2,
  },
  Flying: {
    Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5,
  },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: {
    Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5,
    Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5,
  },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Poison: 0.5, Fighting: 2, Dragon: 2, Dark: 2, Steel: 0.5 },
};

const NATURES_DATA = {
  Adamant: { plus: "atk", minus: "spa" },
  Bashful: {},
  Bold: { plus: "def", minus: "atk" },
  Brave: { plus: "atk", minus: "spe" },
  Calm: { plus: "spd", minus: "atk" },
  Careful: { plus: "spd", minus: "spa" },
  Docile: {},
  Gentle: { plus: "spd", minus: "def" },
  Hardy: {},
  Hasty: { plus: "spe", minus: "def" },
  Impish: { plus: "def", minus: "spa" },
  Jolly: { plus: "spe", minus: "spa" },
  Lax: { plus: "def", minus: "spd" },
  Lonely: { plus: "atk", minus: "def" },
  Mild: { plus: "spa", minus: "def" },
  Modest: { plus: "spa", minus: "atk" },
  Naive: { plus: "spe", minus: "spd" },
  Naughty: { plus: "atk", minus: "spd" },
  Quiet: { plus: "spa", minus: "spe" },
  Quirky: {},
  Rash: { plus: "spa", minus: "spd" },
  Relaxed: { plus: "def", minus: "spe" },
  Sassy: { plus: "spd", minus: "spe" },
  Serious: {},
  Timid: { plus: "spe", minus: "atk" },
};

const STAT_FORMULAS = `# Pokemon Stat Calculation Formulas

## HP Formula
HP = floor(((2 * Base + IV + floor(EV/4)) * Level) / 100) + Level + 10

Exception: Shedinja always has 1 HP.

## Other Stats Formula
Stat = floor((floor(((2 * Base + IV + floor(EV/4)) * Level) / 100) + 5) * NatureMultiplier)

Where NatureMultiplier is:
- 1.1 if the nature boosts this stat
- 0.9 if the nature lowers this stat
- 1.0 otherwise

## Speed Tiers
At level 100 with 31 IVs:
- 0 EVs, -Speed Nature: floor((floor(((2*Base + 31) * 100/100) + 5) * 0.9))
- 0 EVs, Neutral Nature: floor(((2*Base + 31) * 100/100) + 5)
- 252 EVs, +Speed Nature: floor((floor(((2*Base + 31 + 63) * 100/100) + 5) * 1.1))

## Common EV Benchmarks
- 252 EVs = 63 stat points at level 100
- 4 EVs = 1 stat point at level 100
- Max total EVs: 510 (typically 252/252/4 or custom spreads)
`;

const FORMATS_LIST = [
  { id: "gen9ou", name: "OU", generation: 9, gameType: "singles" },
  { id: "gen9uu", name: "UU", generation: 9, gameType: "singles" },
  { id: "gen9ru", name: "RU", generation: 9, gameType: "singles" },
  { id: "gen9nu", name: "NU", generation: 9, gameType: "singles" },
  { id: "gen9uber", name: "Ubers", generation: 9, gameType: "singles" },
  { id: "gen9vgc2024", name: "VGC 2024", generation: 9, gameType: "doubles" },
  { id: "gen9monotype", name: "Monotype", generation: 9, gameType: "singles" },
  {
    id: "gen9nationaldex",
    name: "National Dex",
    generation: 9,
    gameType: "singles",
  },
];

export function registerResources(server: McpServer) {
  server.resource(
    "type-chart",
    "pokemon://type-chart",
    async () => ({
      contents: [
        {
          uri: "pokemon://type-chart",
          text: JSON.stringify(TYPE_CHART, null, 2),
          mimeType: "application/json",
        },
      ],
    })
  );

  server.resource(
    "formats-list",
    "pokemon://formats",
    async () => ({
      contents: [
        {
          uri: "pokemon://formats",
          text: JSON.stringify(FORMATS_LIST, null, 2),
          mimeType: "application/json",
        },
      ],
    })
  );

  server.resource(
    "natures",
    "pokemon://natures",
    async () => ({
      contents: [
        {
          uri: "pokemon://natures",
          text: JSON.stringify(NATURES_DATA, null, 2),
          mimeType: "application/json",
        },
      ],
    })
  );

  server.resource(
    "stat-formulas",
    "pokemon://stat-formulas",
    async () => ({
      contents: [
        {
          uri: "pokemon://stat-formulas",
          text: STAT_FORMULAS,
          mimeType: "text/markdown",
        },
      ],
    })
  );

  // Dynamic resource template for format viability
  server.resource(
    "viability",
    new ResourceTemplate("pokemon://viability/{formatId}", {
      list: async () => ({
        resources: FORMATS_LIST.map((f) => ({
          uri: `pokemon://viability/${f.id}`,
          name: `${f.name} Viability Rankings`,
          description: `Top Pokemon by usage in ${f.name}`,
          mimeType: "application/json",
        })),
      }),
    }),
    async (uri, { formatId }) => {
      try {
        const data = await apiGet(
          `/formats/${encodeURIComponent(formatId as string)}/usage`,
          { limit: "50" }
        );
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({
                error: `No viability data for format "${formatId}"`,
              }),
              mimeType: "application/json",
            },
          ],
        };
      }
    }
  );
}
