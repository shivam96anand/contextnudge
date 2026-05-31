import { Command } from "commander";
import { listMemories } from "../../core/memory.js";
import { getDatabase } from "../../storage/db.js";
import type { MemoryScope } from "../../types.js";

export function listCommand(): Command {
  const cmd = new Command("list");

  cmd
    .description("List saved memories")
    .option("-s, --scope <scope>", "Filter by scope")
    .option("-w, --workspace <path>", "Filter by workspace path")
    .option("-r, --repo <identifier>", "Filter by repo identifier")
    .option("-t, --tags <tags>", "Comma-separated tags", (val) => val.split(",").map((t) => t.trim()))
    .option("-l, --limit <n>", "Max results", "20")
    .action((options: {
      scope?: string;
      workspace?: string;
      repo?: string;
      tags?: string[];
      limit: string;
    }) => {
      getDatabase();

      const memories = listMemories({
        scope: options.scope as MemoryScope | undefined,
        workspacePath: options.workspace,
        repoIdentifier: options.repo,
        tags: options.tags,
        limit: parseInt(options.limit, 10),
      });

      if (memories.length === 0) {
        console.log("No memories found.");
        return;
      }

      console.log(`${memories.length} memor${memories.length === 1 ? "y" : "ies"}:\n`);
      for (const m of memories) {
        const age = timeSince(m.createdAt);
        console.log(`  [${m.id}] ${m.summary}`);
        console.log(`    scope: ${m.scope} | tags: ${m.tags.join(", ") || "none"} | ${age}`);
        console.log();
      }
    });

  return cmd;
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
