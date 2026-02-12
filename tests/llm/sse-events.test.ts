/**
 * Tests for SSEEvent type definitions.
 * sse-events.ts is a type-only module — these tests verify the types compile correctly.
 */

import type { SSEEvent } from "@nasty-plot/llm"

describe("SSEEvent types", () => {
  it("accepts content event", () => {
    const event: SSEEvent = { type: "content", content: "Hello" }
    expect(event.type).toBe("content")
  })

  it("accepts tool_start event", () => {
    const event: SSEEvent = {
      type: "tool_start",
      name: "get_pokemon",
      label: "Looking up Pokemon",
      input: { pokemonId: "pikachu" },
    }
    expect(event.type).toBe("tool_start")
  })

  it("accepts tool_end event", () => {
    const event: SSEEvent = { type: "tool_end", name: "get_pokemon" }
    expect(event.type).toBe("tool_end")
  })

  it("accepts tool_error event", () => {
    const event: SSEEvent = { type: "tool_error", name: "get_pokemon", error: "Not found" }
    expect(event.type).toBe("tool_error")
  })

  it("accepts action_notify event", () => {
    const event: SSEEvent = {
      type: "action_notify",
      name: "add_pokemon_to_team",
      label: "Adding Pokemon",
      input: { pokemonId: "pikachu" },
    }
    expect(event.type).toBe("action_notify")
  })

  it("accepts plan_start event", () => {
    const event: SSEEvent = {
      type: "plan_start",
      steps: [{ text: "Step 1" }, { text: "Step 2" }],
    }
    expect(event.type).toBe("plan_start")
  })

  it("accepts plan_step_update event", () => {
    const event: SSEEvent = { type: "plan_step_update", stepIndex: 0, status: "complete" }
    expect(event.type).toBe("plan_step_update")
  })

  it("accepts session_meta event", () => {
    const event: SSEEvent = { type: "session_meta", sessionId: "abc-123", title: "My Chat" }
    expect(event.type).toBe("session_meta")
  })

  it("accepts error event", () => {
    const event: SSEEvent = { type: "error", error: "Something went wrong" }
    expect(event.type).toBe("error")
  })

  it("accepts done event", () => {
    const event: SSEEvent = { type: "done" }
    expect(event.type).toBe("done")
  })
})
