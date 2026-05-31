import { Command } from "commander";
import { saveMemory } from "../../core/memory.js";
import { getDatabase } from "../../storage/db.js";
import type { MemoryScope } from "../../types.js";

export function rememberCommand(): Command {
  const cmd = new Command("remember");

  cmd
    .description("Save a memory")
    .argument("<summary>", "The memory to save (one sentence or short paragraph)")
    .option("-s, --scope <scope>", "Memory scope (global, workspace, repo, file-pattern)", "workspace")
    .option("-w, --workspace <path>", "Workspace path this memory applies to")
    .option("-r, --repo <identifier>", "Repository identifier (e.g., owner/repo)")
    .option("-t, --tags <tags>", "Comma-separated tags", (val) => val.split(",").map((t) => t.trim()))
    .option("-p, --file-pattern <pattern>", "File glob pattern (for file-pattern scope)")
    .action((summary: string, options: {
      scope: string;
      workspace?: string;
      repo?: string;
      tags?: string[];
      filePattern?: string;
    }) => {
      // Initialize DB
      getDatabase();

      try {
        const memory = saveMemory({
          summary,
          scope: options.scope as MemoryScope,
          workspacePath: options.workspace ?? process.cwd(),
          repoIdentifier: options.repo,
          filePattern: options.filePattern,
          tags: options.tags,
          source: "cli",
        });

        console.log(`✓ Memory saved [${memory.id}]`);
        console.log(`  "${memory.summary}"`);
        console.log(`  scope: ${memory.scope} | tags: ${memory.tags.join(", ") || "none"}`);
      } catch (error) {
        console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}
