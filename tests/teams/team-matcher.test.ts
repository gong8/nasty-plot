import {
  fingerprintFromPaste,
  fingerprintFromSlots,
  fingerprintFromExtracted,
  compareFingerprints,
  findMatchingTeams,
} from "@nasty-plot/teams"
import type { TeamSlotData, StatsTable } from "@nasty-plot/core"

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@nasty-plot/db"

const mockFindMany = prisma.team.findMany as ReturnType<typeof vi.fn>

function makeSlot(pokemonId: string, moves: string[]): TeamSlotData {
  const evs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const ivs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
  return {
    position: 1,
    pokemonId,
    ability: "Protosynthesis",
    item: "Leftovers",
    nature: "Adamant",
    level: 100,
    moves: [moves[0] || "", moves[1], moves[2], moves[3]] as TeamSlotData["moves"],
    evs,
    ivs,
  }
}

describe("team-matcher", () => {
  describe("fingerprintFromPaste", () => {
    it("extracts species and moves from paste", () => {
      const paste = `Garchomp @ Choice Scarf
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Outrage
- Stone Edge
- Swords Dance

Heatran @ Leftovers
Ability: Flash Fire
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Lava Plume
- Earth Power
- Stealth Rock
- Toxic`

      const fp = fingerprintFromPaste(paste)
      expect(fp.speciesIds).toEqual(["garchomp", "heatran"])
      expect(fp.movesBySpecies["garchomp"]).toEqual([
        "earthquake",
        "outrage",
        "stone edge",
        "swords dance",
      ])
      expect(fp.movesBySpecies["heatran"]).toEqual([
        "earth power",
        "lava plume",
        "stealth rock",
        "toxic",
      ])
    })
  })

  describe("fingerprintFromSlots", () => {
    it("builds fingerprint from slot data", () => {
      const slots = [
        makeSlot("garchomp", ["Earthquake", "Outrage", "Stone Edge", "Swords Dance"]),
        makeSlot("heatran", ["Lava Plume", "Earth Power", "Stealth Rock", "Toxic"]),
      ]
      const fp = fingerprintFromSlots(slots)
      expect(fp.speciesIds).toEqual(["garchomp", "heatran"])
      expect(fp.movesBySpecies["garchomp"]).toContain("earthquake")
    })
  })

  describe("fingerprintFromExtracted", () => {
    it("builds fingerprint from extracted data", () => {
      const pokemon = [
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
        { speciesId: "heatran", moves: ["Lava Plume"] },
      ]
      const fp = fingerprintFromExtracted(pokemon)
      expect(fp.speciesIds).toEqual(["garchomp", "heatran"])
      expect(fp.movesBySpecies["garchomp"]).toEqual(["earthquake", "outrage"])
    })
  })

  describe("compareFingerprints", () => {
    it("returns exact for identical fingerprints", () => {
      const fp1 = fingerprintFromExtracted([
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
        { speciesId: "heatran", moves: ["Lava Plume", "Toxic"] },
      ])
      const fp2 = fingerprintFromExtracted([
        { speciesId: "heatran", moves: ["Toxic", "Lava Plume"] },
        { speciesId: "garchomp", moves: ["Outrage", "Earthquake"] },
      ])
      expect(compareFingerprints(fp1, fp2)).toBe("exact")
    })

    it("returns pokemon-match when species match but moves differ", () => {
      const fp1 = fingerprintFromExtracted([
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
      ])
      const fp2 = fingerprintFromExtracted([
        { speciesId: "garchomp", moves: ["Earthquake", "Swords Dance"] },
      ])
      expect(compareFingerprints(fp1, fp2)).toBe("pokemon-match")
    })

    it("returns none when species differ", () => {
      const fp1 = fingerprintFromExtracted([{ speciesId: "garchomp", moves: ["Earthquake"] }])
      const fp2 = fingerprintFromExtracted([{ speciesId: "heatran", moves: ["Lava Plume"] }])
      expect(compareFingerprints(fp1, fp2)).toBe("none")
    })

    it("returns none when team sizes differ", () => {
      const fp1 = fingerprintFromExtracted([
        { speciesId: "garchomp", moves: ["Earthquake"] },
        { speciesId: "heatran", moves: ["Lava Plume"] },
      ])
      const fp2 = fingerprintFromExtracted([{ speciesId: "garchomp", moves: ["Earthquake"] }])
      expect(compareFingerprints(fp1, fp2)).toBe("none")
    })

    it("compares as sets not arrays (order independent)", () => {
      const fp1 = fingerprintFromExtracted([
        { speciesId: "garchomp", moves: [] },
        { speciesId: "heatran", moves: [] },
      ])
      const fp2 = fingerprintFromExtracted([
        { speciesId: "heatran", moves: [] },
        { speciesId: "garchomp", moves: [] },
      ])
      expect(compareFingerprints(fp1, fp2)).toBe("exact")
    })
  })

  describe("findMatchingTeams", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("returns matches sorted by confidence", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "team-1",
          name: "Exact Team",
          slots: [
            {
              pokemonId: "garchomp",
              move1: "Earthquake",
              move2: "Outrage",
              move3: null,
              move4: null,
            },
            { pokemonId: "heatran", move1: "Lava Plume", move2: null, move3: null, move4: null },
          ],
        },
        {
          id: "team-2",
          name: "Partial Team",
          slots: [
            {
              pokemonId: "garchomp",
              move1: "Earthquake",
              move2: "Stone Edge",
              move3: null,
              move4: null,
            },
            { pokemonId: "heatran", move1: "Magma Storm", move2: null, move3: null, move4: null },
          ],
        },
      ])

      const extracted = [
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
        { speciesId: "heatran", moves: ["Lava Plume"] },
      ]

      const results = await findMatchingTeams(extracted)

      expect(results).toHaveLength(2)
      expect(results[0].teamId).toBe("team-1")
      expect(results[0].confidence).toBeGreaterThan(results[1].confidence)
    })

    it("skips teams with no slots", async () => {
      mockFindMany.mockResolvedValue([{ id: "empty-team", name: "Empty", slots: [] }])

      const results = await findMatchingTeams([{ speciesId: "garchomp", moves: ["Earthquake"] }])

      expect(results).toHaveLength(0)
    })

    it("skips teams with different species", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "team-1",
          name: "Different Team",
          slots: [
            { pokemonId: "tyranitar", move1: "Stone Edge", move2: null, move3: null, move4: null },
          ],
        },
      ])

      const results = await findMatchingTeams([{ speciesId: "garchomp", moves: ["Earthquake"] }])

      expect(results).toHaveLength(0)
    })

    it("skips teams with different team sizes", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "team-1",
          name: "Bigger Team",
          slots: [
            { pokemonId: "garchomp", move1: "Earthquake", move2: null, move3: null, move4: null },
            { pokemonId: "heatran", move1: "Lava Plume", move2: null, move3: null, move4: null },
          ],
        },
      ])

      const results = await findMatchingTeams([{ speciesId: "garchomp", moves: ["Earthquake"] }])

      expect(results).toHaveLength(0)
    })

    it("gives 100% confidence when all revealed moves are subset of team moves", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "team-1",
          name: "Full Team",
          slots: [
            {
              pokemonId: "garchomp",
              move1: "Earthquake",
              move2: "Outrage",
              move3: "Stone Edge",
              move4: "Swords Dance",
            },
          ],
        },
      ])

      const results = await findMatchingTeams([
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
      ])

      expect(results).toHaveLength(1)
      expect(results[0].confidence).toBe(100)
      expect(results[0].matchLevel).toBe("exact")
    })

    it("gives 60% base confidence when species match but moves don't", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "team-1",
          name: "Different Moves",
          slots: [
            {
              pokemonId: "garchomp",
              move1: "Stone Edge",
              move2: "Fire Fang",
              move3: null,
              move4: null,
            },
          ],
        },
      ])

      const results = await findMatchingTeams([
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
      ])

      expect(results).toHaveLength(1)
      expect(results[0].confidence).toBe(60)
      expect(results[0].matchLevel).toBe("pokemon-match")
    })

    it("filters by format when provided", async () => {
      mockFindMany.mockResolvedValue([])

      await findMatchingTeams([{ speciesId: "garchomp", moves: [] }], "gen9ou")

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false, formatId: "gen9ou" },
        }),
      )
    })

    it("gives intermediate confidence for partial move matches", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "team-1",
          name: "Partial Moves",
          slots: [
            {
              pokemonId: "garchomp",
              move1: "Earthquake",
              move2: "Fire Fang",
              move3: null,
              move4: null,
            },
          ],
        },
      ])

      // 1 of 2 moves match → moveScore = 0.5 → confidence = 60 + 0.5 * 40 = 80
      const results = await findMatchingTeams([
        { speciesId: "garchomp", moves: ["Earthquake", "Outrage"] },
      ])

      expect(results).toHaveLength(1)
      expect(results[0].confidence).toBe(80)
    })
  })
})
