# Session: Guided Builder Chat Prompt Suggestions

**Date:** 2026-02-12
**Duration context:** Short

## What was accomplished

- Added contextual pre-made prompt suggestion chips to the guided team builder's chat sidebar
- Chips appear above the chat input labeled "Ask Pecharunt" and change dynamically based on the current wizard stage and team size
- Prompts are short labels that expand to fuller questions when clicked, sending directly to the LLM

### Prompt mapping by stage:

| Stage                | Prompts                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| **start**            | "What playstyle fits me?" / "Explain the meta" / "Offense or balance?"  |
| **lead**             | "Best leads right now?" / "Who sets hazards?" / "Suggest a lead"        |
| **build** (1-2 mons) | "What type am I missing?" / "Suggest a core" / "Who pairs well?"        |
| **build** (3-4 mons) | "What's my biggest gap?" / "Need a revenge killer?" / "Hazard removal?" |
| **build** (5+)       | "Who rounds this out?" / "Check my coverage" / "Any weaknesses?"        |
| **sets**             | "Optimize my EVs" / "Better move options?" / "Suggest items"            |
| **review**           | "Rate my team" / "Biggest threats?" / "Any changes needed?"             |

## Key decisions & rationale

- **Reactive state for step/teamSize in ChatProvider** — The `guidedBuilderContextRef` is a ref (non-reactive), so reading it at render time doesn't trigger re-renders when the step changes. Added `guidedBuilderStep` and `guidedBuilderTeamSize` as state variables in `ChatProvider` that sync when `setGuidedBuilderContext` is called, ensuring the prompt chips update immediately on stage transitions.
- **Direct send on click** — Chips send the message immediately rather than pre-filling the input. This is the standard UX pattern (ChatGPT-style) and reduces friction. The short label is what the user sees; the message sent is a slightly longer, more detailed question for better LLM responses.
- **Build stage splits by team size** — The build phase has 3 different prompt sets depending on how many Pokemon are already picked (1-2, 3-4, 5+), keeping suggestions relevant to the current team state.
- **Hidden during streaming** — Chips disappear while the LLM is responding to avoid visual clutter and prevent accidental double-sends.

## Bugs found & fixed

- None

## Pitfalls & gotchas encountered

- The `guidedBuilderContextRef` is intentionally a ref (not state) in `ChatProvider` to avoid re-render loops with the guided builder. But this means any UI that needs to react to guided builder changes needs separate reactive state derived from the ref updates. The `setGuidedBuilderContext` callback is the right place to extract and set reactive values.

## Files changed

- `apps/web/src/features/chat/components/chat-guided-prompts.tsx` — **Created.** New component with stage-aware prompt suggestion chips.
- `apps/web/src/features/chat/components/chat-panel.tsx` — Added import and rendering of `ChatGuidedPrompts` above the chat input.
- `apps/web/src/features/chat/context/chat-provider.tsx` — Added `guidedBuilderStep` and `guidedBuilderTeamSize` reactive state, updated `setGuidedBuilderContext` to sync them, exposed both in context value.

## Known issues & next steps

- The prompt suggestions only appear in the guided builder context (when `guidedBuilderStep` is non-null). Could consider adding similar suggestions for other chat contexts (team editor, battle coach, etc.) in the future.
- No animation on step transitions — chips just swap instantly. Could add a subtle fade transition if desired.
- Pre-existing TypeScript errors in other files (guided-builder-provider, team page, API routes) unrelated to this change.

## Tech notes

- `ChatProvider` uses a ref (`guidedBuilderContextRef`) for the guided builder context to avoid re-render cascades, but any UI that needs to react to changes needs separate state variables synced in the `setGuidedBuilderContext` callback.
- The `ChatInput` component already had `pendingInput` infrastructure for pre-filling text, but the prompt chips bypass this and call `onSend` directly for immediate send behavior.
- The `ChatPanel` gets `handleSend` which wraps `sendMessage` with guided builder context injection, so prompt chip messages automatically include the full team state context for the LLM.
