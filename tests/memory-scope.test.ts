import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cn-scope-"));
process.env.CONTEXTNUDGE_DATA_DIR = dataDir;

const { saveMemory } = await import("../src/core/memory.js");
const { searchMemory } = await import("../src/retrieval/ranker.js");
const { getDatabase, closeDatabase } = await import("../src/storage/db.js");

const PROJECT_A = "/tmp/project-a";
const PROJECT_B = "/tmp/project-b";

beforeEach(() => {
  getDatabase().exec("DELETE FROM memories");
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("workspace scoping", () => {
  // Regression: workspacePath is optional in the MCP tool schema. When the
  // model omitted it, the memory was stored with workspace_path = NULL and the
  // search filter `workspace_path = ? OR workspace_path IS NULL` matched it in
  // every workspace — so private workspace notes leaked into unrelated repos.
  it("fills in the workspace when the caller omits it", () => {
    const memory = saveMemory({ summary: "alpha convention", scope: "workspace" });
    expect(memory.workspacePath).toBe(process.cwd());
  });

  it("does not leak a workspace memory into an unrelated workspace", () => {
    saveMemory({
      summary: "vault sidecar holds deploy config",
      scope: "workspace",
      workspacePath: PROJECT_A,
    });

    const fromOwner = searchMemory({ query: "vault", workspacePath: PROJECT_A });
    expect(fromOwner.map((r) => r.memory.summary)).toContain(
      "vault sidecar holds deploy config"
    );

    const fromOther = searchMemory({ query: "vault", workspacePath: PROJECT_B });
    expect(fromOther).toHaveLength(0);
  });

  it("still returns global memories from any workspace", () => {
    saveMemory({ summary: "vault preference applies everywhere", scope: "global" });

    for (const workspacePath of [PROJECT_A, PROJECT_B]) {
      const results = searchMemory({ query: "vault", workspacePath });
      expect(results.map((r) => r.memory.summary)).toContain(
        "vault preference applies everywhere"
      );
    }
  });

  it("excludes legacy workspace rows that have a NULL workspace_path", () => {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, summary, scope, workspace_path, tags, source,
        confidence, status, created_at, updated_at)
       VALUES ('legacy1', 'vault legacy leaked note', 'workspace', NULL, '[]',
        'user', 1.0, 'active', ?, ?)`
    ).run(now, now);

    const results = searchMemory({ query: "vault", workspacePath: PROJECT_B });
    expect(results.map((r) => r.memory.id)).not.toContain("legacy1");
  });

  it("keeps repo-scoped memories out of unrelated repos", () => {
    saveMemory({
      summary: "vault rotation runbook lives in ops",
      scope: "repo",
      repoIdentifier: "github.com/acme/alpha",
    });

    const sameRepo = searchMemory({
      query: "vault",
      repoIdentifier: "github.com/acme/alpha",
    });
    expect(sameRepo).toHaveLength(1);

    const otherRepo = searchMemory({
      query: "vault",
      repoIdentifier: "github.com/acme/beta",
    });
    expect(otherRepo).toHaveLength(0);
  });
});
