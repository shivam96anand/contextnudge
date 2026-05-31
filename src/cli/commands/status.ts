import { Command } from "commander";
import { getDatabase } from "../../storage/db.js";
import { getMemoryStats } from "../../storage/db.js";
import { getDataDir, getDbPath } from "../../storage/paths.js";

export function statusCommand(): Command {
  const cmd = new Command("status");

  cmd
    .description("Show ContextNudge status and stats")
    .action(() => {
      const dataDir = getDataDir();
      const dbPath = getDbPath();

      console.log("ContextNudge Status\n");
      console.log(`  Data directory: ${dataDir}`);
      console.log(`  Database: ${dbPath}`);

      try {
        const db = getDatabase();
        const stats = getMemoryStats(db);
        console.log(`\n  Memories: ${stats.active} active, ${stats.expired} expired (${stats.total} total)`);
        if (Object.keys(stats.byScope).length > 0) {
          console.log("  By scope:");
          for (const [scope, count] of Object.entries(stats.byScope)) {
            console.log(`    ${scope}: ${count}`);
          }
        }
      } catch (error) {
        console.error(`\n  ✗ Database error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

  return cmd;
}
