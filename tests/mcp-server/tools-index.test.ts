import { asMock } from "../test-utils"

vi.mock("#mcp-server/tools/data-query", () => ({
  registerDataQueryTools: vi.fn(),
}))
vi.mock("#mcp-server/tools/analysis", () => ({
  registerAnalysisTools: vi.fn(),
}))
vi.mock("#mcp-server/tools/team-crud", () => ({
  registerTeamCrudTools: vi.fn(),
}))
vi.mock("#mcp-server/tools/meta-recs", () => ({
  registerMetaRecsTools: vi.fn(),
}))

import { registerTools } from "#mcp-server/tools/index"
import { registerDataQueryTools } from "#mcp-server/tools/data-query"
import { registerAnalysisTools } from "#mcp-server/tools/analysis"
import { registerTeamCrudTools } from "#mcp-server/tools/team-crud"
import { registerMetaRecsTools } from "#mcp-server/tools/meta-recs"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerTools", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("calls all four register functions with the server", () => {
    const server = {} as never

    registerTools(server)

    expect(registerDataQueryTools).toHaveBeenCalledOnce()
    expect(registerDataQueryTools).toHaveBeenCalledWith(server)

    expect(registerAnalysisTools).toHaveBeenCalledOnce()
    expect(registerAnalysisTools).toHaveBeenCalledWith(server)

    expect(registerTeamCrudTools).toHaveBeenCalledOnce()
    expect(registerTeamCrudTools).toHaveBeenCalledWith(server)

    expect(registerMetaRecsTools).toHaveBeenCalledOnce()
    expect(registerMetaRecsTools).toHaveBeenCalledWith(server)
  })

  it("passes the same server instance to all functions", () => {
    const server = { id: "test-server" } as never

    registerTools(server)

    const calls = [
      asMock(registerDataQueryTools).mock.calls[0][0],
      asMock(registerAnalysisTools).mock.calls[0][0],
      asMock(registerTeamCrudTools).mock.calls[0][0],
      asMock(registerMetaRecsTools).mock.calls[0][0],
    ]

    for (const arg of calls) {
      expect(arg).toBe(server)
    }
  })
})
