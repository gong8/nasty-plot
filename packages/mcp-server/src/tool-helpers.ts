/**
 * Shared helpers for MCP tool handlers that eliminate boilerplate
 * around try/catch, JSON serialization, and content formatting.
 */

type ToolSuccess = {
  [key: string]: unknown;
  content: [{ type: "text"; text: string }];
};

type ToolError = {
  [key: string]: unknown;
  content: [{ type: "text"; text: string }];
  isError: true;
};

type ToolResult = ToolSuccess | ToolError;

/** Wrap a JSON-serializable value as a successful MCP tool response. */
export function toolSuccess(data: unknown): ToolSuccess {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Wrap an error message as a failed MCP tool response. */
export function toolError(message: string): ToolError {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Run an async tool handler with automatic error handling.
 * On success, the returned data is JSON-serialized.
 * On failure, the errorMessage is returned as a tool error.
 */
export async function handleTool(
  fn: () => Promise<unknown>,
  errorMessage: string
): Promise<ToolResult> {
  try {
    const data = await fn();
    return toolSuccess(data);
  } catch {
    return toolError(errorMessage);
  }
}

/**
 * Build a query params object from optional key-value pairs,
 * omitting entries where the value is undefined.
 */
export function buildParams(
  entries: Record<string, string | number | undefined>
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      params[key] = String(value);
    }
  }
  return params;
}
