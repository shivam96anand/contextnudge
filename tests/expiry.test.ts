import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cn-expiry-"));
process.env.CONTEXTNUDGE_DATA_DIR = dataDir;

const { saveMemory, listMemories, runRetention } = await import(
  "../src/core/memory.js"
);
const { searchMemory } = await import("../src/retrieval/ranker.js");
const { getDatabase, closeDatabase } = await import("../src/storage/db.js");

const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

beforeEach(() => {
  getDatabase().exec("DELETE FROM memories");
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("memory expiry", () => {
  // Regression: search only filtered `status = 'active'`, and retention ran
  // once at MCP server startup. Because that process stays alive for days
  // inside the IDE, a memory whose expiresAt had passed kept being served.
  it("does not return a memory whose expiry has passed", () => {
    saveMemory({ summary: "vault override expired", expiresAt: dayFromNow(-1) });
    saveMemory({ summary: "vault override still valid", expiresAt: dayFromNow(1) });
    saveMemory({ summary: "vault permanent convention" });

    const summaries = searchMemory({ query: "vault" }).map((r) => r.memory.summary);

    expect(summaries).not.toContain("vault override expired");
    expect(summaries).toContain("vault override still valid");
    expect(summaries).toContain("vault permanent convention");
  });

  it("hides expired memories from list as well", () => {
    saveMemory({ summary: "expired listing entry", expiresAt: dayFromNow(-1) });
    saveMemory({ summary: "live listing entry" });

    const summaries = listMemories({}).map((m) => m.summary);
    expect(summaries).toEqual(["live listing entry"]);
  });

  it("filters even when retention has not swept yet", () => {
    saveMemory({ summary: "vault unswept entry", expiresAt: dayFromNow(-1) });

    // Row is still status='active' — the query must exclude it regardless.
    const active = getDatabase()
      .prepare("SELECT status FROM memories WHERE summary = 'vault unswept entry'")
      .get() as { status: string };
    expect(active.status).toBe("active");

    expect(searchMemory({ query: "vault" })).toHaveLength(0);
  });

  it("retention marks past-expiry rows as expired", () => {
    saveMemory({ summary: "sweep me", expiresAt: dayFromNow(-1) });
    saveMemory({ summary: "keep me" });

    expect(runRetention()).toBe(1);
  });
});
