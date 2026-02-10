import type { SSEEvent } from "./sse-events"

/**
 * Stateful parser that detects <plan>, <step>, and <step_update> XML tags
 * in streaming content. Strips plan tags from forwarded content and emits
 * plan-specific SSE events instead.
 */
export class StreamParser {
  private buffer = ""
  private inPlan = false
  private steps: { text: string }[] = []

  /**
   * Process a content chunk and return:
   * - cleanContent: text to forward to the client (with plan tags stripped)
   * - events: any plan-specific SSE events to emit
   */
  process(text: string): { cleanContent: string; events: SSEEvent[] } {
    this.buffer += text
    const events: SSEEvent[] = []
    let cleanContent = ""

    while (this.buffer.length > 0) {
      if (this.inPlan) {
        const endIdx = this.buffer.indexOf("</plan>")
        if (endIdx >= 0) {
          const planContent = this.buffer.slice(0, endIdx)
          this.steps = []
          const stepRegex = /<step>([^<]*(?:<(?!\/step>)[^<]*)*)<\/step>/g
          let match
          while ((match = stepRegex.exec(planContent)) !== null) {
            this.steps.push({ text: match[1].trim() })
          }
          if (this.steps.length > 0) {
            events.push({ type: "plan_start", steps: this.steps })
          }
          this.buffer = this.buffer.slice(endIdx + "</plan>".length)
          this.inPlan = false
          continue
        }
        break
      }

      const planIdx = this.buffer.indexOf("<plan>")
      if (planIdx >= 0) {
        cleanContent += this.buffer.slice(0, planIdx)
        this.buffer = this.buffer.slice(planIdx + "<plan>".length)
        this.inPlan = true
        continue
      }

      const stepUpdateRegex =
        /<step_update\s+index="(\d+)"\s+status="(active|complete|skipped)"\s*\/>/
      const suMatch = stepUpdateRegex.exec(this.buffer)
      if (suMatch && suMatch.index !== undefined) {
        cleanContent += this.buffer.slice(0, suMatch.index)
        events.push({
          type: "plan_step_update",
          stepIndex: parseInt(suMatch[1], 10),
          status: suMatch[2] as "active" | "complete" | "skipped",
        })
        this.buffer = this.buffer.slice(suMatch.index + suMatch[0].length)
        continue
      }

      const lastLt = this.buffer.lastIndexOf("<")
      if (lastLt >= 0 && lastLt > this.buffer.length - 50) {
        cleanContent += this.buffer.slice(0, lastLt)
        this.buffer = this.buffer.slice(lastLt)
        break
      }

      cleanContent += this.buffer
      this.buffer = ""
    }

    return { cleanContent, events }
  }

  flush(): { cleanContent: string; events: SSEEvent[] } {
    const remaining = this.buffer
    this.buffer = ""
    this.inPlan = false
    return { cleanContent: remaining, events: [] }
  }
}
