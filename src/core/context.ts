import { execFileSync } from "node:child_process";

/**
 * Scoping must never depend on the model remembering to pass context — both
 * workspacePath and repoIdentifier are optional in the MCP tool schema, and a
 * missing value used to produce a NULL-scoped memory that leaked into every
 * workspace. These resolve the context from the running process instead.
 */
export function resolveWorkspacePath(explicit?: string | null): string {
  return explicit ?? process.cwd();
}

export function resolveRepoIdentifier(
  explicit?: string | null,
  cwd: string = process.cwd()
): string | null {
  if (explicit) return explicit;

  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return remote ? normalizeRemote(remote) : null;
  } catch {
    return null;
  }
}

/** Reduces a git remote to a stable `host/owner/repo` identity. */
export function normalizeRemote(remote: string): string {
  return remote
    .replace(/^git@([^:]+):/, "$1/")
    .replace(/^ssh:\/\/git@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^[^@/]+@/, "")
    .replace(/\.git$/, "")
    .toLowerCase();
}
