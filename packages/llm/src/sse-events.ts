export type SSEEvent =
  | { type: "content"; content: string }
  | { type: "tool_start"; name: string; label: string; input: Record<string, unknown> }
  | { type: "tool_end"; name: string }
  | { type: "tool_error"; name: string; error: string }
  | { type: "action_notify"; name: string; label: string; input: Record<string, unknown> }
  | { type: "plan_start"; steps: { text: string }[] }
  | { type: "plan_step_update"; stepIndex: number; status: "active" | "complete" | "skipped" }
  | { type: "session_meta"; sessionId: string; title?: string }
  | { type: "error"; error: string }
  | { type: "done" };
