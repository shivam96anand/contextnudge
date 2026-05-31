import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { IDEAdapter } from "./base.js";

const CLAUDE_INSTRUCTIONS = `# ContextNudge – Local Memory Instructions

Before starting workspace-specific, repo-specific, debugging, testing, setup, refactoring, or architecture work, call the \`search_memory\` tool from the ContextNudge MCP server. Use the current user request, workspace name, repository identity, active file path, and relevant error text as the memory search query. Use retrieved memories only if clearly relevant. Ignore stale, unrelated, or low-confidence memories.

When you discover a stable repo convention, recurring fix, confirmed build/test command, architectural decision, or personal coding preference, call \`save_memory\` with a concise one-sentence summary. Use appropriate scope (workspace, repo, global, or file-pattern) and relevant tags.

**Never save**: secrets, credentials, tokens, API keys, customer data, personal data, raw chat transcripts, full stack traces, or temporary guesses.
`;

export class ClaudeAdapter implements IDEAdapter {
  name = "claude";

  detect(): boolean {
    const configPath = this.getClaudeConfigPath();
    return configPath !== null;
  }

  async writeMcpConfig(workspaceRoot: string): Promise<void> {
    const configPath = this.getClaudeConfigPath();
    if (!configPath) {
      throw new Error("Could not determine Claude Desktop config path for this OS");
    }

    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const serverEntry = {
      command: "npx",
      args: ["-y", "contextnudge", "--mcp"],
    };

    if (fs.existsSync(configPath)) {
      const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      existing.mcpServers = existing.mcpServers ?? {};
      existing.mcpServers.contextnudge = serverEntry;
      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
    } else {
      const config = { mcpServers: { contextnudge: serverEntry } };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    }
  }

  async writeInstructions(workspaceRoot: string): Promise<void> {
    const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md");

    if (fs.existsSync(claudeMdPath)) {
      const existing = fs.readFileSync(claudeMdPath, "utf-8");
      if (existing.includes("ContextNudge")) {
        return;
      }
      fs.writeFileSync(claudeMdPath, existing.trimEnd() + "\n\n" + CLAUDE_INSTRUCTIONS);
    } else {
      fs.writeFileSync(claudeMdPath, CLAUDE_INSTRUCTIONS);
    }
  }

  async validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const configPath = this.getClaudeConfigPath();
    if (!configPath) {
      issues.push("Could not determine Claude Desktop config path");
    } else if (!fs.existsSync(configPath)) {
      issues.push(`Missing Claude config at ${configPath}`);
    } else {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (!config.mcpServers?.contextnudge) {
          issues.push("Claude config exists but missing contextnudge server entry");
        }
      } catch {
        issues.push("Claude config is not valid JSON");
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

  private getClaudeConfigPath(): string | null {
    const platform = os.platform();
    if (platform === "darwin") {
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    } else if (platform === "linux") {
      return path.join(
        os.homedir(),
        ".config",
        "Claude",
        "claude_desktop_config.json"
      );
    } else if (platform === "win32") {
      const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
      return path.join(appData, "Claude", "claude_desktop_config.json");
    }
    return null;
  }
}
