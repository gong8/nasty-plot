/**
 * Tests for the browser-safe re-export entry point.
 * browser.ts re-exports a subset of the LLM package that is safe for client components.
 */

// Import directly from the browser entry point to verify it's importable
import {
  buildTurnCommentaryContext,
  buildPostBattleContext,
  buildTurnAnalysisContext,
  buildAutoAnalyzePrompt,
  buildPageContextPrompt,
  buildContextModePrompt,
  getToolLabel,
  isWriteTool,
} from "#llm/browser"

describe("browser entry point", () => {
  it("exports battle context builders", () => {
    expect(typeof buildTurnCommentaryContext).toBe("function")
    expect(typeof buildPostBattleContext).toBe("function")
    expect(typeof buildTurnAnalysisContext).toBe("function")
    expect(typeof buildAutoAnalyzePrompt).toBe("function")
  })

  it("exports context-builder functions", () => {
    expect(typeof buildPageContextPrompt).toBe("function")
    expect(typeof buildContextModePrompt).toBe("function")
  })

  it("exports tool-label functions", () => {
    expect(typeof getToolLabel).toBe("function")
    expect(typeof isWriteTool).toBe("function")
  })
})
