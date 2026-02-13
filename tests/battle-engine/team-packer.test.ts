import { packOneSlot, packTeam } from "@nasty-plot/battle-engine"
import type { TeamSlotData, PokemonSpecies } from "@nasty-plot/core"
import { DEFAULT_IVS, DEFAULT_LEVEL, MAX_SINGLE_EV, TEAM_SIZE } from "@nasty-plot/core"

const minimalSpecies: Pick<
  PokemonSpecies,
  "id" | "name" | "num" | "types" | "baseStats" | "abilities" | "weightkg"
> = {
  id: "garchomp",
  name: "Garchomp",
  num: 445,
  types: ["Dragon", "Ground"],
  baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
  abilities: { "0": "Sand Veil", H: "Rough Skin" },
  weightkg: 95,
}

const makeSlot = (overrides: Partial<TeamSlotData> = {}): TeamSlotData => ({
  position: 1,
  pokemonId: "garchomp",
  species: minimalSpecies as PokemonSpecies,
  ability: "Rough Skin",
  item: "Life Orb",
  nature: "Jolly",
  level: DEFAULT_LEVEL,
  teraType: "Ground",
  moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
  evs: { hp: 0, atk: MAX_SINGLE_EV, def: 0, spa: 0, spd: 4, spe: MAX_SINGLE_EV },
  ivs: DEFAULT_IVS,
  ...overrides,
})

describe("team-packer", () => {
  describe("packOneSlot", () => {
    it("packs a standard Pokemon correctly", () => {
      const slot = makeSlot()
      const packed = packOneSlot(slot)

      // Should contain species name
      expect(packed).toContain("Garchomp")
      // Should contain item
      expect(packed).toContain("Life Orb")
      // Should contain ability
      expect(packed).toContain("Rough Skin")
      // Should contain moves
      expect(packed).toContain("Earthquake")
      // Should contain nature
      expect(packed).toContain("Jolly")
    })

    it("includes nickname when different from species", () => {
      const slot = makeSlot({ nickname: "Chompy" })
      const packed = packOneSlot(slot)
      expect(packed).toContain("Chompy")
    })

    it("omits level when 100", () => {
      const slot = makeSlot({ level: DEFAULT_LEVEL })
      const packed = packOneSlot(slot)
      // Level field should be empty (between last two pipes for that section)
      const parts = packed.split("|")
      expect(parts[10]).toBe("") // Level field should be empty for 100
    })

    it("includes level when not 100", () => {
      const slot = makeSlot({ level: 50 })
      const packed = packOneSlot(slot)
      expect(packed).toContain("50")
    })

    it("handles Pokemon with custom IVs", () => {
      const slot = makeSlot({
        ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
      })
      const packed = packOneSlot(slot)
      // Should contain IV string with 0 for atk
      expect(packed).toContain("31,0,31,31,31,31")
    })

    it("omits IVs when all 31", () => {
      const slot = makeSlot()
      const packed = packOneSlot(slot)
      const parts = packed.split("|")
      // IVs field (index 8) should be empty
      expect(parts[8]).toBe("")
    })

    it("includes tera type", () => {
      const slot = makeSlot({ teraType: "Fire" })
      const packed = packOneSlot(slot)
      expect(packed).toContain("Fire")
    })
  })

  describe("packTeam", () => {
    it("packs multiple Pokemon separated by ]", () => {
      const team = [
        makeSlot({ pokemonId: "garchomp" }),
        makeSlot({ pokemonId: "heatran", position: 2 }),
      ]
      const packed = packTeam(team)
      expect(packed.split("]")).toHaveLength(2)
    })

    it("handles a full 6-Pokemon team", () => {
      const team = [
        makeSlot({ pokemonId: "garchomp", position: 1 }),
        makeSlot({ pokemonId: "heatran", position: 2 }),
        makeSlot({ pokemonId: "clefable", position: 3 }),
        makeSlot({ pokemonId: "slowbro", position: 4 }),
        makeSlot({ pokemonId: "weavile", position: 5 }),
        makeSlot({ pokemonId: "dragapult", position: 6 }),
      ]
      const packed = packTeam(team)
      expect(packed.split("]")).toHaveLength(TEAM_SIZE)
    })
  })

  describe("resolveSpeciesName fallback", () => {
    it("uses camelCase-to-Title-Case fallback for unknown Pokemon IDs", () => {
      const slot = makeSlot({ pokemonId: "fakeMonster" })
      const packed = packOneSlot(slot)
      // The fallback should produce "Fake Monster" from "fakeMonster"
      expect(packed).toContain("Fake Monster")
    })

    it("capitalizes first letter for simple unknown ID", () => {
      const slot = makeSlot({ pokemonId: "fakemon" })
      const packed = packOneSlot(slot)
      expect(packed).toContain("Fakemon")
    })
  })
})
