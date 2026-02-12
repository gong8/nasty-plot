# Session: Linear Integration Setup

**Date:** 2026-02-10
**Duration context:** short

## What was accomplished

- Connected to the Linear MCP server and verified access to the `nasty-plot` team (POK prefix) in the `sentinel-dev` workspace
- Queried team statuses (Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate) and labels (Bug, Feature, Improvement, Chore, Test, Consideration, GTM, Misc)
- Created `CLAUDE.md` with comprehensive Linear integration instructions so every future Claude Code session automatically tracks work via Linear

## Key decisions & rationale

- **CLAUDE.md as the integration point** — rather than custom tooling or hooks, the workflow is driven by instructions in `CLAUDE.md` that tell Claude Code when/how to use the already-available Linear MCP tools. This is the simplest approach with zero extra infrastructure.
- **Session-start check pattern** — CLAUDE.md instructs checking "In Progress" issues at session start so Claude Code picks up context from prior sessions automatically.
- **Mid-task issue creation** — rather than batching TODOs at session end, issues are created immediately when discovered so nothing gets lost if a session ends unexpectedly.
- **Labels always required** — every issue gets at least one label to keep the board organized from day one.

## Bugs found & fixed

- None — this was a setup/config session.

## Pitfalls & gotchas encountered

- The Linear MCP tools are deferred tools — they need to be loaded via `ToolSearch` before first use in a session. The CLAUDE.md references tool names directly (`mcp__plugin_linear_linear__*`) which will prompt the load.

## Files changed

- `CLAUDE.md` — created with project description and Linear integration workflow

## Known issues & next steps

- The test issue `POK-1` ("hi!") is still in Backlog — can be cleaned up or used for testing
- No initial backlog has been created yet — future session could populate Linear with planned work items from the existing plans in `plans/`
- Could add more project-specific conventions to CLAUDE.md (coding standards, repo structure, etc.)
- Could set up Linear projects or cycles for milestone-level tracking

## Tech notes

- Linear team ID: `c896c57c-84a1-4e6d-8bfc-f7f439070f02`
- Linear workspace: `sentinel-dev`
- Team prefix: `POK`
- Available Linear MCP tools: `list_issues`, `create_issue`, `update_issue`, `list_comments`, `create_comment`, `list_issue_statuses`, `list_issue_labels`, `create_issue_label`, and more
- The Linear MCP server authenticates via the `/mcp` CLI command — connection was confirmed at session start
