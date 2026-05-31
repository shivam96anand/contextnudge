import { Command } from "commander";
import fs from "node:fs";
import { listMemories } from "../../core/memory.js";
import { getDatabase } from "../../storage/db.js";

export function exportCommand(): Command {
  const cmd = new Command("export");

  cmd
    .description("Export all memories as JSON")
    .option("-o, --output <file>", "Output file path (default: stdout)")
    .action((options: { output?: string }) => {
      getDatabase();

      const memories = listMemories({ limit: 10000 });
      const json = JSON.stringify(memories, null, 2);

      if (options.output) {
        fs.writeFileSync(options.output, json + "\n");
        console.error(`✓ Exported ${memories.length} memories to ${options.output}`);
      } else {
        console.log(json);
      }
    });

  return cmd;
}
