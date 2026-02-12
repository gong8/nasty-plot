import {
  parseReplayUrl,
  parseProtocolLog,
  importFromRawLog,
  importFromReplayUrl,
  fetchShowdownReplay,
} from "@nasty-plot/battle-engine"

describe("replay-import", () => {
  describe("parseReplayUrl", () => {
    it("extracts replay ID from full URL", () => {
      expect(parseReplayUrl("https://replay.pokemonshowdown.com/gen9ou-12345")).toBe("gen9ou-12345")
    })

    it("extracts replay ID from URL without protocol", () => {
      expect(parseReplayUrl("replay.pokemonshowdown.com/gen9ou-12345")).toBe("gen9ou-12345")
    })

    it("handles URLs with http", () => {
      expect(parseReplayUrl("http://replay.pokemonshowdown.com/gen9ou-67890")).toBe("gen9ou-67890")
    })

    it("returns null for invalid URLs", () => {
      expect(parseReplayUrl("https://pokemonshowdown.com/gen9ou-12345")).toBeNull()
      expect(parseReplayUrl("not a url")).toBeNull()
      expect(parseReplayUrl("")).toBeNull()
    })
  })

  describe("parseProtocolLog", () => {
    const sampleLog = [
      "|player|p1|Alice|avatar1|1000",
      "|player|p2|Bob|avatar2|1200",
      "|teamsize|p1|6",
      "|teamsize|p2|6",
      "|gametype|singles",
      "|gen|9",
      "|tier|[Gen 9] OU",
      "|poke|p1|Garchomp, L100, M|",
      "|poke|p1|Heatran, L100, M|",
      "|poke|p2|Great Tusk, L100|",
      "|poke|p2|Iron Valiant, L100|",
      "|start",
      "|switch|p1a: Garchomp|Garchomp, L100, M|319/319",
      "|switch|p2a: Great Tusk|Great Tusk, L100|398/398",
      "|turn|1",
      "|move|p1a: Garchomp|Earthquake|p2a: Great Tusk",
      "|-damage|p2a: Great Tusk|200/398",
      "|move|p2a: Great Tusk|Headlong Rush|p1a: Garchomp",
      "|-damage|p1a: Garchomp|150/319",
      "|turn|2",
      "|switch|p1a: Heatran|Heatran, L100, M|300/300",
      "|-ability|p2a: Great Tusk|Protosynthesis",
      "|move|p2a: Great Tusk|Close Combat|p1a: Heatran",
      "|-damage|p1a: Heatran|0 fnt",
      "|faint|p1a: Heatran",
      "|switch|p1a: Garchomp|Garchomp, L100, M|150/319",
      "|turn|3",
      "|move|p1a: Garchomp|Earthquake|p2a: Great Tusk",
      "|-damage|p2a: Great Tusk|0 fnt",
      "|faint|p2a: Great Tusk",
      "|switch|p2a: Iron Valiant|Iron Valiant, L100|299/299",
      "|-item|p2a: Iron Valiant|Booster Energy",
      "|-terastallize|p2a: Iron Valiant|Fairy",
      "|turn|4",
      "|move|p2a: Iron Valiant|Moonblast|p1a: Garchomp",
      "|-damage|p1a: Garchomp|0 fnt",
      "|faint|p1a: Garchomp",
      "|win|Bob",
    ].join("\n")

    it("extracts player names", () => {
      const result = parseProtocolLog(sampleLog)
      expect(result.playerNames).toEqual(["Alice", "Bob"])
    })

    it("extracts format info", () => {
      const result = parseProtocolLog(sampleLog)
      expect(result.formatId).toBe("gen9ou")
      expect(result.gameType).toBe("singles")
    })

    it("extracts winner", () => {
      const result = parseProtocolLog(sampleLog)
      expect(result.winnerId).toBe("p2")
    })

    it("extracts turn count", () => {
      const result = parseProtocolLog(sampleLog)
      expect(result.turnCount).toBe(4)
    })

    it("extracts team 1 pokemon", () => {
      const result = parseProtocolLog(sampleLog)
      expect(result.team1.pokemon).toHaveLength(2)
      expect(result.team1.pokemon[0].species).toBe("Garchomp")
      expect(result.team1.pokemon[0].speciesId).toBe("garchomp")
      expect(result.team1.pokemon[1].species).toBe("Heatran")
    })

    it("extracts team 2 pokemon", () => {
      const result = parseProtocolLog(sampleLog)
      expect(result.team2.pokemon).toHaveLength(2)
      expect(result.team2.pokemon[0].species).toBe("Great Tusk")
      expect(result.team2.pokemon[0].speciesId).toBe("greattusk")
    })

    it("extracts moves from protocol", () => {
      const result = parseProtocolLog(sampleLog)
      const garchomp = result.team1.pokemon.find((p) => p.speciesId === "garchomp")
      expect(garchomp?.moves).toContain("Earthquake")

      const greatTusk = result.team2.pokemon.find((p) => p.speciesId === "greattusk")
      expect(greatTusk?.moves).toContain("Headlong Rush")
      expect(greatTusk?.moves).toContain("Close Combat")
    })

    it("extracts abilities", () => {
      const result = parseProtocolLog(sampleLog)
      const greatTusk = result.team2.pokemon.find((p) => p.speciesId === "greattusk")
      expect(greatTusk?.ability).toBe("Protosynthesis")
    })

    it("extracts items", () => {
      const result = parseProtocolLog(sampleLog)
      const ironValiant = result.team2.pokemon.find((p) => p.speciesId === "ironvaliant")
      expect(ironValiant?.item).toBe("Booster Energy")
    })

    it("extracts tera types", () => {
      const result = parseProtocolLog(sampleLog)
      const ironValiant = result.team2.pokemon.find((p) => p.speciesId === "ironvaliant")
      expect(ironValiant?.teraType).toBe("Fairy")
    })

    it("handles tie result", () => {
      const tieLog = ["|player|p1|Alice|", "|player|p2|Bob|", "|tie"].join("\n")
      const result = parseProtocolLog(tieLog)
      expect(result.winnerId).toBe("draw")
    })

    it("handles nicknames via switch lines", () => {
      const nickLog = [
        "|player|p1|Alice|",
        "|player|p2|Bob|",
        "|switch|p1a: Chomper|Garchomp, L100, M|319/319",
        "|turn|1",
        "|move|p1a: Chomper|Earthquake|p2a: Bob",
      ].join("\n")
      const result = parseProtocolLog(nickLog)
      const garchomp = result.team1.pokemon.find((p) => p.speciesId === "garchomp")
      expect(garchomp?.nickname).toBe("Chomper")
      expect(garchomp?.moves).toContain("Earthquake")
    })

    it("handles doubles gametype", () => {
      const doublesLog = ["|gametype|doubles", "|tier|[Gen 9] Doubles OU"].join("\n")
      const result = parseProtocolLog(doublesLog)
      expect(result.gameType).toBe("doubles")
    })

    it("does not duplicate moves", () => {
      const repeatLog = [
        "|player|p1|Alice|",
        "|switch|p1a: Garchomp|Garchomp, L100|319/319",
        "|turn|1",
        "|move|p1a: Garchomp|Earthquake|",
        "|turn|2",
        "|move|p1a: Garchomp|Earthquake|",
        "|turn|3",
        "|move|p1a: Garchomp|Swords Dance|",
      ].join("\n")
      const result = parseProtocolLog(repeatLog)
      const garchomp = result.team1.pokemon.find((p) => p.speciesId === "garchomp")
      expect(garchomp?.moves).toEqual(["Earthquake", "Swords Dance"])
    })
  })

  describe("parseProtocolLog - p1 winner", () => {
    it("sets winnerId to p1 when p1 wins", () => {
      const log = ["|player|p1|Alice|", "|player|p2|Bob|", "|win|Alice"].join("\n")
      const result = parseProtocolLog(log)
      expect(result.winnerId).toBe("p1")
    })
  })

  describe("parseProtocolLog - enditem", () => {
    it("extracts item from -enditem when item not already set", () => {
      const log = [
        "|player|p1|Alice|",
        "|player|p2|Bob|",
        "|switch|p1a: Garchomp|Garchomp, L100|319/319",
        "|-enditem|p1a: Garchomp|Focus Sash",
      ].join("\n")
      const result = parseProtocolLog(log)
      const garchomp = result.team1.pokemon.find((p) => p.speciesId === "garchomp")
      expect(garchomp?.item).toBe("Focus Sash")
    })

    it("does not overwrite existing item from -item with -enditem", () => {
      const log = [
        "|player|p1|Alice|",
        "|player|p2|Bob|",
        "|switch|p1a: Garchomp|Garchomp, L100|319/319",
        "|-item|p1a: Garchomp|Life Orb",
        "|-enditem|p1a: Garchomp|Life Orb",
      ].join("\n")
      const result = parseProtocolLog(log)
      const garchomp = result.team1.pokemon.find((p) => p.speciesId === "garchomp")
      // item should remain "Life Orb" from -item, enditem should not overwrite
      expect(garchomp?.item).toBe("Life Orb")
    })
  })

  describe("parseProtocolLog - drag and replace", () => {
    it("handles drag lines like switch", () => {
      const log = [
        "|player|p1|Alice|",
        "|player|p2|Bob|",
        "|drag|p1a: Garchomp|Garchomp, L100|319/319",
        "|turn|1",
        "|move|p1a: Garchomp|Earthquake|",
      ].join("\n")
      const result = parseProtocolLog(log)
      const garchomp = result.team1.pokemon.find((p) => p.speciesId === "garchomp")
      expect(garchomp).toBeDefined()
      expect(garchomp?.moves).toContain("Earthquake")
    })

    it("handles replace lines like switch", () => {
      const log = [
        "|player|p1|Alice|",
        "|player|p2|Bob|",
        "|replace|p1a: Zoroark|Zoroark, L100|255/255",
      ].join("\n")
      const result = parseProtocolLog(log)
      const zoroark = result.team1.pokemon.find((p) => p.speciesId === "zoroark")
      expect(zoroark).toBeDefined()
    })
  })

  describe("parseProtocolLog - tier without gen bracket", () => {
    it("handles tier format without [Gen X] prefix", () => {
      const log = ["|tier|randombattle"].join("\n")
      const result = parseProtocolLog(log)
      expect(result.formatId).toBe("randombattle")
    })
  })

  describe("importFromRawLog", () => {
    it("sets source to raw-log", () => {
      const result = importFromRawLog("|player|p1|Alice|\n|player|p2|Bob|\n|turn|1")
      expect(result.source).toBe("raw-log")
      expect(result.replayId).toBeNull()
    })

    it("defaults format to gen9ou when missing", () => {
      const result = importFromRawLog("|player|p1|Alice|\n|turn|1")
      expect(result.formatId).toBe("gen9ou")
    })
  })

  describe("importFromReplayUrl", () => {
    it("throws for invalid URL", async () => {
      await expect(importFromReplayUrl("not a valid url")).rejects.toThrow(
        "Invalid Showdown replay URL",
      )
    })

    it("fetches and parses a replay from valid URL", async () => {
      const mockReplayJson = {
        id: "gen9ou-12345",
        formatid: "gen9ou",
        players: ["Alice", "Bob"],
        log: [
          "|player|p1|OldAlice|",
          "|player|p2|OldBob|",
          "|tier|[Gen 9] OU",
          "|switch|p1a: Garchomp|Garchomp, L100|319/319",
          "|turn|1",
          "|win|OldAlice",
        ].join("\n"),
        uploadtime: 1700000000,
        rating: 1500,
      }

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockReplayJson),
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await importFromReplayUrl("https://replay.pokemonshowdown.com/gen9ou-12345")

      expect(result.source).toBe("replay-url")
      expect(result.replayId).toBe("gen9ou-12345")
      expect(result.formatId).toBe("gen9ou")
      expect(result.playerNames).toEqual(["Alice", "Bob"])
      expect(result.team1.playerName).toBe("Alice")
      expect(result.team2.playerName).toBe("Bob")
      expect(result.uploadTime).toBe(1700000000)
      expect(result.rating).toBe(1500)

      vi.unstubAllGlobals()
    })
  })

  describe("fetchShowdownReplay", () => {
    it("throws when fetch returns non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      })
      vi.stubGlobal("fetch", mockFetch)

      await expect(fetchShowdownReplay("nonexistent-12345")).rejects.toThrow(
        "Failed to fetch replay: 404 Not Found",
      )

      vi.unstubAllGlobals()
    })
  })
})
