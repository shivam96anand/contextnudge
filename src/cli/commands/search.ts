import { Command } from "commander";
import { searchMemory } from "../../retrieval/ranker.js";
import { getDatabase } from "../../storage/db.js";

export function searchCommand(): Command {
  const cmd = new Command("search");

  cmd
    .description("Search memories")
    .argument("<query>", "Natural language search query")
    .option("-w, --workspace <path>", "Filter by workspace path")
    .option("-r, --repo <identifier>", "Filter by repo identifier")
    .option("-t, --tags <tags>", "Comma-separated tags to filter by", (val) => val.split(",").map((t) => t.trim()))
    .option("-l, --limit <n>", "Max results", "5")
    .action((query: string, options: {
      workspace?: string;
      repo?: string;
      tags?: string[];
      limit: string;
    }) => {
      getDatabase();

      const results = searchMemory({
        query,
        workspacePath: options.workspace ?? process.cwd(),
        repoIdentifier: options.repo,
        tags: options.tags,
        limit: parseInt(options.limit, 10),
      });

      if (results.length === 0) {
        console.log("No memories found matching your query.");
        return;
      }

      console.log(`Found ${results.length} memor${results.length === 1 ? "y" : "ies"}:\n`);
      for (const r of results) {
        console.log(`  [${r.memory.id}] ${r.memory.summary}`);
        console.log(`    scope: ${r.memory.scope} | confidence: ${r.memory.confidence} | matched: ${r.matchReason}`);
        console.log();
      }
    });

  return cmd;
}
