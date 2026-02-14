import { apiGet, apiPost, apiPut, apiDelete } from "#mcp-server/api-client.service"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("api-client", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // -------------------------------------------------------------------------
  // apiGet
  // -------------------------------------------------------------------------

  describe("apiGet", () => {
    it("fetches with GET method and correct URL", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1 }))

      const result = await apiGet("/pokemon/pikachu")

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/pokemon/pikachu")
      expect(init.method).toBe("GET")
      expect(result).toEqual({ id: 1 })
    })

    it("appends query params to URL", async () => {
      mockFetch.mockResolvedValue(jsonResponse([]))

      await apiGet("/pokemon", { search: "char", limit: "5" })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("search=char")
      expect(url).toContain("limit=5")
    })

    it("works without query params", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }))

      await apiGet("/teams")

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/teams")
    })

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: "Not found" }, 404))

      await expect(apiGet("/pokemon/fakemon")).rejects.toThrow("API error 404")
    })

    it("handles path with leading slash", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}))
      await apiGet("/teams")
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/teams")
      expect(url).not.toContain("//teams")
    })

    it("handles path without leading slash", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}))
      await apiGet("teams")
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/teams")
    })
  })

  // -------------------------------------------------------------------------
  // apiPost
  // -------------------------------------------------------------------------

  describe("apiPost", () => {
    it("sends POST with JSON body", async () => {
      const body = { name: "My Team", formatId: "gen9ou" }
      mockFetch.mockResolvedValue(jsonResponse({ id: "uuid-1" }))

      const result = await apiPost("/teams", body)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/teams")
      expect(init.method).toBe("POST")
      expect(init.headers).toEqual({ "Content-Type": "application/json" })
      expect(JSON.parse(init.body)).toEqual(body)
      expect(result).toEqual({ id: "uuid-1" })
    })

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: "Bad request" }, 400))

      await expect(apiPost("/teams", {})).rejects.toThrow("API error 400")
    })
  })

  // -------------------------------------------------------------------------
  // apiPut
  // -------------------------------------------------------------------------

  describe("apiPut", () => {
    it("sends PUT with JSON body", async () => {
      const body = { ability: "Protosynthesis" }
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

      await apiPut("/teams/t1/slots/1", body)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/teams/t1/slots/1")
      expect(init.method).toBe("PUT")
      expect(JSON.parse(init.body)).toEqual(body)
    })

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue(jsonResponse("Server error", 500))
      await expect(apiPut("/slots/1", {})).rejects.toThrow("API error 500")
    })
  })

  // -------------------------------------------------------------------------
  // apiDelete
  // -------------------------------------------------------------------------

  describe("apiDelete", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ deleted: true }))

      const result = await apiDelete("/teams/t1/slots/3")

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/api/teams/t1/slots/3")
      expect(init.method).toBe("DELETE")
      expect(result).toEqual({ deleted: true })
    })

    it("does not send a body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}))
      await apiDelete("/teams/t1")
      const [, init] = mockFetch.mock.calls[0]
      expect(init.body).toBeUndefined()
      expect(init.headers).toBeUndefined()
    })

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue(jsonResponse("Not found", 404))
      await expect(apiDelete("/teams/fake")).rejects.toThrow("API error 404")
    })
  })
})
