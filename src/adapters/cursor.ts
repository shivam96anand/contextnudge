import fs from "node:fs";
import path from "node:path";
import type { IDEAdapter } from "./base.js";
import { MEMORY_INSTRUCTIONS_BODY } from "./instructions.js";
import { getMcpServerCommand } from "./mcp-command.js";

const CURSOR_RULES = `# ContextNudge – Local Memory Instructions

${MEMORY_INSTRUCTIONS_BODY}
`;

const MCP_CONFIG = () => ({
  mcpServers: {
    contextnudge: getMcpServerCommand(),
  },
});

export class CursorAdapter implements IDEAdapter {
  name = "cursor";

  detect(): boolean {
    return true;
  }

  async writeMcpConfig(workspaceRoot: string): Promise<void> {
    const cursorDir = path.join(workspaceRoot, ".cursor");
    const mcpPath = path.join(cursorDir, "mcp.json");

    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    if (fs.existsSync(mcpPath)) {
      const existing = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      existing.mcpServers = existing.mcpServers ?? {};
      existing.mcpServers.contextnudge = MCP_CONFIG().mcpServers.contextnudge;
      fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n");
    } else {
      fs.writeFileSync(mcpPath, JSON.stringify(MCP_CONFIG(), null, 2) + "\n");
    }
  }

  async writeInstructions(workspaceRoot: string): Promise<void> {
    const rulesPath = path.join(workspaceRoot, ".cursorrules");

    if (fs.existsSync(rulesPath)) {
      const existing = fs.readFileSync(rulesPath, "utf-8");
      if (existing.includes("ContextNudge")) {
        return;
      }
      fs.writeFileSync(rulesPath, existing.trimEnd() + "\n\n" + CURSOR_RULES);
    } else {
      fs.writeFileSync(rulesPath, CURSOR_RULES);
    }
  }

  async validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const mcpPath = path.join(workspaceRoot, ".cursor", "mcp.json");
    if (!fs.existsSync(mcpPath)) {
      issues.push("Missing .cursor/mcp.json — run `contextnudge init cursor`");
    }

    const rulesPath = path.join(workspaceRoot, ".cursorrules");
    if (!fs.existsSync(rulesPath)) {
      issues.push("Missing .cursorrules");
    } else {
      const content = fs.readFileSync(rulesPath, "utf-8");
      if (!content.includes("ContextNudge")) {
        issues.push(".cursorrules exists but missing ContextNudge section");
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
