import { packOneSlot, packTeam, teamToShowdownPaste } from "@nasty-plot/battle-engine"
import type { TeamSlotData } from "@nasty-plot/core"

const makeSlot = (overrides: Partial<TeamSlotData> = {}): TeamSlotData => ({
  position: 1,
  pokemonId: "garchomp",
  ability: "Rough Skin",
  item: "Life Orb",
  nature: "Jolly",
  level: 100,
  teraType: "Ground",
  moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
  evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
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
      const slot = makeSlot({ level: 100 })
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
      expect(packed.split("]")).toHaveLength(6)
    })
  })

  describe("teamToShowdownPaste", () => {
    it("generates valid Showdown paste format", () => {
      const team = [makeSlot()]
      const paste = teamToShowdownPaste(team)

      expect(paste).toContain("Garchomp @ Life Orb")
      expect(paste).toContain("Ability: Rough Skin")
      expect(paste).toContain("Tera Type: Ground")
      expect(paste).toContain("Jolly Nature")
      expect(paste).toContain("- Earthquake")
      expect(paste).toContain("- Dragon Claw")
      expect(paste).toContain("EVs: 252 Atk / 4 SpD / 252 Spe")
    })

    it("includes nickname format", () => {
      const team = [makeSlot({ nickname: "Chompy" })]
      const paste = teamToShowdownPaste(team)
      expect(paste).toContain("Chompy (Garchomp)")
    })

    it("omits level when 100", () => {
      const team = [makeSlot({ level: 100 })]
      const paste = teamToShowdownPaste(team)
      expect(paste).not.toContain("Level:")
    })

    it("includes level when not 100", () => {
      const team = [makeSlot({ level: 50 })]
      const paste = teamToShowdownPaste(team)
      expect(paste).toContain("Level: 50")
    })

    it("includes custom IVs", () => {
      const team = [
        makeSlot({
          ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
        }),
      ]
      const paste = teamToShowdownPaste(team)
      expect(paste).toContain("IVs: 0 Atk")
    })

    it("separates multiple Pokemon with double newline", () => {
      const team = [
        makeSlot({ pokemonId: "garchomp", position: 1 }),
        makeSlot({ pokemonId: "heatran", position: 2 }),
      ]
      const paste = teamToShowdownPaste(team)
      expect(paste).toContain("\n\n")
    })

    it("omits item line when no item is set", () => {
      const team = [makeSlot({ item: "" })]
      const paste = teamToShowdownPaste(team)
      // Should just have the Pokemon name without " @ "
      expect(paste).not.toContain("@")
      // First line should just be the species name
      const firstLine = paste.split("\n")[0]
      expect(firstLine).toBe("Garchomp")
    })

    it("shows display name without nickname when nickname is empty", () => {
      const team = [makeSlot({ nickname: undefined, item: "Leftovers" })]
      const paste = teamToShowdownPaste(team)
      expect(paste).toContain("Garchomp @ Leftovers")
      expect(paste).not.toContain("(")
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
