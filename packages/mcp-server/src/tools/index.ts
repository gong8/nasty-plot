import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDataQueryTools } from "./data-query.js";
import { registerAnalysisTools } from "./analysis.js";
import { registerTeamCrudTools } from "./team-crud.js";
import { registerMetaRecsTools } from "./meta-recs.js";

export function registerTools(server: McpServer): void {
  registerDataQueryTools(server);   // 7 tools
  registerAnalysisTools(server);    // 6 tools
  registerTeamCrudTools(server);    // 6 tools
  registerMetaRecsTools(server);    // 5 tools
}
