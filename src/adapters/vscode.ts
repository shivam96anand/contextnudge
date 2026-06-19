import fs from "node:fs";
import path from "node:path";
import type { IDEAdapter } from "./base.js";
import { MEMORY_INSTRUCTIONS_BODY } from "./instructions.js";

const MCP_CONFIG = {
  servers: {
    contextnudge: {
      type: "stdio",
      command: "npx",
      args: ["-y", "contextnudge@latest", "--mcp"],
    },
  },
};

const COPILOT_MARKER = "<!-- ContextNudge: Auto-generated instructions for GitHub Copilot -->";

const COPILOT_INSTRUCTIONS = `${COPILOT_MARKER}
<!-- Do not remove this section if you want Copilot to use your local memory -->

## ContextNudge – Local Memory Instructions

${MEMORY_INSTRUCTIONS_BODY}

<!-- End ContextNudge -->
`;

export class VSCodeAdapter implements IDEAdapter {
  name = "vscode";

  detect(): boolean {
    // VS Code is assumed available if the user ran init vscode
    return true;
  }

  async writeMcpConfig(workspaceRoot: string): Promise<void> {
    const vscodeDir = path.join(workspaceRoot, ".vscode");
    const mcpPath = path.join(vscodeDir, "mcp.json");

    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    if (fs.existsSync(mcpPath)) {
      // Merge with existing config
      const existing = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      existing.servers = existing.servers ?? {};
      existing.servers.contextnudge = MCP_CONFIG.servers.contextnudge;
      fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n");
    } else {
      fs.writeFileSync(mcpPath, JSON.stringify(MCP_CONFIG, null, 2) + "\n");
    }
  }

  async writeInstructions(workspaceRoot: string): Promise<void> {
    const githubDir = path.join(workspaceRoot, ".github");
    const instructionsPath = path.join(githubDir, "copilot-instructions.md");

    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }

    if (fs.existsSync(instructionsPath)) {
      const existing = fs.readFileSync(instructionsPath, "utf-8");
      if (existing.includes(COPILOT_MARKER)) {
        // Already has our section, skip
        return;
      }
      // Append our section
      fs.writeFileSync(
        instructionsPath,
        existing.trimEnd() + "\n\n" + COPILOT_INSTRUCTIONS
      );
    } else {
      fs.writeFileSync(instructionsPath, COPILOT_INSTRUCTIONS);
    }
  }

  async validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const mcpPath = path.join(workspaceRoot, ".vscode", "mcp.json");
    if (!fs.existsSync(mcpPath)) {
      issues.push("Missing .vscode/mcp.json — run `contextnudge init vscode`");
    } else {
      try {
        const config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
        if (!config.servers?.contextnudge) {
          issues.push(".vscode/mcp.json exists but missing contextnudge server entry");
        }
      } catch {
        issues.push(".vscode/mcp.json is not valid JSON");
      }
    }

    const instructionsPath = path.join(workspaceRoot, ".github", "copilot-instructions.md");
    if (!fs.existsSync(instructionsPath)) {
      issues.push("Missing .github/copilot-instructions.md");
    } else {
      const content = fs.readFileSync(instructionsPath, "utf-8");
      if (!content.includes(COPILOT_MARKER)) {
        issues.push("copilot-instructions.md exists but missing ContextNudge section");
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
