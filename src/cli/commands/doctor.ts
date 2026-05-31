import { Command } from "commander";
import fs from "node:fs";
import { getAdapter, getAllAdapterNames } from "../../adapters/index.js";
import { getDataDir, getDbPath } from "../../storage/paths.js";
import { getDatabase } from "../../storage/db.js";

export function doctorCommand(): Command {
  const cmd = new Command("doctor");

  cmd
    .description("Validate ContextNudge setup and diagnose issues")
    .action(async () => {
      const workspaceRoot = process.cwd();
      let allGood = true;

      console.log("ContextNudge Doctor\n");

      // Check data directory
      const dataDir = getDataDir();
      if (fs.existsSync(dataDir)) {
        console.log(`  ✓ Data directory exists: ${dataDir}`);
      } else {
        console.log(`  ✗ Data directory missing: ${dataDir}`);
        allGood = false;
      }

      // Check database
      const dbPath = getDbPath();
      if (fs.existsSync(dbPath)) {
        console.log(`  ✓ Database exists: ${dbPath}`);
        try {
          getDatabase();
          console.log("  ✓ Database is accessible");
        } catch (error) {
          console.log(`  ✗ Database error: ${error instanceof Error ? error.message : String(error)}`);
          allGood = false;
        }
      } else {
        console.log(`  ✗ Database missing: ${dbPath}`);
        allGood = false;
      }

      // Check IDE configurations
      console.log("\n  IDE configurations:");
      for (const name of getAllAdapterNames()) {
        const adapter = getAdapter(name)!;
        const result = await adapter.validate(workspaceRoot);
        if (result.valid) {
          console.log(`    ✓ ${name}: configured`);
        } else {
          for (const issue of result.issues) {
            console.log(`    ⚠ ${name}: ${issue}`);
          }
        }
      }

      // Check npx availability
      console.log("\n  Runtime:");
      try {
        const { execSync } = await import("node:child_process");
        execSync("npx --version", { stdio: "pipe" });
        console.log("  ✓ npx is available");
      } catch {
        console.log("  ✗ npx not found — required for MCP server");
        allGood = false;
      }

      console.log(allGood ? "\n✓ All checks passed!" : "\n⚠ Some issues found. Run `contextnudge init <ide>` to fix.");
    });

  return cmd;
}
