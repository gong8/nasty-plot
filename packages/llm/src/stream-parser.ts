import type { SSEEvent } from "./sse-events"

const STEP_REGEX = /<step>([^<]*(?:<(?!\/step>)[^<]*)*)<\/step>/g
const STEP_UPDATE_REGEX = /<step_update\s+index="(\d+)"\s+status="(active|complete|skipped)"\s*\/>/

/** Max characters from end of buffer that might be an incomplete XML tag */
const INCOMPLETE_TAG_THRESHOLD = 50

interface ParseResult {
  cleanContent: string
  events: SSEEvent[]
}

/**
 * Stateful parser that detects <plan>, <step>, and <step_update> XML tags
 * in streaming content. Strips plan tags from forwarded content and emits
 * plan-specific SSE events instead.
 */
export class StreamParser {
  private buffer = ""
  private inPlan = false
  private steps: { text: string }[] = []

  process(text: string): ParseResult {
    this.buffer += text
    const events: SSEEvent[] = []
    let cleanContent = ""

    while (this.buffer.length > 0) {
      if (this.inPlan) {
        if (!this.tryClosePlan(events)) break
        continue
      }

      const planIdx = this.buffer.indexOf("<plan>")
      if (planIdx >= 0) {
        cleanContent += this.buffer.slice(0, planIdx)
        this.buffer = this.buffer.slice(planIdx + "<plan>".length)
        this.inPlan = true
        continue
      }

      const stepUpdate = this.tryParseStepUpdate()
      if (stepUpdate) {
        cleanContent += stepUpdate.preceding
        events.push(stepUpdate.event)
        continue
      }

      cleanContent += this.consumeOrHoldIncompleteTag()
      break
    }

    return { cleanContent, events }
  }

  flush(): ParseResult {
    const remaining = this.buffer
    this.buffer = ""
    this.inPlan = false
    return { cleanContent: remaining, events: [] }
  }

  /** Try to close a <plan> block. Returns true if the closing tag was found. */
  private tryClosePlan(events: SSEEvent[]): boolean {
    const endIdx = this.buffer.indexOf("</plan>")
    if (endIdx < 0) return false

    const planContent = this.buffer.slice(0, endIdx)
    this.steps = this.parseSteps(planContent)
    if (this.steps.length > 0) {
      events.push({ type: "plan_start", steps: this.steps })
    }
    this.buffer = this.buffer.slice(endIdx + "</plan>".length)
    this.inPlan = false
    return true
  }

  private parseSteps(planContent: string): { text: string }[] {
    const steps: { text: string }[] = []
    STEP_REGEX.lastIndex = 0
    let match
    while ((match = STEP_REGEX.exec(planContent)) !== null) {
      steps.push({ text: match[1].trim() })
    }
    return steps
  }

  private tryParseStepUpdate(): { preceding: string; event: SSEEvent } | null {
    const match = STEP_UPDATE_REGEX.exec(this.buffer)
    if (!match || match.index === undefined) return null

    const preceding = this.buffer.slice(0, match.index)
    const event: SSEEvent = {
      type: "plan_step_update",
      stepIndex: parseInt(match[1], 10),
      status: match[2] as "active" | "complete" | "skipped",
    }
    this.buffer = this.buffer.slice(match.index + match[0].length)
    return { preceding, event }
  }

  /** Consume safe content, holding back a potential incomplete tag at the end. */
  private consumeOrHoldIncompleteTag(): string {
    const lastLt = this.buffer.lastIndexOf("<")
    if (lastLt >= 0 && lastLt > this.buffer.length - INCOMPLETE_TAG_THRESHOLD) {
      const consumed = this.buffer.slice(0, lastLt)
      this.buffer = this.buffer.slice(lastLt)
      return consumed
    }

    const consumed = this.buffer
    this.buffer = ""
    return consumed
  }
}
