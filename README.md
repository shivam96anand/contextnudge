# ContextNudge

> Local-first personal memory for AI coding agents.

ContextNudge gives GitHub Copilot, Cursor, Windsurf, Claude, and IntelliJ AI Assistant a private local memory of your developer context — repo conventions, recurring fixes, build commands, architectural decisions, and personal preferences — so you never have to explain the same thing twice.

**No cloud. No team sharing. No raw chat logging. Just your memory, on your machine.**

---

## How it works

```
You run:  npx -y contextnudge init vscode

ContextNudge:
  1. Creates a local SQLite database at ~/.contextnudge/
  2. Writes .vscode/mcp.json  →  tells VS Code to start the local MCP server
  3. Writes .github/copilot-instructions.md  →  tells Copilot to check memory first

Later, when you ask Copilot something repo-specific:
  Copilot → calls search_memory MCP tool → gets relevant context → uses it
  Copilot → discovers a convention → calls save_memory → saved for next time
```

Memory is stored locally, scoped to your workspace or repo, and never leaves your machine.

---

## Quick start

No global install required.

```bash
# Initialize for VS Code + GitHub Copilot
npx -y contextnudge init vscode

# Save your first memory
npx -y contextnudge remember "This repo uses pnpm, not npm."

# Search memories
npx -y contextnudge search "how do I run tests here?"
```

Restart VS Code after init — the MCP server starts automatically and Copilot will begin checking your memory.
You only need to run init once per repository (or again if config files were removed).

---

## IDE support

| IDE | Command | MCP config | Instruction file |
|-----|---------|------------|-----------------|
| VS Code + Copilot | `init vscode` | `.vscode/mcp.json` | `.github/copilot-instructions.md` |
| Cursor | `init cursor` | `.cursor/mcp.json` | `.cursorrules` |
| Windsurf | `init windsurf` | `.windsurf/mcp.json` | `.windsurfrules` |
| Claude Desktop | `init claude` | `~/Library/.../Claude/claude_desktop_config.json` | `CLAUDE.md` |
| IntelliJ + AI Assistant | `init intellij` | `.idea/mcp.json` | `JUNIE.md` |

```bash
# Configure a single IDE
npx -y contextnudge init cursor

# Configure all IDEs at once
npx -y contextnudge init --all
```

---

## CLI reference

```bash
npx -y contextnudge init <ide>           # Set up IDE integration (vscode, cursor, windsurf, claude, intellij)
npx -y contextnudge init --all           # Configure all supported IDEs

npx -y contextnudge remember "<text>"    # Save a memory
  --scope   global|workspace|repo|file-pattern   (default: workspace)
  --workspace <path>                  Workspace path this memory applies to
  --repo <owner/repo>                 Repo identifier
  --tags <tag1,tag2>                  Tags for categorization
  --file-pattern <glob>               File pattern (for file-pattern scope)

npx -y contextnudge search "<query>"     # Search memories
npx -y contextnudge list                 # List all memories
npx -y contextnudge forget <id>          # Delete a memory
npx -y contextnudge status               # Show database stats
npx -y contextnudge export               # Export all memories as JSON
npx -y contextnudge doctor               # Diagnose setup issues
```

---

## Memory scopes

| Scope | When to use |
|-------|-------------|
| `workspace` | Applies to this local folder (default) |
| `repo` | Applies to a repo regardless of where it's cloned |
| `global` | Applies across all your coding work |
| `file-pattern` | Applies only to files matching a glob (e.g. `**/*.test.ts`) |

---

## Good memories to save

```bash
npx -y contextnudge remember "Run integration tests with ./gradlew integrationTest -Pprofile=local." --scope repo
npx -y contextnudge remember "Do not edit generated files under src/generated." --scope repo
npx -y contextnudge remember "CustomerId should be a value object, not a raw string." --scope repo --tags "architecture,domain"
npx -y contextnudge remember "Mongo tests require testcontainers running locally." --scope repo --tags "testing"
npx -y contextnudge remember "I prefer small commits and minimal refactors unless asked." --scope global --tags "preferences"
```

---

## What ContextNudge does NOT store

- Secrets, credentials, API keys, tokens
- Raw chat transcripts
- Customer or personal data
- Full stack traces
- Temporary guesses or one-off task details

The secret scanner runs before every save and rejects memory containing detected credentials.

---

## MCP tools exposed

Copilot and other AI agents interact with ContextNudge through these MCP tools:

| Tool | Description |
|------|-------------|
| `search_memory` | Search local memory before workspace-specific work |
| `save_memory` | Save a stable convention, fix, command, or preference |
| `forget_memory` | Delete an incorrect or stale memory |
| `list_memories` | List memories filtered by scope, workspace, or tags |
| `update_memory` | Edit an existing memory's content, scope, or expiry |

---

## Local storage

```
~/.contextnudge/
├── contextnudge.sqlite   # All memories
├── config.json           # Settings
└── logs/                 # MCP server logs (stderr only)
```

The database is yours. You can inspect it with any SQLite client, export it with `contextnudge export`, or delete it entirely — no account, no sync, no vendor lock-in.

---

## Updates

ContextNudge auto-updates. VS Code (and other IDEs) launch the MCP server via `npx -y contextnudge@latest --mcp`, which fetches the latest published version on IDE restart. No manual update step needed.

If a repository was initialized before this behavior, run `npx -y contextnudge@latest init <ide>` once in that repo to refresh its MCP config.

---

## Privacy

- No network calls from the memory store
- No telemetry
- No cloud sync in v1
- Secret scanner runs before every save
- Memories are scoped — workspace memories never leak into unrelated repos
- Delete everything: `rm -rf ~/.contextnudge`

---

## Architecture

```
contextnudge (single npm package, two modes)
├── CLI mode:   npx contextnudge <command>
└── MCP mode:   npx contextnudge --mcp   (launched by IDE automatically)

src/
├── index.ts          Entry point — routes --mcp flag or runs CLI
├── types.ts          Shared TypeScript interfaces
├── storage/          SQLite + FTS5 database layer
├── safety/           Secret scanner
├── core/             Memory engine (save, search, forget, update)
├── retrieval/        FTS5 search + composite scoring
├── mcp-server/       MCP tool registration + stdio transport
├── adapters/         IDE-specific config writers (vscode, cursor, windsurf, claude, intellij)
└── cli/              Commander CLI commands
```

Search ranking uses FTS5 full-text search combined with heuristic scoring: exact workspace/repo match, active file relevance, tag overlap, recency, and confidence weighting. No vector embeddings or LLM calls — fully offline.

---

## Development

```bash
git clone https://github.com/shivam96anand/contextnudge.git
cd contextnudge
pnpm install
pnpm build
pnpm test
```

```bash
# Run CLI locally
node dist/index.js remember "test memory"

# Run MCP server locally
node dist/index.js --mcp
```

---

## Roadmap

- [ ] `contextnudge update <id>` CLI command
- [ ] `contextnudge import` from exported JSON
- [ ] Retention policy config (custom TTLs per scope)
- [ ] GitHub Actions for npm publish on release tag
- [ ] VS Code Extension marketplace listing
- [ ] Claude Code adapter improvements

---

## License

MIT
