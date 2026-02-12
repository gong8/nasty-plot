# Session: Battle Engine |split| Protocol Fix

**Date:** 2026-02-10
**Duration context:** Medium

## What was accomplished

- Identified and fixed the root cause of duplicate battle events in the battle engine
- Every battle event (switches, damage, weather, items, faints) was appearing twice with different HP values
- Verified fix with a diagnostic script that runs a real `@pkmn/sim` battle and confirms single event output

## Key decisions & rationale

- **Chose to handle `|split|` in `processChunk` rather than using `getPlayerStreams`**: The `@pkmn/sim` `BattleStreams.getPlayerStreams()` API provides a properly deduplicated `omniscient` stream, but switching to it would require a major refactor of how `BattleManager` reads/writes the stream. Handling `|split|` directly in the parser is surgical and contained.
- **Keep the owner's perspective (exact HP) over the spectator view (percentage HP)**: When `|split|<side>` emits two lines, the first is the owner's view with exact HP (e.g., `295/404`) and the second is the spectator view with percentage (e.g., `74/100`). We keep exact HP for accurate state tracking.
- **Also moved `protocolLog` accumulation after dedup check**: Secondary cleanup — ensures only unique protocol chunks are stored in the log, though the real fix was `|split|` handling.

## Bugs found & fixed

### Duplicate battle events with different HP values (ROOT CAUSE)

- **Symptoms**: Every battle event appeared twice in output:
  ```
  Player sent out Weavile!
  Player sent out Weavile!
  Tyranitar lost HP! (71%, -29%)
  Tyranitar lost HP! (18%, -53%)
  ```
- **Root cause**: `@pkmn/sim`'s raw `BattleStream` uses `|split|<side>` protocol markers. After a `|split|p2` marker, the next line shows the owner's view (exact HP like `295/404`) and the following line shows the spectator view (percentage like `74/100`). The parser had no awareness of `|split|` — it processed BOTH lines as separate events, creating duplicate entries with conflicting HP values.
- **Why previous dedup didn't work**: The existing `lastProtocolChunk` string comparison was designed to catch identical chunks from both player perspectives. But `|split|` means the duplicates are within the SAME chunk with DIFFERENT values — they're never string-equal.
- **Fix**: `processChunk()` now detects `|split|` markers, processes only the owner line (i+1), and skips the spectator line (i+2). Same logic added to `ReplayEngine.parse()`.

## Pitfalls & gotchas encountered

- **Initial misdiagnosis**: First assumed the bug was about the raw protocol log accumulating before deduplication (`this.protocolLog += chunk`). This was a secondary issue — the real problem was `|split|` handling.
- **Duplicate lines looked identical at first glance**: The "sent out" messages appeared identical, masking that HP-related lines had different values. Only careful inspection revealed the numbers differed, pointing to perspective-based duplication rather than simple stream duplication.
- **`@pkmn/sim` raw BattleStream format is poorly documented**: The `update`/`sideupdate`/`|split|` format is an internal detail. Had to write a diagnostic script to capture raw chunks and understand the exact format.

## Files changed

- `packages/battle-engine/src/protocol-parser.ts` — `processChunk()` now handles `|split|` markers
- `packages/battle-engine/src/replay/replay-engine.ts` — `parse()` now handles `|split|` and stream markers
- `packages/battle-engine/src/battle-manager.ts` — Moved `protocolLog` accumulation after dedup check
- `packages/battle-engine/src/simulation/automated-battle-manager.ts` — Same protocolLog cleanup

## Known issues & next steps

- **Existing battles in DB have duplicated protocol logs**: Any battles stored before this fix contain `|split|` duplicates in their `protocolLog` field. The `ReplayEngine` fix handles this going forward, but replays of old battles will now show correct (non-duplicated) output since the replay parser now understands `|split|`.
- **HP values use owner's perspective**: The fix keeps exact HP (e.g., `295/404`) rather than percentage (`74/100`). The `hpPercent` is then calculated from exact values, which should be more accurate. Verify this looks correct in the battle UI.
- **Stream markers in protocol log**: The stored protocol log may contain noise lines like `update`, `sideupdate`, `p1`, `p2` from the raw stream format. These are harmlessly ignored by `processLine` (returns null) and explicitly skipped in `ReplayEngine.parse()`.

## Tech notes

- **`@pkmn/sim` BattleStream raw output format**:
  - `update\n` prefix: shared protocol visible to all (moves, weather, abilities, etc.)
  - `|split|<side>\n<owner line>\n<spectator line>`: HP-sensitive events emitted twice
  - `sideupdate\n<p1|p2>\n|request|{...}`: per-player request data with private team info
- **`|split|` appears for**: `|switch|`, `|-damage|`, `|-heal|`, and any line showing Pokemon HP
- **`BattleStreams.getPlayerStreams(stream)`**: The "correct" API that handles all this automatically. Returns `omniscient` (full data, no duplication), `spectator` (percentage HP only), `p1`/`p2` (per-player views). Could be adopted in a future refactor for cleaner architecture.
- **Diagnostic script pattern**: Writing a small `.ts` script that creates a `BattleStream`, runs a battle, and logs raw chunks is invaluable for debugging protocol issues. See `/tmp/debug-stream.ts` pattern used in this session.
