# Session: Chat Sidebar Polish & Bug Fixes
**Date:** 2026-02-10
**Duration context:** Medium (continuation of the chat sidebar overhaul session, focused on bug fixes and polish)

## What was accomplished
- **Completed Phase 5 (Plan Mode)**: Integrated `StreamParser` into `cli-chat.ts` to pipe content deltas through XML tag parser, added plan event handlers (`plan_start`, `plan_step_update`) in `use-chat-stream.ts`, wired `ChatPlanDisplay` into `ChatPanel`, added `planSteps` to hook return value and reset logic
- **Completed Phase 6 (Full-Page Chat)**: Added `ChatSessionList` to sidebar full-page mode, added collapsible history panel toggle in sidebar mode — then **disabled full-page mode** by user request (code preserved, just unreachable)
- **Plan audit**: Ran comprehensive audit of all 6 phases against the original plan, identified and fixed 6 gaps
- **Fixed nested `<button>` hydration error**: `ChatSessionList` had a delete `<button>` inside a session `<button>` — changed outer to `<div role="button">`
- **Fixed SSR hydration mismatch**: `ChatProvider` read `localStorage` during initial state, causing server/client divergence — switched to SSR-safe defaults with post-mount `HYDRATE` dispatch
- **Fixed scrolling**: Replaced Radix `ScrollArea` with native `div` + `bottomRef.scrollIntoView()` for reliable auto-scroll
- **Fixed content overflow in narrow sidebar**: Changed assistant message bubble layout, added `break-words`, `overflow-hidden`, `overflow-x-auto` on code blocks
- **Installed `@tailwindcss/typography`**: Added `@plugin "@tailwindcss/typography"` to `globals.css` for proper prose rendering
- **Removed SiteHeader from 2 remaining battle pages**: `battle/simulate/page.tsx` and `battle/replay/[battleId]/page.tsx`
- **Cleaned up OpenAI import**: Removed `import { MODEL } from "./openai-client"` in `chat.service.ts`, replaced with local const
- **Added `session_meta` event handling** in `use-chat-stream.ts` — invalidates sessions query on title update
- **Improved title generation heuristic**: Strips markdown, uses sentence boundaries, word-boundary truncation
- **Sidebar elevated above header**: Changed from `top-16 z-40` to `top-0 z-[60]`, header + main wrapped in margin-right push div
- **Removed "Chat" nav link**: Only FAB and Cmd/Ctrl+L are entry points now
- **Fixed dropdown layout shift**: Set `modal={false}` on theme toggle `DropdownMenu` to prevent Radix body style manipulation
- **Fixed margin-right transition on theme change**: Transition class only applied during 200ms window when `isOpen` actually toggles
- **Removed damage-calc page**: Deleted `apps/web/src/app/damage-calc/` directory and nav link

## Key decisions & rationale
- **Sidebar above header (`z-[60]`, `top-0`)**: User wanted the agent chat to be dominant — sidebar spans full viewport height and overlays the header area
- **Header pushes with content**: Header and main are both inside the margin-right wrapper so the topbar shifts left when sidebar opens
- **`modal={false}` on dropdowns**: Radix modal dropdowns add `padding-right`/`overflow:hidden` to body, causing layout shifts when sidebar is open
- **Transition only on open/close**: The `transition-[margin-right]` class caused visible gaps on theme change and hydration — now only applied during the 200ms when `isOpen` actually changes
- **Native scroll div over Radix ScrollArea**: Radix `ScrollArea` ref points to root wrapper, not the scrollable viewport — unreliable for programmatic scrolling
- **Full-page chat disabled but preserved**: User decided full-page mode was unnecessary; `fullPage` prop still works if re-enabled later
- **Damage-calc page removed**: User considered it useless as a standalone page. Package and API routes preserved (used by chat agent)

## Bugs found & fixed
- **Nested `<button>` hydration error**: `ChatSessionList` had `<button>` (delete) inside `<button>` (session row). Fixed with `<div role="button" tabIndex={0}>` + keyboard handler
- **SSR hydration mismatch**: `ChatProvider.getInitialState()` branched on `typeof window` — server rendered `isOpen:false`, client read `isOpen:true` from localStorage. Fixed with SSR-safe initial state + `HYDRATE` action in `useEffect`
- **Scrolling broken**: Radix `ScrollArea` ref was on root element, not the scrollable viewport. `scrollTop`/`scrollHeight` had no effect. Fixed with native `div` + `scrollIntoView`
- **Content overflow in sidebar**: `max-w-[85%]` on assistant messages still overflowed. Fixed with `min-w-0 flex-1 overflow-hidden break-words`
- **Theme dropdown gap**: Opening the theme toggle dropdown caused a visible gap between content and sidebar. Root cause: Radix `DropdownMenu` in modal mode adds `padding-right` to body. Fixed with `modal={false}`
- **Margin-right animation on theme change**: The always-on `transition-[margin-right]` animated from 0 to stored width during hydration/theme changes. Fixed by only enabling the transition class for 200ms when `isOpen` toggles
- **`stream-parser.ts` regex flag**: `/s` flag requires ES2018 target. Replaced with ES5-compatible pattern

## Pitfalls & gotchas encountered
- **Radix ScrollArea is not a simple scroll container**: The `ref` gives you the root wrapper, not the scrollable `Viewport` child. For programmatic scroll control, use a native div
- **Radix modal dropdowns manipulate body styles**: `DropdownMenu` defaults to `modal={true}` which adds `padding-right`/`overflow:hidden` to prevent background scroll — this causes layout shifts when you have fixed sidebars
- **CSS transitions fire on any value change**: `transition-[margin-right]` transitions ALL margin-right changes including hydration, theme changes, and resizes — not just intentional open/close. Need to gate the transition class
- **`replace_all` is indentation-sensitive**: When removing `<SiteHeader />` from the replay page, it had 3 instances at different indentation levels. `replace_all` matched 2 of 3

## Files changed

### Modified
- `apps/web/src/features/chat/context/chat-provider.tsx` — SSR-safe initial state, HYDRATE action
- `apps/web/src/components/app-shell.tsx` — header inside push wrapper, conditional transition, removed full-page chat branch
- `apps/web/src/components/chat-sidebar.tsx` — `top-0 z-[60]`, history toggle, fullPage with session list
- `apps/web/src/components/site-header.tsx` — removed Chat and Damage Calc nav links
- `apps/web/src/components/theme-toggle.tsx` — `modal={false}`, `z-[70]` on dropdown
- `apps/web/src/features/chat/components/chat-panel.tsx` — native scroll div, bottomRef anchor, planSteps
- `apps/web/src/features/chat/components/chat-message.tsx` — overflow fixes, break-words
- `apps/web/src/features/chat/components/chat-session-list.tsx` — div role=button instead of nested buttons
- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — plan events, session_meta, planSteps in return/reset
- `packages/llm/src/cli-chat.ts` — StreamParser integration, flush on result
- `packages/llm/src/chat.service.ts` — removed OpenAI import, local MODEL const
- `packages/llm/src/stream-parser.ts` — ES5-compatible regex
- `apps/web/src/app/globals.css` — `@plugin "@tailwindcss/typography"`
- `apps/web/src/app/chat/page.tsx` — auto-opens sidebar, landing page
- `apps/web/src/app/api/chat/route.ts` — improved title generation heuristic
- `apps/web/src/app/battle/simulate/page.tsx` — removed SiteHeader
- `apps/web/src/app/battle/replay/[battleId]/page.tsx` — removed SiteHeader

### Deleted
- `apps/web/src/app/damage-calc/page.tsx`
- `apps/web/src/app/damage-calc/loading.tsx`
- `apps/web/src/app/damage-calc/error.tsx`

## Known issues & next steps
- **LLM-based title generation**: Still uses heuristic (sentence boundaries). Could spawn a lightweight Claude CLI call for better titles
- **`session_meta` SSE event not emitted from server**: Title is generated after stream starts; no way to inject into the flowing SSE stream. Relies on query invalidation instead
- **`openai-client.ts` still exported from `llm/index.ts`**: `getOpenAI` and `MODEL` exports remain. Could clean up if nothing else uses them
- **Plan mode untested end-to-end**: XML parsing and display implemented but not tested with actual LLM `<plan>` tag output
- **No test coverage**: None of the new chat components or hooks have tests
- **Damage-calc API routes still exist**: Routes at `/api/damage-calc` and the `@nasty-plot/damage-calc` package are still present (used by chat agent MCP tools)

## Tech notes
- **Z-index stack**: Header `z-50` < Sidebar `z-[60]` < Dropdown portals `z-[70]`
- **Hydration pattern**: For any client state that reads localStorage, always initialize with SSR-safe defaults and hydrate in `useEffect`. Never branch on `typeof window` in initial state
- **Radix dropdown `modal` prop**: Default `true` causes body style manipulation. Use `modal={false}` when layout has fixed sidebars to avoid shifts
- **Scroll anchor pattern**: Instead of `el.scrollTop = el.scrollHeight` (fragile with Radix), use a sentinel `<div ref={bottomRef} />` at the end of content and call `bottomRef.current?.scrollIntoView({ behavior: "instant" })`
- **Conditional CSS transitions**: Don't use always-on `transition-*` classes on elements whose values change during hydration. Gate the class behind a state flag that only activates during intentional changes
