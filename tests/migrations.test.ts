import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initDatabase } from "../src/storage/db.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cn-migrate-"));
const dbPath = () => path.join(tmp, `${Math.random().toString(36).slice(2)}.sqlite`);

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
});

describe("runMigrations", () => {
  it("creates the schema and stamps the version", () => {
    const p = dbPath();
    const db = initDatabase(p);
    const version = db.prepare("SELECT MAX(version) v FROM schema_version").get() as {
      v: number;
    };
    expect(version.v).toBe(1);
    db.close();
  });

  it("is idempotent across repeated initialisation", () => {
    const p = dbPath();
    for (let i = 0; i < 3; i++) initDatabase(p).close();

    const db = new Database(p);
    const rows = db.prepare("SELECT COUNT(*) c FROM schema_version").get() as {
      c: number;
    };
    expect(rows.c).toBe(1);
    db.close();
  });

  // Regression: `CREATE TABLE memories` had no IF NOT EXISTS and the version
  // stamp was the last statement of the same exec(). SQLite auto-commits each
  // statement, so a partial failure left the table built with no version row.
  // Every later run re-entered the block and threw "table already exists",
  // bricking the database permanently.
  it("recovers from a partially applied migration", () => {
    const p = dbPath();

    // Reproduce the real partial state: the full table exists (it is created
    // first) but the trailing version stamp never landed.
    const raw = new Database(p);
    raw.exec("CREATE TABLE schema_version (version INTEGER PRIMARY KEY);");
    raw.exec(`CREATE TABLE memories (
      id TEXT PRIMARY KEY, summary TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'workspace',
      workspace_path TEXT, repo_identifier TEXT, file_pattern TEXT,
      tags TEXT NOT NULL DEFAULT '[]', source TEXT NOT NULL DEFAULT 'user',
      confidence REAL NOT NULL DEFAULT 1.0, status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_used_at TEXT,
      last_verified_at TEXT, expires_at TEXT);`);
    raw.close();

    expect(() => initDatabase(p).close()).not.toThrow();

    const db = new Database(p);
    const version = db.prepare("SELECT MAX(version) v FROM schema_version").get() as {
      v: number;
    };
    expect(version.v).toBe(1);
    db.close();
  });

  it("rolls back cleanly when the existing schema is incompatible", () => {
    const p = dbPath();
    const raw = new Database(p);
    raw.exec("CREATE TABLE schema_version (version INTEGER PRIMARY KEY);");
    raw.exec("CREATE TABLE memories (id TEXT PRIMARY KEY, summary TEXT NOT NULL);");
    raw.close();

    // The migration cannot complete, but it must fail loudly and leave no
    // half-applied state behind rather than silently corrupting the database.
    expect(() => initDatabase(p)).toThrow();

    const db = new Database(p);
    const stamped = db.prepare("SELECT COUNT(*) c FROM schema_version").get() as {
      c: number;
    };
    expect(stamped.c).toBe(0);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_memories%'")
      .all();
    expect(indexes).toHaveLength(0);
    db.close();
  });

  it("keeps the FTS index in sync through the triggers", () => {
    const db = initDatabase(dbPath());
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, summary, scope, tags, source, confidence,
        status, created_at, updated_at)
       VALUES ('m1', 'pnpm is the package manager', 'global', '[]', 'user',
        1.0, 'active', ?, ?)`
    ).run(now, now);

    const found = db
      .prepare("SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'pnpm'")
      .all();
    expect(found).toHaveLength(1);

    db.prepare("DELETE FROM memories WHERE id = 'm1'").run();
    const afterDelete = db
      .prepare("SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'pnpm'")
      .all();
    expect(afterDelete).toHaveLength(0);
    db.close();
  });
});
