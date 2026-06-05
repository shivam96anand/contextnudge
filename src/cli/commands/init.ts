import { Command } from "commander";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { getAdapter, getAllAdapterNames, getAllAdapters } from "../../adapters/index.js";
import { getDataDir } from "../../storage/paths.js";
import { initDatabase } from "../../storage/db.js";

export function initCommand(): Command {
  const cmd = new Command("init");

  cmd
    .description("Initialize ContextNudge for an IDE (vscode, cursor, windsurf, claude, intellij)")
    .argument("[ide]", `IDE to configure (${getAllAdapterNames().join(", ")}, or --all)`)
    .option("--all", "Configure all detected IDEs")
    .action(async (ide: string | undefined, options: { all?: boolean }) => {
      const cwd = process.cwd();
      const gitRoot = detectGitRoot(cwd);
      const workspaceRoot = gitRoot ?? cwd;

      // Ensure data directory and database exist
      const dataDir = getDataDir();
      initDatabase();
      console.log(`✓ Data directory: ${dataDir}`);
      if (gitRoot) {
        console.log(`✓ Target workspace (git root): ${workspaceRoot}`);
      } else {
        console.warn(`! No git root detected from ${cwd}; using current directory as workspace root.`);
        console.log(`✓ Target workspace (cwd fallback): ${workspaceRoot}`);
      }

      if (options.all) {
        const adapters = getAllAdapters();
        for (const adapter of adapters) {
          try {
            await adapter.writeMcpConfig(workspaceRoot);
            await adapter.writeInstructions(workspaceRoot);
            reportAdapterOutputs(adapter.name, workspaceRoot);
            console.log(`✓ Configured ${adapter.name}`);
          } catch (error) {
            console.error(`✗ Failed to configure ${adapter.name}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } else if (ide) {
        const adapter = getAdapter(ide);
        if (!adapter) {
          console.error(`Unknown IDE: "${ide}". Supported: ${getAllAdapterNames().join(", ")}`);
          process.exit(1);
        }

        await adapter.writeMcpConfig(workspaceRoot);
        await adapter.writeInstructions(workspaceRoot);
        reportAdapterOutputs(adapter.name, workspaceRoot);
        console.log(`✓ Configured ${adapter.name}`);
      } else {
        console.error(`Please specify an IDE: contextnudge init <${getAllAdapterNames().join("|")}>`);
        console.error("Or use --all to configure all IDEs.");
        process.exit(1);
      }

      console.log("\n🎉 ContextNudge is ready!");
      console.log("\nNext steps:");
      console.log("  1. Open your IDE — the MCP server will start automatically");
      console.log('  2. Try: npx contextnudge remember "This repo uses pnpm, not npm."');
      console.log("  3. Ask your AI assistant a repo-specific question — it will check memory first");
    });

  return cmd;
}

function detectGitRoot(cwd: string): string | null {
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();

    return gitRoot.length > 0 ? gitRoot : null;
  } catch {
    return null;
  }
}

function reportAdapterOutputs(adapterName: string, workspaceRoot: string): void {
  const expectedPaths = getExpectedOutputPaths(adapterName, workspaceRoot);
  if (expectedPaths.length === 0) {
    return;
  }

  const missing = expectedPaths.filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    console.error("✗ Expected output files were not found:");
    for (const filePath of missing) {
      console.error(`  - ${filePath}`);
    }
    throw new Error(`Init completed for ${adapterName}, but required output files are missing.`);
  }

  console.log("  Output files:");
  for (const filePath of expectedPaths) {
    console.log(`  - ${filePath}`);
  }
}

function getExpectedOutputPaths(adapterName: string, workspaceRoot: string): string[] {
  switch (adapterName) {
    case "vscode":
      return [
        path.join(workspaceRoot, ".vscode", "mcp.json"),
        path.join(workspaceRoot, ".github", "copilot-instructions.md"),
      ];
    case "cursor":
      return [
        path.join(workspaceRoot, ".cursor", "mcp.json"),
        path.join(workspaceRoot, ".cursorrules"),
      ];
    case "windsurf":
      return [
        path.join(workspaceRoot, ".windsurf", "mcp.json"),
        path.join(workspaceRoot, ".windsurfrules"),
      ];
    case "claude": {
      const claudeConfigPath = getClaudeConfigPath();
      if (!claudeConfigPath) {
        return [path.join(workspaceRoot, "CLAUDE.md")];
      }
      return [claudeConfigPath, path.join(workspaceRoot, "CLAUDE.md")];
    }
    case "intellij":
      return [
        path.join(workspaceRoot, ".idea", "mcp.json"),
        path.join(workspaceRoot, "JUNIE.md"),
      ];
    default:
      return [];
  }
}

function getClaudeConfigPath(): string | null {
  const platform = os.platform();

  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  }

  if (platform === "linux") {
    return path.join(
      os.homedir(),
      ".config",
      "Claude",
      "claude_desktop_config.json"
    );
  }

  if (platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }

  return null;
}
