import { Command } from "commander";
import { forgetMemory, getMemory } from "../../core/memory.js";
import { getDatabase } from "../../storage/db.js";

export function forgetCommand(): Command {
  const cmd = new Command("forget");

  cmd
    .description("Delete a memory permanently")
    .argument("<id>", "Memory ID to delete")
    .action((id: string) => {
      getDatabase();

      const memory = getMemory(id);
      if (!memory) {
        console.error(`✗ Memory "${id}" not found.`);
        process.exit(1);
      }

      forgetMemory(id);
      console.log(`✓ Forgotten: "${memory.summary}"`);
    });

  return cmd;
}
