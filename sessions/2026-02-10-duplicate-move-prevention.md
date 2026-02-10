# Session: Duplicate Move Prevention
**Date:** 2026-02-10
**Duration context:** Short

## What was accomplished
- Fixed duplicate move selection across all team builder UIs (freeform and guided)
- Added server-side duplicate move validation in the teams service layer
- Added duplicate move detection to core team validation (`validateTeam`)
- Added automatic deduplication in Showdown paste import parser
- Updated API routes to return proper 400 status for duplicate move errors
- Added 5 new test cases covering all the new validation logic

## Key decisions & rationale
- **Case-insensitive comparison everywhere**: Moves are compared case-insensitively (`toLowerCase()`) because a user could type "earthquake" while the dropdown shows "Earthquake" — both should be treated as the same move.
- **Multi-layer defense**: Duplicates are prevented at three levels:
  1. **UI**: Dropdown filters out already-selected moves, so users can't pick them
  2. **Validation**: `validateTeam()` catches duplicates for display/warning purposes
  3. **Service**: `movesToDb()` throws an error, preventing database writes
- **Showdown paste deduplication**: Rather than rejecting pastes with duplicate moves (which would be a bad UX for imports), duplicates are silently removed and the unique moves are kept.
- **Visual feedback**: If a duplicate somehow exists (e.g. from old data), the input shows a red border and "Duplicate move" error text rather than silently hiding the issue.

## Bugs found & fixed
- **Duplicate move selection allowed in all builders**: Both the freeform `SlotEditor` and guided `SimplifiedSetEditor` `MoveInput` components allowed users to select the same move in multiple slots. No validation existed at any layer (UI, API, service, or core validation). Fixed by filtering dropdown options, adding validation, and adding server-side enforcement.

## Pitfalls & gotchas encountered
- The `MoveInput` component exists as an identical copy in two files (`slot-editor.tsx` and `simplified-set-editor.tsx`). Both needed the same fix applied independently. A future improvement could extract this into a shared component.

## Files changed
- `apps/web/src/features/team-builder/components/slot-editor.tsx` — MoveInput now filters out selected moves, shows duplicate error
- `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx` — Same changes as slot-editor
- `packages/core/src/validation.ts` — Added duplicate move check in per-slot validation
- `packages/core/src/showdown-paste.ts` — Added deduplication when parsing moves from paste
- `packages/teams/src/team.service.ts` — Added `validateNoDuplicateMoves()` called from `movesToDb()`
- `apps/web/src/app/api/teams/[teamId]/slots/[position]/route.ts` — Returns 400 for duplicate move errors
- `apps/web/src/app/api/teams/[teamId]/slots/route.ts` — Returns 400 for duplicate move errors
- `tests/core/validation.test.ts` — 4 new tests for duplicate move validation
- `tests/core/showdown-paste.test.ts` — 1 new test for paste deduplication

## Known issues & next steps
- **Duplicated MoveInput component**: The `MoveInput` sub-component is copy-pasted between `slot-editor.tsx` and `simplified-set-editor.tsx`. Consider extracting to a shared component in a future session.
- **Existing data**: Teams already saved in the database may contain duplicate moves from before this fix. No migration was added to clean these up — they'll show the red "Duplicate move" indicator when edited.

## Tech notes
- The moves tuple type `[string, string?, string?, string?]` means the first move is always a string (possibly empty), and moves 2-4 are `string | undefined`.
- `movesToDb()` is the single gateway for all move writes to the database — both `addSlot` and `updateSlot` go through it, so adding validation there covers all write paths.
- All 1299 tests pass (1294 original + 5 new).
