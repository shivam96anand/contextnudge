import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { IDEAdapter } from "./base.js";
import { MEMORY_INSTRUCTIONS_BODY } from "./instructions.js";

const CLAUDE_CODE_INSTRUCTIONS = `# ContextNudge – Local Memory Instructions

${MEMORY_INSTRUCTIONS_BODY}
`;

// Claude Code (CLI and the VS Code extension) reads project-scoped servers from .mcp.json
const MCP_CONFIG = {
  mcpServers: {
    contextnudge: {
      type: "stdio",
      command: "npx",
      args: ["-y", "contextnudge@latest", "--mcp"],
    },
  },
};

export class ClaudeCodeAdapter implements IDEAdapter {
  name = "claude-code";

  detect(): boolean {
    return fs.existsSync(path.join(os.homedir(), ".claude"));
  }

  async writeMcpConfig(workspaceRoot: string): Promise<void> {
    const mcpPath = path.join(workspaceRoot, ".mcp.json");

    if (fs.existsSync(mcpPath)) {
      const existing = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      existing.mcpServers = existing.mcpServers ?? {};
      existing.mcpServers.contextnudge = MCP_CONFIG.mcpServers.contextnudge;
      fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n");
    } else {
      fs.writeFileSync(mcpPath, JSON.stringify(MCP_CONFIG, null, 2) + "\n");
    }
  }

  async writeInstructions(workspaceRoot: string): Promise<void> {
    const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md");

    if (fs.existsSync(claudeMdPath)) {
      const existing = fs.readFileSync(claudeMdPath, "utf-8");
      if (existing.includes("ContextNudge")) {
        return;
      }
      fs.writeFileSync(claudeMdPath, existing.trimEnd() + "\n\n" + CLAUDE_CODE_INSTRUCTIONS);
    } else {
      fs.writeFileSync(claudeMdPath, CLAUDE_CODE_INSTRUCTIONS);
    }
  }

  async validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const mcpPath = path.join(workspaceRoot, ".mcp.json");
    if (!fs.existsSync(mcpPath)) {
      issues.push("Missing .mcp.json — run `contextnudge init claude-code`");
    } else {
      try {
        const config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
        if (!config.mcpServers?.contextnudge) {
          issues.push(".mcp.json exists but missing contextnudge server entry");
        }
      } catch {
        issues.push(".mcp.json is not valid JSON");
      }
    }

    const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md");
    if (!fs.existsSync(claudeMdPath)) {
      issues.push("Missing CLAUDE.md in workspace root");
    } else {
      const content = fs.readFileSync(claudeMdPath, "utf-8");
      if (!content.includes("ContextNudge")) {
        issues.push("CLAUDE.md exists but missing ContextNudge section");
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
