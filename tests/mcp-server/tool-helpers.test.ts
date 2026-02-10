import { toolSuccess, toolError, handleTool, buildParams } from "#mcp-server/tool-helpers"

// ---------------------------------------------------------------------------
// toolSuccess
// ---------------------------------------------------------------------------

describe("toolSuccess", () => {
  it("wraps a simple object as JSON text content", () => {
    const result = toolSuccess({ id: 1 })
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: 1 }, null, 2) }],
    })
  })

  it("wraps a string value", () => {
    const result = toolSuccess("hello")
    expect(result.content[0].text).toBe('"hello"')
  })

  it("wraps null", () => {
    const result = toolSuccess(null)
    expect(result.content[0].text).toBe("null")
  })

  it("wraps an array", () => {
    const result = toolSuccess([1, 2, 3])
    expect(result.content[0].text).toBe(JSON.stringify([1, 2, 3], null, 2))
  })

  it("wraps a nested object with pretty-print", () => {
    const data = { a: { b: { c: 1 } } }
    const result = toolSuccess(data)
    expect(result.content[0].text).toContain("\n")
    expect(JSON.parse(result.content[0].text)).toEqual(data)
  })

  it("does not include isError property", () => {
    const result = toolSuccess("ok")
    expect(result).not.toHaveProperty("isError")
  })
})

// ---------------------------------------------------------------------------
// toolError
// ---------------------------------------------------------------------------

describe("toolError", () => {
  it("wraps an error message with isError: true", () => {
    const result = toolError("Something went wrong")
    expect(result).toEqual({
      content: [{ type: "text", text: "Something went wrong" }],
      isError: true,
    })
  })

  it("sets isError to true", () => {
    const result = toolError("fail")
    expect(result.isError).toBe(true)
  })

  it("preserves the exact error message", () => {
    const msg = "API error 404: Not Found"
    const result = toolError(msg)
    expect(result.content[0].text).toBe(msg)
  })
})

// ---------------------------------------------------------------------------
// handleTool
// ---------------------------------------------------------------------------

describe("handleTool", () => {
  it("returns toolSuccess when the async fn resolves", async () => {
    const data = { pokemon: "pikachu" }
    const result = await handleTool(async () => data, "Should not appear")
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    })
    expect(result).not.toHaveProperty("isError")
  })

  it("returns toolError when the async fn throws an Error", async () => {
    const result = await handleTool(async () => {
      throw new Error("network timeout")
    }, "Request failed")
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe("Request failed (network timeout)")
  })

  it("returns toolError when the async fn throws a non-Error value", async () => {
    const result = await handleTool(async () => {
      throw "string error"
    }, "Request failed")
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe("Request failed (string error)")
  })

  it("returns toolError when the async fn throws a number", async () => {
    const result = await handleTool(async () => {
      throw 42
    }, "Unexpected")
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe("Unexpected (42)")
  })

  it("returns the resolved value even if it is null", async () => {
    const result = await handleTool(async () => null, "err")
    expect(result).not.toHaveProperty("isError")
    expect(result.content[0].text).toBe("null")
  })
})

// ---------------------------------------------------------------------------
// buildParams
// ---------------------------------------------------------------------------

describe("buildParams", () => {
  it("returns an empty object when all values are undefined", () => {
    expect(buildParams({ a: undefined, b: undefined })).toEqual({})
  })

  it("includes defined string values", () => {
    expect(buildParams({ format: "gen9ou" })).toEqual({ format: "gen9ou" })
  })

  it("converts number values to strings", () => {
    expect(buildParams({ limit: 10 })).toEqual({ limit: "10" })
  })

  it("omits undefined values while keeping defined ones", () => {
    const result = buildParams({
      search: "pikachu",
      limit: 5,
      offset: undefined,
    })
    expect(result).toEqual({ search: "pikachu", limit: "5" })
    expect(result).not.toHaveProperty("offset")
  })

  it("returns empty object for empty input", () => {
    expect(buildParams({})).toEqual({})
  })

  it("handles zero as a valid value", () => {
    expect(buildParams({ offset: 0 })).toEqual({ offset: "0" })
  })
})
