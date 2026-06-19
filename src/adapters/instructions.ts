/**
 * Shared body for the per-IDE memory instruction templates.
 * Each adapter wraps this with its own heading and/or markers so the
 * wording stays in sync across every IDE that ContextNudge supports.
 */
export const MEMORY_INSTRUCTIONS_BODY = `**At the start of every task, before any other tool call, run \`search_memory\` first.** Build the query from the user request plus the workspace name, repository identity, active file path, and any relevant error text. Once results return, use only the memories that are clearly relevant and ignore stale or low-confidence ones — but always run the search, even for small tasks.

If \`search_memory\` returns nothing, this workspace has no memories yet. Treat the task as a chance to seed them and plan to save what you learn.

**At the end of a task, call \`save_memory\`** whenever you established something durable and reusable: a stable repo convention, a recurring fix, a confirmed build or test command, an architectural decision, or a personal coding preference. Only skip saving when nothing durable came out of the task — do not save filler just to save something.

Save one atomic memory per call:
- Prefer one actionable fact, not a paragraph, checklist, or multi-topic dump.
- Keep summaries concise and specific; include exact command/flag/class names when relevant.
- Use scope intentionally: \`repo\` for repository-wide facts, \`workspace\` for local workspace details, \`file-pattern\` for file-specific rules, and \`global\` only for cross-project preferences.
- Add 1-3 useful tags (for example: build, test, runtime, architecture, troubleshooting, security, workflow).
- Set lower confidence for inferred or partially verified details.
- Use expiration for volatile details (temporary env vars, rotating endpoints, short-lived workarounds).

**Never save**: secrets, credentials, tokens, API keys, customer data, personal data, raw chat transcripts, full stack traces, or temporary guesses.`;
