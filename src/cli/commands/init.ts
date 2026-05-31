import { Command } from "commander";
import { getAdapter, getAllAdapterNames, getAllAdapters } from "../../adapters/index.js";
import { getDataDir } from "../../storage/paths.js";
import { initDatabase } from "../../storage/db.js";

export function initCommand(): Command {
  const cmd = new Command("init");

  cmd
    .description("Initialize ContextNudge for an IDE (vscode, cursor, windsurf, claude)")
    .argument("[ide]", `IDE to configure (${getAllAdapterNames().join(", ")}, or --all)`)
    .option("--all", "Configure all detected IDEs")
    .action(async (ide: string | undefined, options: { all?: boolean }) => {
      const workspaceRoot = process.cwd();

      // Ensure data directory and database exist
      const dataDir = getDataDir();
      initDatabase();
      console.log(`✓ Data directory: ${dataDir}`);

      if (options.all) {
        const adapters = getAllAdapters();
        for (const adapter of adapters) {
          try {
            await adapter.writeMcpConfig(workspaceRoot);
            await adapter.writeInstructions(workspaceRoot);
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
