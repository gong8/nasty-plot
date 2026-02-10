import { BattleStreams, Teams } from "@pkmn/sim";
import { processChunk, parseRequest, updateSideFromRequest } from "../protocol-parser";
import { createInitialState } from "../battle-manager";
import type {
  BattleState,
  BattleFormat,
  BattleActionSet,
  BattleLogEntry,
  AIPlayer,
} from "../types";

export interface SingleBattleResult {
  winner: "p1" | "p2" | "draw";
  turnCount: number;
  protocolLog: string;
  team1Paste: string;
  team2Paste: string;
  /** Per-turn actions (for analytics) */
  turnActions: { turn: number; p1: string; p2: string }[];
  /** Final state snapshot */
  finalState: BattleState;
}

interface AutomatedBattleConfig {
  formatId: string;
  gameType: BattleFormat;
  team1Paste: string;
  team2Paste: string;
  team1Name?: string;
  team2Name?: string;
  ai1: AIPlayer;
  ai2: AIPlayer;
  /** Max turns before declaring draw. Default: 500 */
  maxTurns?: number;
}

/**
 * Runs a fully automated battle between two AIs with no delay.
 * Optimized for speed — no UI callbacks or artificial delays.
 */
export async function runAutomatedBattle(
  config: AutomatedBattleConfig,
): Promise<SingleBattleResult> {
  const maxTurns = config.maxTurns ?? 500;
  const stream = new BattleStreams.BattleStream();
  const state = createInitialState("auto-battle", config.gameType);
  state.sides.p1.name = config.team1Name || "Team 1";
  state.sides.p2.name = config.team2Name || "Team 2";

  let protocolLog = "";
  const turnActions: SingleBattleResult["turnActions"] = [];
  let currentTurnP1 = "";
  let currentTurnP2 = "";

  let pendingP1Actions: BattleActionSet | null = null;
  let pendingP2Actions: BattleActionSet | null = null;
  let p1TeamPreview = false;
  let p2TeamPreview = false;
  let lastProtocolChunk = "";

  // Convert pastes to packed format
  const team1Packed = pasteToPackedTeam(config.team1Paste);
  const team2Packed = pasteToPackedTeam(config.team2Paste);

  if (!team1Packed || !team2Packed) {
    throw new Error("Failed to parse team pastes");
  }

  // Collect and process output
  const outputPromise = (async () => {
    for await (const chunk of stream) {
      protocolLog += chunk + "\n";

      const lines = chunk.split("\n");
      let protoLines = "";

      for (const line of lines) {
        if (line.startsWith("|request|")) {
          // Process accumulated protocol
          if (protoLines.trim() && protoLines.trim() !== lastProtocolChunk) {
            lastProtocolChunk = protoLines.trim();
            processChunk(state, protoLines);
          }
          protoLines = "";

          // Parse request
          try {
            const reqJson = line.slice(9);
            const parsed = parseRequest(reqJson);
            const rawReq = JSON.parse(reqJson);
            const sideId = rawReq.side?.id as "p1" | "p2" | undefined;

            if (sideId && parsed.side) {
              updateSideFromRequest(state, sideId, parsed.side);
            }

            if (sideId === "p1") {
              if (parsed.teamPreview) {
                p1TeamPreview = true;
              } else if (!parsed.wait && parsed.actions) {
                pendingP1Actions = parsed.actions;
              }
            } else if (sideId === "p2") {
              if (parsed.teamPreview) {
                p2TeamPreview = true;
              } else if (!parsed.wait && parsed.actions) {
                pendingP2Actions = parsed.actions;
              }
            }
          } catch {
            // Skip bad requests
          }
          continue;
        }
        protoLines += line + "\n";
      }

      // Process remaining
      if (protoLines.trim() && protoLines.trim() !== lastProtocolChunk) {
        lastProtocolChunk = protoLines.trim();
        processChunk(state, protoLines);
      }
    }
  })();

  // Start the battle
  const format = config.formatId || "gen9ou";
  stream.write(`>start {"formatid":"${format}"}`);
  stream.write(`>player p1 {"name":"${state.sides.p1.name}","team":"${escapeTeam(team1Packed)}"}`);
  stream.write(`>player p2 {"name":"${state.sides.p2.name}","team":"${escapeTeam(team2Packed)}"}`);

  // Wait for requests
  await tick();

  // Handle team preview
  if (p1TeamPreview) {
    const p1Leads = config.ai1.chooseLeads(6, config.gameType);
    stream.write(`>p1 team ${p1Leads.join("")}`);
  }
  if (p2TeamPreview) {
    const p2Leads = config.ai2.chooseLeads(6, config.gameType);
    stream.write(`>p2 team ${p2Leads.join("")}`);
  }

  await tick();

  // Main battle loop
  let turns = 0;
  while (state.phase !== "ended" && turns < maxTurns) {
    await tick();

    await processActions();

    async function processActions() {
      if (pendingP1Actions && pendingP2Actions) {
        const p1Action = await config.ai1.chooseAction(state, pendingP1Actions);
        const p2Action = await config.ai2.chooseAction(state, pendingP2Actions);

        currentTurnP1 = actionToChoice(p1Action);
        currentTurnP2 = actionToChoice(p2Action);

        stream.write(`>p1 ${currentTurnP1}`);
        stream.write(`>p2 ${currentTurnP2}`);

        turnActions.push({ turn: state.turn, p1: currentTurnP1, p2: currentTurnP2 });

        pendingP1Actions = null;
        pendingP2Actions = null;
        turns++;
        return;
      }
      if (pendingP1Actions && pendingP1Actions.forceSwitch) {
        const p1Action = await config.ai1.chooseAction(state, pendingP1Actions);
        stream.write(`>p1 ${actionToChoice(p1Action)}`);
        pendingP1Actions = null;
        return;
      }
      if (pendingP2Actions && pendingP2Actions.forceSwitch) {
        const p2Action = await config.ai2.chooseAction(state, pendingP2Actions);
        stream.write(`>p2 ${actionToChoice(p2Action)}`);
        pendingP2Actions = null;
      }
    }

    await tick();
  }

  // Cleanup
  try { stream.destroy(); } catch { /* ok */ }
  await outputPromise.catch(() => {});

  const winner = state.winner === "p1" ? "p1"
    : state.winner === "p2" ? "p2"
    : "draw";

  return {
    winner,
    turnCount: state.turn,
    protocolLog,
    team1Paste: config.team1Paste,
    team2Paste: config.team2Paste,
    turnActions,
    finalState: state,
  };
}

function actionToChoice(action: { type: string; moveIndex?: number; pokemonIndex?: number; tera?: boolean }): string {
  if (action.type === "move") {
    let choice = `move ${action.moveIndex}`;
    if (action.tera) choice += " terastallize";
    return choice;
  }
  return `switch ${action.pokemonIndex}`;
}

function escapeTeam(team: string): string {
  return team.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function pasteToPackedTeam(team: string): string | null {
  const trimmed = team.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("\n") || (trimmed.includes("|") && !trimmed.includes("Ability:"))) {
    return trimmed;
  }
  try {
    const sets = Teams.import(trimmed);
    if (!sets || sets.length === 0) return null;
    return Teams.pack(sets);
  } catch {
    return null;
  }
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
