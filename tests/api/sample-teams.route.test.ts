import { vi } from "vitest"
import { asMock } from "../test-utils"

vi.mock("@nasty-plot/teams", () => ({
  listSampleTeams: vi.fn(),
  createSampleTeam: vi.fn(),
  getSampleTeam: vi.fn(),
  deleteSampleTeam: vi.fn(),
  importSampleTeamsFromPastes: vi.fn(),
}))

import {
  listSampleTeams,
  createSampleTeam,
  getSampleTeam,
  deleteSampleTeam,
  importSampleTeamsFromPastes,
} from "@nasty-plot/teams"
import { GET, POST } from "../../apps/web/src/app/api/sample-teams/route"
import {
  GET as GET_BY_ID,
  DELETE as DELETE_BY_ID,
} from "../../apps/web/src/app/api/sample-teams/[sampleTeamId]/route"
import { POST as POST_IMPORT } from "../../apps/web/src/app/api/sample-teams/import/route"

const mockSampleTeam = {
  id: "st-1",
  name: "OU Rain",
  formatId: "gen9ou",
  archetype: "Rain",
  source: "Smogon",
  sourceUrl: null,
  paste: "Pelipper @ Damp Rock\nAbility: Drizzle",
  pokemonIds: "pelipper,barraskewda",
  isActive: true,
  createdAt: new Date().toISOString(),
}

describe("GET /api/sample-teams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns sample teams list", async () => {
    asMock(listSampleTeams).mockResolvedValue({
      teams: [mockSampleTeam],
      total: 1,
    })

    const req = new Request("http://localhost:3000/api/sample-teams")
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual([mockSampleTeam])
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(20)
    expect(listSampleTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        formatId: undefined,
        archetype: undefined,
        search: undefined,
      }),
    )
  })

  it("filters by formatId", async () => {
    asMock(listSampleTeams).mockResolvedValue({
      teams: [mockSampleTeam],
      total: 1,
    })

    const req = new Request("http://localhost:3000/api/sample-teams?formatId=gen9ou")
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(listSampleTeams).toHaveBeenCalledWith(expect.objectContaining({ formatId: "gen9ou" }))
  })

  it("filters by archetype", async () => {
    asMock(listSampleTeams).mockResolvedValue({
      teams: [mockSampleTeam],
      total: 1,
    })

    const req = new Request("http://localhost:3000/api/sample-teams?archetype=Rain")
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(listSampleTeams).toHaveBeenCalledWith(expect.objectContaining({ archetype: "Rain" }))
  })

  it("filters by search query", async () => {
    asMock(listSampleTeams).mockResolvedValue({ teams: [], total: 0 })

    const req = new Request("http://localhost:3000/api/sample-teams?search=pelipper")
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(listSampleTeams).toHaveBeenCalledWith(expect.objectContaining({ search: "pelipper" }))
  })
})

describe("POST /api/sample-teams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates sample team with valid data", async () => {
    asMock(createSampleTeam).mockResolvedValue(mockSampleTeam)

    const req = new Request("http://localhost:3000/api/sample-teams", {
      method: "POST",
      body: JSON.stringify({
        name: "OU Rain",
        formatId: "gen9ou",
        paste: "Pelipper @ Damp Rock\nAbility: Drizzle",
        archetype: "Rain",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe("st-1")
    expect(createSampleTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "OU Rain",
        formatId: "gen9ou",
        paste: "Pelipper @ Damp Rock\nAbility: Drizzle",
        archetype: "Rain",
      }),
    )
  })

  it("returns 400 when name is missing", async () => {
    const req = new Request("http://localhost:3000/api/sample-teams", {
      method: "POST",
      body: JSON.stringify({ formatId: "gen9ou", paste: "some paste" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 when formatId is missing", async () => {
    const req = new Request("http://localhost:3000/api/sample-teams", {
      method: "POST",
      body: JSON.stringify({ name: "Test", paste: "some paste" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it("returns 400 when paste is missing", async () => {
    const req = new Request("http://localhost:3000/api/sample-teams", {
      method: "POST",
      body: JSON.stringify({ name: "Test", formatId: "gen9ou" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })
})

describe("GET /api/sample-teams/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns sample team by id", async () => {
    asMock(getSampleTeam).mockResolvedValue(mockSampleTeam)

    const req = new Request("http://localhost:3000/api/sample-teams/st-1")
    const response = await GET_BY_ID(req, {
      params: Promise.resolve({ sampleTeamId: "st-1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe("st-1")
    expect(data.name).toBe("OU Rain")
    expect(getSampleTeam).toHaveBeenCalledWith("st-1")
  })

  it("returns 404 when not found", async () => {
    asMock(getSampleTeam).mockResolvedValue(null)

    const req = new Request("http://localhost:3000/api/sample-teams/nonexistent")
    const response = await GET_BY_ID(req, {
      params: Promise.resolve({ sampleTeamId: "nonexistent" }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain("not found")
  })
})

describe("DELETE /api/sample-teams/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes sample team and returns success", async () => {
    asMock(deleteSampleTeam).mockResolvedValue(undefined)

    const req = new Request("http://localhost:3000/api/sample-teams/st-1", {
      method: "DELETE",
    })
    const response = await DELETE_BY_ID(req, {
      params: Promise.resolve({ sampleTeamId: "st-1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(deleteSampleTeam).toHaveBeenCalledWith("st-1")
  })

  it("returns 500 when delete fails", async () => {
    asMock(deleteSampleTeam).mockRejectedValue(new Error("Record not found"))

    const req = new Request("http://localhost:3000/api/sample-teams/nonexistent", {
      method: "DELETE",
    })
    const response = await DELETE_BY_ID(req, {
      params: Promise.resolve({ sampleTeamId: "nonexistent" }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })
})

describe("POST /api/sample-teams/import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("successfully imports teams from pastes array", async () => {
    const mockImportedTeams = [
      { ...mockSampleTeam, id: "st-import-1", name: "Imported Team 1" },
      { ...mockSampleTeam, id: "st-import-2", name: "Imported Team 2" },
    ]

    asMock(importSampleTeamsFromPastes).mockResolvedValue(mockImportedTeams)

    const pastes = [
      {
        name: "OU Rain",
        paste: "Pelipper @ Damp Rock\nAbility: Drizzle\nEVs: 248 HP / 252 SpA / 8 Spe",
      },
      {
        name: "Swift Swim",
        paste: "Barraskewda @ Choice Band\nAbility: Swift Swim\nEVs: 252 Atk / 4 SpD / 252 Spe",
      },
    ]

    const req = new Request("http://localhost:3000/api/sample-teams/import", {
      method: "POST",
      body: JSON.stringify({
        pastes,
        formatId: "gen9ou",
        source: "Smogon",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST_IMPORT(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual(mockImportedTeams)
    expect(importSampleTeamsFromPastes).toHaveBeenCalledWith(pastes, "gen9ou", "Smogon")
  })

  it("returns 400 when pastes is missing", async () => {
    const req = new Request("http://localhost:3000/api/sample-teams/import", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST_IMPORT(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 when formatId is missing", async () => {
    const req = new Request("http://localhost:3000/api/sample-teams/import", {
      method: "POST",
      body: JSON.stringify({
        pastes: [{ name: "Test", paste: "some paste" }],
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST_IMPORT(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 when pastes is not an array", async () => {
    const req = new Request("http://localhost:3000/api/sample-teams/import", {
      method: "POST",
      body: JSON.stringify({
        pastes: "not an array",
        formatId: "gen9ou",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST_IMPORT(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })
})
