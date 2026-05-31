#!/usr/bin/env node

import { createCli } from "./cli/index.js";
import { startMcpServer } from "./mcp-server/index.js";

const args = process.argv.slice(2);

// If --mcp flag is present, start the MCP server instead of CLI
if (args.includes("--mcp")) {
  startMcpServer().catch((error) => {
    console.error("[contextnudge] Fatal error:", error);
    process.exit(1);
  });
} else {
  const program = createCli();
  program.parse();
}
