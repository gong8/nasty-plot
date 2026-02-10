import { BattleStreams } from "@pkmn/sim";
import { processChunk, parseRequest, updateSideFromRequest } from "./protocol-parser";
import type {
  BattleState,
  BattleFormat,
  BattleAction,
  BattleActionSet,
  BattleLogEntry,
  SideConditions,
  AIPlayer,
} from "./types";

function defaultSideConditions(): SideConditions {
  return {
    stealthRock: false,
    spikes: 0,
    toxicSpikes: 0,
    stickyWeb: false,
    reflect: 0,
    lightScreen: 0,
    auroraVeil: 0,
    tailwind: 0,
  };
}

export function createInitialState(id: string, format: BattleFormat): BattleState {
  function makeEmptySide(name: string) {
    return {
      active: format === "doubles" ? [null, null] : [null],
      team: [] as never[],
      name,
      sideConditions: defaultSideConditions(),
      canTera: true,
    };
  }

  return {
    phase: "setup",
    format,
    turn: 0,
    sides: {
      p1: makeEmptySide("Player"),
      p2: makeEmptySide("Opponent"),
    },
    field: {
      weather: "",
      weatherTurns: 0,
      terrain: "",
      terrainTurns: 0,
      trickRoom: 0,
    },
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id,
  };
}

interface BattleManagerConfig {
  formatId: string;
  gameType: BattleFormat;
  playerTeam: string; // Packed or paste format
  opponentTeam: string;
  playerName?: string;
  opponentName?: string;
}

export type BattleEventHandler = (state: BattleState, entries: BattleLogEntry[]) => void;

/**
 * BattleManager orchestrates a battle using @pkmn/sim's BattleStream.
 *
 * It handles:
 * - Creating battles via BattleStream
 * - Submitting team choices and move selections
 * - Maintaining normalized BattleState
 * - Routing AI decisions
 */
export class BattleManager {
  private stream: InstanceType<typeof BattleStreams.BattleStream>;
  private state: BattleState;
  private config: BattleManagerConfig;
  private ai: AIPlayer | null = null;
  private eventHandler: BattleEventHandler | null = null;
  private pendingP2Actions: BattleActionSet | null = null;
  private started = false;
  private resolveReady: ((value: void) => void) | null = null;
  private destroyed = false;

  constructor(config: BattleManagerConfig) {
    this.config = config;
    this.state = createInitialState(
      `battle-${Date.now()}`,
      config.gameType
    );
    this.state.sides.p1.name = config.playerName || "Player";
    this.state.sides.p2.name = config.opponentName || "Opponent";
    this.stream = new BattleStreams.BattleStream();
  }

  /** Set the AI player for p2. */
  setAI(ai: AIPlayer) {
    this.ai = ai;
  }

  /** Set a callback for state updates. */
  onUpdate(handler: BattleEventHandler) {
    this.eventHandler = handler;
  }

  /** Get current battle state. */
  getState(): BattleState {
    return this.state;
  }

  /**
   * Start the battle. Returns when the first request is ready.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Start reading from the stream
    this.readStream();

    // Write the battle initialization
    const format = this.config.formatId || "gen9ou";
    this.stream.write(`>start {"formatid":"${format}"}`);
    this.stream.write(`>player p1 {"name":"${this.state.sides.p1.name}","team":"${escapeTeam(this.config.playerTeam)}"}`);
    this.stream.write(`>player p2 {"name":"${this.state.sides.p2.name}","team":"${escapeTeam(this.config.opponentTeam)}"}`);

    // Wait for the first request to come in
    await new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Submit team preview lead order.
   */
  async chooseLead(leadOrder: number[]): Promise<void> {
    const choice = `team ${leadOrder.join("")}`;
    this.stream.write(`>p1 ${choice}`);

    // AI chooses leads
    if (this.ai) {
      const aiLeads = this.ai.chooseLeads(
        this.state.sides.p2.team.length || 6,
        this.state.format
      );
      const aiChoice = `team ${aiLeads.join("")}`;
      this.stream.write(`>p2 ${aiChoice}`);
    }

    this.state.phase = "battle";
    await this.waitForUpdate();
  }

  /**
   * Submit a player action (move or switch).
   */
  async submitAction(action: BattleAction): Promise<void> {
    const choice = actionToChoice(action);
    this.stream.write(`>p1 ${choice}`);

    // Let AI make its choice
    if (this.ai && this.pendingP2Actions) {
      await this.handleAITurn();
    }

    this.state.waitingForChoice = false;
    await this.waitForUpdate();
  }

  /** Destroy the battle stream. */
  destroy() {
    this.destroyed = true;
    try {
      this.stream.destroy();
    } catch {
      // Stream may already be destroyed
    }
  }

  private async readStream() {
    try {
      for await (const chunk of this.stream) {
        if (this.destroyed) break;
        this.processOutput(chunk);
      }
    } catch {
      // Stream closed or errored
    }
  }

  private processOutput(chunk: string) {
    const lines = chunk.split("\n");
    let protocolLines = "";
    const allEntries: BattleLogEntry[] = [];

    for (const line of lines) {
      if (line.startsWith("|request|")) {
        // Process any accumulated protocol lines first
        if (protocolLines.trim()) {
          const entries = processChunk(this.state, protocolLines);
          allEntries.push(...entries);
          protocolLines = "";
        }

        this.handleRequest(line.slice(9));
        continue;
      }

      if (line.startsWith("|error|")) {
        console.error("[BattleManager] Error:", line.slice(7));
        continue;
      }

      // Accumulate protocol lines
      protocolLines += line + "\n";
    }

    // Process remaining protocol lines
    if (protocolLines.trim()) {
      const entries = processChunk(this.state, protocolLines);
      allEntries.push(...entries);
    }

    if (allEntries.length > 0 && this.eventHandler) {
      this.eventHandler(this.state, allEntries);
    }
  }

  private handleRequest(requestJson: string) {
    try {
      const parsed = parseRequest(requestJson);
      const rawReq = JSON.parse(requestJson);
      const sideId = rawReq.side?.id as "p1" | "p2" | undefined;

      if (sideId === "p1") {
        if (parsed.side) {
          updateSideFromRequest(this.state, "p1", parsed.side);
        }

        if (parsed.teamPreview) {
          this.state.phase = "preview";
          this.state.waitingForChoice = true;
        } else if (parsed.wait) {
          this.state.waitingForChoice = false;
        } else {
          this.state.availableActions = parsed.actions;
          this.state.waitingForChoice = true;
        }

        if (this.eventHandler) {
          this.eventHandler(this.state, []);
        }

        // Resolve any pending waiter
        if (this.resolveReady) {
          const resolve = this.resolveReady;
          this.resolveReady = null;
          resolve();
        }
      } else if (sideId === "p2") {
        if (parsed.side) {
          updateSideFromRequest(this.state, "p2", parsed.side);
        }

        if (parsed.teamPreview) {
          // AI will handle team preview when player submits
        } else if (!parsed.wait && parsed.actions) {
          // Store for AI to use when player submits
          this.pendingP2Actions = parsed.actions;
        }
      }
    } catch (err) {
      console.error("[BattleManager] Failed to parse request:", err);
    }
  }

  private async handleAITurn() {
    if (!this.ai || !this.pendingP2Actions) return;

    // Add a small delay for realism
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));

    const aiAction = await this.ai.chooseAction(this.state, this.pendingP2Actions);
    const choice = actionToChoice(aiAction);
    this.stream.write(`>p2 ${choice}`);
    this.pendingP2Actions = null;
  }

  private async waitForUpdate(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.resolveReady = resolve;
      // Also resolve if battle has ended
      if (this.state.phase === "ended") {
        this.resolveReady = null;
        resolve();
      }
    });
  }
}

function actionToChoice(action: BattleAction): string {
  if (action.type === "move") {
    let choice = `move ${action.moveIndex}`;
    if (action.tera) choice += " terastallize";
    if (action.mega) choice += " mega";
    if (action.targetSlot != null) choice += ` ${action.targetSlot}`;
    return choice;
  }
  return `switch ${action.pokemonIndex}`;
}

function escapeTeam(team: string): string {
  return team.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
