import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TYPE_CHART, NATURE_DATA } from "@nasty-plot/core"
import { FORMAT_DEFINITIONS } from "@nasty-plot/formats"
import { apiGet } from "../api-client.service.js"

// Strip the `name` field from NATURE_DATA for the MCP resource (simpler shape)
const NATURES_DATA = Object.fromEntries(
  Object.entries(NATURE_DATA).map(([name, data]) => {
    const { name: _, ...rest } = data
    return [name, rest]
  }),
)

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
`

const FORMATS_LIST = FORMAT_DEFINITIONS.filter((f) => f.isActive !== false).map((f) => ({
  id: f.id,
  name: f.name,
  generation: f.generation,
  gameType: f.gameType,
}))

function jsonResource(
  uri: string,
  data: unknown,
): {
  contents: [{ uri: string; text: string; mimeType: "application/json" }]
} {
  return {
    contents: [{ uri, text: JSON.stringify(data, null, 2), mimeType: "application/json" }],
  }
}

export function registerResources(server: McpServer): void {
  server.resource("type-chart", "pokemon://type-chart", async () =>
    jsonResource("pokemon://type-chart", TYPE_CHART),
  )

  server.resource("formats-list", "pokemon://formats", async () =>
    jsonResource("pokemon://formats", FORMATS_LIST),
  )

  server.resource("natures", "pokemon://natures", async () =>
    jsonResource("pokemon://natures", NATURES_DATA),
  )

  server.resource("stat-formulas", "pokemon://stat-formulas", async () => ({
    contents: [
      {
        uri: "pokemon://stat-formulas",
        text: STAT_FORMULAS,
        mimeType: "text/markdown" as const,
      },
    ],
  }))

  server.resource(
    "viability",
    new ResourceTemplate("pokemon://viability/{formatId}", {
      list: async () => ({
        resources: FORMATS_LIST.map((f) => ({
          uri: `pokemon://viability/${f.id}`,
          name: `${f.name} Viability Rankings`,
          description: `Top Pokemon by usage in ${f.name}`,
          mimeType: "application/json" as const,
        })),
      }),
    }),
    async (uri, { formatId }) => {
      try {
        const data = await apiGet(`/formats/${encodeURIComponent(formatId as string)}/usage`, {
          limit: "50",
        })
        return jsonResource(uri.href, data)
      } catch {
        return jsonResource(uri.href, {
          error: `No viability data for format "${formatId}"`,
        })
      }
    },
  )
}
