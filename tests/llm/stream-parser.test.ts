import { StreamParser } from "#llm/stream-parser"

describe("StreamParser", () => {
  let parser: StreamParser

  beforeEach(() => {
    parser = new StreamParser()
  })

  describe("process", () => {
    it("passes through plain text with no tags", () => {
      const result = parser.process("Hello world")
      expect(result.cleanContent).toBe("Hello world")
      expect(result.events).toEqual([])
    })

    it("passes through multiple plain text chunks", () => {
      const r1 = parser.process("Hello ")
      const r2 = parser.process("world")
      expect(r1.cleanContent).toBe("Hello ")
      expect(r2.cleanContent).toBe("world")
      expect(r1.events).toEqual([])
      expect(r2.events).toEqual([])
    })

    it("strips plan tags and emits plan_start event with steps", () => {
      const result = parser.process(
        "<plan><step>Analyze the team</step><step>Suggest changes</step></plan>",
      )
      expect(result.cleanContent).toBe("")
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toEqual({
        type: "plan_start",
        steps: [{ text: "Analyze the team" }, { text: "Suggest changes" }],
      })
    })

    it("preserves text before and after plan tags", () => {
      const result = parser.process("Before<plan><step>Do thing</step></plan>After")
      expect(result.cleanContent).toBe("BeforeAfter")
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toEqual({
        type: "plan_start",
        steps: [{ text: "Do thing" }],
      })
    })

    it("handles plan tag split across multiple chunks", () => {
      const r1 = parser.process("Hello<pla")
      // The "<pla" is a potential tag start, gets buffered
      expect(r1.cleanContent).toBe("Hello")

      const r2 = parser.process("n><step>Step 1</step></plan>Done")
      expect(r2.cleanContent).toBe("Done")
      expect(r2.events).toHaveLength(1)
      expect(r2.events[0]).toEqual({
        type: "plan_start",
        steps: [{ text: "Step 1" }],
      })
    })

    it("handles empty plan (no steps) — no plan_start event emitted", () => {
      const result = parser.process("<plan></plan>")
      expect(result.cleanContent).toBe("")
      expect(result.events).toEqual([])
    })

    it("handles plan with whitespace-only steps", () => {
      const result = parser.process("<plan><step>  Trim me  </step></plan>")
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toEqual({
        type: "plan_start",
        steps: [{ text: "Trim me" }],
      })
    })

    it("parses step_update self-closing tags", () => {
      const result = parser.process('Text<step_update index="0" status="active"/>More')
      expect(result.cleanContent).toBe("TextMore")
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toEqual({
        type: "plan_step_update",
        stepIndex: 0,
        status: "active",
      })
    })

    it("parses step_update with complete status", () => {
      const result = parser.process('<step_update index="1" status="complete"/>')
      expect(result.cleanContent).toBe("")
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toEqual({
        type: "plan_step_update",
        stepIndex: 1,
        status: "complete",
      })
    })

    it("parses step_update with skipped status", () => {
      const result = parser.process('<step_update index="2" status="skipped"/>')
      expect(result.events[0]).toEqual({
        type: "plan_step_update",
        stepIndex: 2,
        status: "skipped",
      })
    })

    it("handles multiple step_updates in one chunk", () => {
      const result = parser.process(
        '<step_update index="0" status="complete"/><step_update index="1" status="active"/>',
      )
      expect(result.events).toHaveLength(2)
      expect(result.events[0]).toEqual({
        type: "plan_step_update",
        stepIndex: 0,
        status: "complete",
      })
      expect(result.events[1]).toEqual({
        type: "plan_step_update",
        stepIndex: 1,
        status: "active",
      })
    })

    it("buffers potential partial tags near end of chunk", () => {
      // A '<' near the end (within 50 chars) should be buffered
      const r1 = parser.process("Hello<step_upd")
      expect(r1.cleanContent).toBe("Hello")
      expect(r1.events).toEqual([])

      // Complete the tag
      const r2 = parser.process('ate index="0" status="active"/>')
      expect(r2.events).toHaveLength(1)
      expect(r2.events[0]).toEqual({
        type: "plan_step_update",
        stepIndex: 0,
        status: "active",
      })
    })

    it("handles plan closing tag split across chunks", () => {
      const r1 = parser.process("<plan><step>A</step></pla")
      // Still inside plan, waiting for </plan>
      expect(r1.cleanContent).toBe("")
      expect(r1.events).toEqual([])

      const r2 = parser.process("n>After")
      expect(r2.cleanContent).toBe("After")
      expect(r2.events).toHaveLength(1)
      expect(r2.events[0]).toEqual({
        type: "plan_start",
        steps: [{ text: "A" }],
      })
    })

    it("handles plan with multiple steps", () => {
      const result = parser.process(
        "<plan><step>First</step><step>Second</step><step>Third</step></plan>",
      )
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toEqual({
        type: "plan_start",
        steps: [{ text: "First" }, { text: "Second" }, { text: "Third" }],
      })
    })

    it("handles interleaved text and step_updates", () => {
      const result = parser.process('Some text<step_update index="0" status="complete"/> more text')
      expect(result.cleanContent).toBe("Some text more text")
      expect(result.events).toHaveLength(1)
    })
  })

  describe("flush", () => {
    it("returns remaining buffer and resets state", () => {
      // Feed a partial tag that gets buffered
      parser.process("Hello<partial")
      const result = parser.flush()
      expect(result.cleanContent).toBe("<partial")
      expect(result.events).toEqual([])
    })

    it("returns empty when buffer is empty", () => {
      parser.process("Hello world")
      const result = parser.flush()
      expect(result.cleanContent).toBe("")
      expect(result.events).toEqual([])
    })

    it("resets inPlan state", () => {
      // Enter a plan but don't close it
      parser.process("<plan><step>Incomplete")
      const flushed = parser.flush()
      // Buffer should be returned as-is
      expect(flushed.cleanContent).toBe("<step>Incomplete")
      expect(flushed.events).toEqual([])

      // After flush, parser should handle new content normally
      const result = parser.process("Normal text")
      expect(result.cleanContent).toBe("Normal text")
    })
  })
})
