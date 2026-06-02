import fs from "node:fs";
import path from "node:path";
import type { IDEAdapter } from "./base.js";

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

const COPILOT_INSTRUCTIONS = `<!-- ContextNudge: Auto-generated instructions for GitHub Copilot -->
<!-- Do not remove this section if you want Copilot to use your local memory -->

## ContextNudge – Local Memory Instructions

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
