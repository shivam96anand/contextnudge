import fs from "node:fs";
import path from "node:path";
import type { IDEAdapter } from "./base.js";

const INTELLIJ_INSTRUCTIONS = `# ContextNudge – Local Memory Instructions

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

export class IntelliJAdapter implements IDEAdapter {
  name = "intellij";

  detect(): boolean {
    return true;
  }

  async writeMcpConfig(workspaceRoot: string): Promise<void> {
    const ideaDir = path.join(workspaceRoot, ".idea");
    const mcpPath = path.join(ideaDir, "mcp.json");

    if (!fs.existsSync(ideaDir)) {
      fs.mkdirSync(ideaDir, { recursive: true });
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
    const juniePath = path.join(workspaceRoot, "JUNIE.md");

    if (fs.existsSync(juniePath)) {
      const existing = fs.readFileSync(juniePath, "utf-8");
      if (existing.includes("ContextNudge")) {
        return;
      }
      fs.writeFileSync(juniePath, existing.trimEnd() + "\n\n" + INTELLIJ_INSTRUCTIONS);
    } else {
      fs.writeFileSync(juniePath, INTELLIJ_INSTRUCTIONS);
    }
  }

  async validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    const mcpPath = path.join(workspaceRoot, ".idea", "mcp.json");
    if (!fs.existsSync(mcpPath)) {
      issues.push("Missing .idea/mcp.json — run `contextnudge init intellij`");
    } else {
      try {
        const config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
        if (!config.mcpServers?.contextnudge) {
          issues.push(".idea/mcp.json exists but missing contextnudge server entry");
        }
      } catch {
        issues.push(".idea/mcp.json is not valid JSON");
      }
    }

    const juniePath = path.join(workspaceRoot, "JUNIE.md");
    if (!fs.existsSync(juniePath)) {
      issues.push("Missing JUNIE.md");
    } else {
      const content = fs.readFileSync(juniePath, "utf-8");
      if (!content.includes("ContextNudge")) {
        issues.push("JUNIE.md exists but missing ContextNudge section");
      }
    }

    return { valid: issues.length === 0, issues };
  }
}