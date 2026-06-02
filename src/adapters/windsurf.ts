import fs from "node:fs";
import path from "node:path";
import type { IDEAdapter } from "./base.js";

const WINDSURF_RULES = `# ContextNudge – Local Memory Instructions

Before starting workspace-specific, repo-specific, debugging, testing, setup, refactoring, or architecture work, call the \`search_memory\` tool from the ContextNudge MCP server. Use the current user request, workspace name, repository identity, active file path, and relevant error text as the memory search query. Use retrieved memories only if clearly relevant. Ignore stale, unrelated, or low-confidence memories.

When you discover a stable repo convention, recurring fix, confirmed build/test command, architectural decision, or personal coding preference, call \`save_memory\`.

Save one atomic memory per call:
- Prefer one actionable fact, not a paragraph, checklist, or multi-topic dump.
- Keep summaries concise and specific; include exact command/flag/class names when relevant.
- Use scope intentionally: \`repo\` for repository-wide facts, \`workspace\` for local workspace details, \`file-pattern\` for file-specific rules, and \`global\` only for cross-project preferences.
- Add 1-3 useful tags (for example: build, test, runtime, architecture, troubleshooting, security, workflow).
- Set lower confidence for inferred or partially verified details.
- Use expiration for volatile details (temporary env vars, rotating endpoints, short-lived workarounds).

**Never save**: secrets, credentials, tokens, API keys, customer data, personal data, raw chat transcripts, full stack traces, or temporary guesses.
`;

const MCP_CONFIG = {
  mcpServers: {
    contextnudge: {
      command: "npx",
      args: ["-y", "contextnudge@latest", "--mcp"],
    },
  },
};

export class WindsurfAdapter implements IDEAdapter {
  name = "windsurf";

  detect(): boolean {
    return true;
  }

  async writeMcpConfig(workspaceRoot: string): Promise<void> {
    const wsDir = path.join(workspaceRoot, ".windsurf");
    const mcpPath = path.join(wsDir, "mcp.json");

    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }

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
    const rulesPath = path.join(workspaceRoot, ".windsurfrules");

    if (fs.existsSync(rulesPath)) {
      const existing = fs.readFileSync(rulesPath, "utf-8");
      if (existing.includes("ContextNudge")) {
        return;
      }
      fs.writeFileSync(rulesPath, existing.trimEnd() + "\n\n" + WINDSURF_RULES);
    } else {
      fs.writeFileSync(rulesPath, WINDSURF_RULES);
    }
  }

  async validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const mcpPath = path.join(workspaceRoot, ".windsurf", "mcp.json");
    if (!fs.existsSync(mcpPath)) {
      issues.push("Missing .windsurf/mcp.json — run `contextnudge init windsurf`");
    }

    const rulesPath = path.join(workspaceRoot, ".windsurfrules");
    if (!fs.existsSync(rulesPath)) {
      issues.push("Missing .windsurfrules");
    } else {
      const content = fs.readFileSync(rulesPath, "utf-8");
      if (!content.includes("ContextNudge")) {
        issues.push(".windsurfrules exists but missing ContextNudge section");
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
