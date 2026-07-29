# ContextNudge – Copilot Instructions

## What this project is

ContextNudge is a local-first personal memory layer for AI coding agents. It exposes a local SQLite-backed memory store through an MCP (Model Context Protocol) server, and a CLI for developers to manage memories. The same binary serves as both CLI (`contextnudge <command>`) and MCP server (`contextnudge --mcp`).

## Architecture

```
src/
├── index.ts               # Entry: routes --mcp to MCP server, else CLI
├── types.ts               # Shared interfaces: Memory, SearchResult, IDEAdapter, etc.
├── storage/
│   ├── db.ts              # SQLite (better-sqlite3) + FTS5 virtual table, migrations, CRUD
│   └── paths.ts           # ~/.contextnudge/ path resolution
├── safety/
│   └── secret-scanner.ts  # Regex-based secret detection — rejects saves with credentials
├── core/
│   └── memory.ts          # Business logic: saveMemory, searchMemory, forgetMemory, etc.
├── retrieval/
│   └── ranker.ts          # FTS5 search + composite scoring (scope, recency, tags, file pattern)
├── mcp-server/
│   ├── server.ts          # MCP tool definitions: search_memory, save_memory, forget_memory, list_memories, update_memory
│   └── index.ts           # StdioServerTransport wiring
├── adapters/
│   ├── base.ts            # IDEAdapter interface
│   ├── vscode.ts          # Writes .vscode/mcp.json + .github/copilot-instructions.md
│   ├── cursor.ts          # Writes .cursor/mcp.json + .cursorrules
│   ├── windsurf.ts        # Writes .windsurf/mcp.json + .windsurfrules
│   ├── claude.ts          # Writes claude_desktop_config.json + CLAUDE.md
│   ├── claude-code.ts     # Writes .mcp.json + CLAUDE.md (Claude Code CLI / VS Code extension)
│   └── index.ts           # Adapter registry, getAdapter(), getAllAdapters()
└── cli/
    ├── index.ts            # Commander program
    └── commands/           # init, remember, search, list, forget, status, export, doctor
```

## Key conventions

- **Language**: TypeScript with strict mode. ESM only (`"type": "module"`). Node16 module resolution — always use `.js` extensions on local imports even for `.ts` files.
- **Package manager**: pnpm. Never suggest npm or yarn for this project.
- **Build**: `pnpm build` (tsc + chmod 755 dist/index.js). Output goes to `dist/`.
- **Tests**: vitest (`pnpm test`). Test files go in `tests/` or alongside source as `*.test.ts`.
- **Node version**: ≥18. Uses native `fetch` and `fs/promises`.
- **No top-level await in non-async functions**. Action handlers in Commander must be `async` if they use await.

## Storage conventions

- Database lives at `~/.contextnudge/contextnudge.sqlite`. Never hardcode this path — always use `getDbPath()` from `src/storage/paths.ts`.
- All migrations run in `runMigrations()` in `src/storage/db.ts`. Increment `schema_version` for every schema change.
- FTS5 virtual table `memories_fts` is kept in sync via triggers. Never manually INSERT into it.
- `better-sqlite3` is synchronous by design. Do not wrap its calls in Promises unnecessarily.
- When adding columns to the `memories` table, add them in a new migration block (version check), not by modifying the existing `CREATE TABLE` statement.

## MCP server conventions

- All MCP tools are registered in `src/mcp-server/server.ts` using `server.tool()`.
- Tool input schemas use Zod v3. Do not mix Zod v4 imports.
- **Never use `console.log()` in the MCP server path** — it writes to stdout and corrupts JSON-RPC. Use `console.error()` or write to the log file at `~/.contextnudge/logs/`.
- The MCP server is launched via `npx -y contextnudge --mcp` in all IDE adapter configs. Do not change this pattern.
- Tool responses must always return `{ content: [{ type: "text", text: "..." }] }`. Include `isError: true` for error responses.

## IDE adapter conventions

- Adding a new IDE adapter means: create `src/adapters/<ide>.ts` implementing `IDEAdapter`, then register it in `src/adapters/index.ts`.
- Each adapter is responsible for: writing the MCP config file for that IDE, and writing/appending the AI instruction file (`.cursorrules`, `CLAUDE.md`, etc.).
- Adapters must be idempotent — running `init` twice on the same workspace should not duplicate config or instructions.
- The ContextNudge section in instruction files is delimited with `ContextNudge` keyword markers. Check for this string before appending to avoid duplicates.

## Security rules

- The secret scanner in `src/safety/secret-scanner.ts` must run before every memory save. Never bypass it.
- Never add network calls. This tool is local-only. No telemetry, no cloud sync.
- Never log memory content to files unless explicitly requested and the content is already in the DB.
- Do not store full stack traces, raw chat content, credentials, tokens, or customer data.

## CLI conventions

- Every command calls `getDatabase()` at the start to ensure the DB is initialised.
- Use `process.exit(1)` on fatal errors in CLI commands. Do not throw unhandled exceptions.
- Output goes to stdout. Diagnostic/error messages go to stderr via `console.error()`.
- Progress indicators use `✓` for success and `✗` for failure.

## What not to do

- Do not add a web server or HTTP endpoints in v1.
- Do not add cloud sync, team sharing, or telemetry.
- Do not store raw conversation transcripts.
- Do not add vector embeddings or an embedding model dependency in v1 — FTS5 + heuristic scoring is intentional.
- Do not modify the generated adapter instruction files in `src/adapters/` to include project-specific rules — they are templates for user repos, not for this codebase.


<!-- ContextNudge: Auto-generated instructions for GitHub Copilot -->
<!-- Do not remove this section if you want Copilot to use your local memory -->

## ContextNudge – Local Memory Instructions

**At the start of every task, before any other tool call, run `search_memory` first.** Build the query from the user request plus the workspace name, repository identity, active file path, and any relevant error text. Once results return, use only the memories that are clearly relevant and ignore stale or low-confidence ones — but always run the search, even for small tasks.

If `search_memory` returns nothing, this workspace has no memories yet. Treat the task as a chance to seed them and plan to save what you learn.

**At the end of a task, call `save_memory`** whenever you established something durable and reusable: a stable repo convention, a recurring fix, a confirmed build or test command, an architectural decision, or a personal coding preference. Only skip saving when nothing durable came out of the task — do not save filler just to save something.

Save one atomic memory per call:
- Prefer one actionable fact, not a paragraph, checklist, or multi-topic dump.
- Keep summaries concise and specific; include exact command/flag/class names when relevant.
- Use scope intentionally: `repo` for repository-wide facts, `workspace` for local workspace details, `file-pattern` for file-specific rules, and `global` only for cross-project preferences.
- Add 1-3 useful tags (for example: build, test, runtime, architecture, troubleshooting, security, workflow).
- Set lower confidence for inferred or partially verified details.
- Use expiration for volatile details (temporary env vars, rotating endpoints, short-lived workarounds).

**Never save**: secrets, credentials, tokens, API keys, customer data, personal data, raw chat transcripts, full stack traces, or temporary guesses.

<!-- End ContextNudge -->
