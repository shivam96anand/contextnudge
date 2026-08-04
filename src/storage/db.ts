import Database from "better-sqlite3";
import { getDbPath } from "./paths.js";
import type { Memory, MemoryScope, MemoryStatus } from "../types.js";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = initDatabase();
  }
  return db;
}

export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDbPath();
  const database = new Database(resolvedPath);

  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  runMigrations(database);

  return database;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const currentVersion = database
    .prepare("SELECT MAX(version) as v FROM schema_version")
    .get() as { v: number | null } | undefined;

  const version = currentVersion?.v ?? 0;

  if (version < 1) {
    // Must be atomic. SQLite auto-commits each statement in exec(), so a
    // partial failure previously left the schema built with no version row —
    // every later run re-entered this block and threw "table memories already
    // exists", permanently bricking the database with no recovery path.
    const migrate = database.transaction(() => {
      database.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'workspace',
        workspace_path TEXT,
        repo_identifier TEXT,
        file_pattern TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'user',
        confidence REAL NOT NULL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_used_at TEXT,
        last_verified_at TEXT,
        expires_at TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        summary,
        tags,
        content='memories',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, summary, tags)
        VALUES (new.rowid, new.summary, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, summary, tags)
        VALUES ('delete', old.rowid, old.summary, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, summary, tags)
        VALUES ('delete', old.rowid, old.summary, old.tags);
        INSERT INTO memories_fts(rowid, summary, tags)
        VALUES (new.rowid, new.summary, new.tags);
      END;

      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_path);
      CREATE INDEX IF NOT EXISTS idx_memories_repo ON memories(repo_identifier);
      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
      CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);

      INSERT OR IGNORE INTO schema_version (version) VALUES (1);
    `);
    });
    migrate();
  }
}

export interface MemoryRow {
  id: string;
  summary: string;
  scope: string;
  workspace_path: string | null;
  repo_identifier: string | null;
  file_pattern: string | null;
  tags: string;
  source: string;
  confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  last_verified_at: string | null;
  expires_at: string | null;
}

export function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    summary: row.summary,
    scope: row.scope as MemoryScope,
    workspacePath: row.workspace_path,
    repoIdentifier: row.repo_identifier,
    filePattern: row.file_pattern,
    tags: JSON.parse(row.tags) as string[],
    source: row.source,
    confidence: row.confidence,
    status: row.status as MemoryStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    lastVerifiedAt: row.last_verified_at,
    expiresAt: row.expires_at,
  };
}

export function insertMemory(
  database: Database.Database,
  memory: Memory
): void {
  const stmt = database.prepare(`
    INSERT INTO memories (id, summary, scope, workspace_path, repo_identifier, file_pattern, tags, source, confidence, status, created_at, updated_at, last_used_at, last_verified_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    memory.id,
    memory.summary,
    memory.scope,
    memory.workspacePath,
    memory.repoIdentifier,
    memory.filePattern,
    JSON.stringify(memory.tags),
    memory.source,
    memory.confidence,
    memory.status,
    memory.createdAt,
    memory.updatedAt,
    memory.lastUsedAt,
    memory.lastVerifiedAt,
    memory.expiresAt
  );
}

export function findActiveDuplicateMemory(
  database: Database.Database,
  fingerprint: {
    summary: string;
    scope: MemoryScope;
    workspacePath: string | null;
    repoIdentifier: string | null;
    filePattern: string | null;
  }
): Memory | null {
  const row = database
    .prepare(
      `SELECT * FROM memories
       WHERE status = 'active'
         AND lower(summary) = lower(?)
         AND scope = ?
         AND workspace_path IS ?
         AND repo_identifier IS ?
         AND file_pattern IS ?
       LIMIT 1`
    )
    .get(
      fingerprint.summary,
      fingerprint.scope,
      fingerprint.workspacePath,
      fingerprint.repoIdentifier,
      fingerprint.filePattern
    ) as MemoryRow | undefined;

  return row ? rowToMemory(row) : null;
}

export function getMemoryById(
  database: Database.Database,
  id: string
): Memory | null {
  const row = database
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as MemoryRow | undefined;
  return row ? rowToMemory(row) : null;
}

export function updateMemoryRow(
  database: Database.Database,
  id: string,
  updates: Partial<
    Pick<
      MemoryRow,
      | "summary"
      | "scope"
      | "tags"
      | "file_pattern"
      | "expires_at"
      | "confidence"
      | "status"
      | "updated_at"
      | "last_used_at"
      | "last_verified_at"
    >
  >
): boolean {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return false;

  values.push(id);
  const result = database
    .prepare(`UPDATE memories SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  return result.changes > 0;
}

export function deleteMemory(
  database: Database.Database,
  id: string
): boolean {
  const result = database
    .prepare("DELETE FROM memories WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

export function listMemoriesFromDb(
  database: Database.Database,
  filters: {
    scope?: MemoryScope;
    workspacePath?: string;
    repoIdentifier?: string;
    tags?: string[];
    status?: MemoryStatus;
    limit?: number;
    offset?: number;
  }
): Memory[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.scope) {
    conditions.push("scope = ?");
    params.push(filters.scope);
  }
  if (filters.workspacePath) {
    conditions.push("workspace_path = ?");
    params.push(filters.workspacePath);
  }
  if (filters.repoIdentifier) {
    conditions.push("repo_identifier = ?");
    params.push(filters.repoIdentifier);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  // Retention only sweeps periodically, so filter at query time as well —
  // otherwise a past-expiry memory is served until the next sweep runs.
  conditions.push("(expires_at IS NULL OR expires_at > ?)");
  params.push(new Date().toISOString());

  let sql = "SELECT * FROM memories";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY updated_at DESC";
  sql += ` LIMIT ? OFFSET ?`;
  params.push(filters.limit ?? 50);
  params.push(filters.offset ?? 0);

  const rows = database.prepare(sql).all(...params) as MemoryRow[];
  let memories = rows.map(rowToMemory);

  if (filters.tags && filters.tags.length > 0) {
    memories = memories.filter((m) =>
      filters.tags!.some((t) => m.tags.includes(t))
    );
  }

  return memories;
}

export function searchMemoriesFts(
  database: Database.Database,
  query: string,
  filters: {
    scope?: MemoryScope;
    workspacePath?: string;
    repoIdentifier?: string;
    limit?: number;
  }
): Array<MemoryRow & { rank: number }> {
  let sql = `
    SELECT memories.*, memories_fts.rank
    FROM memories_fts
    JOIN memories ON memories.rowid = memories_fts.rowid
    WHERE memories_fts MATCH ?
      AND memories.status = 'active'
      AND (memories.expires_at IS NULL OR memories.expires_at > ?)
  `;
  const params: unknown[] = [query, new Date().toISOString()];

  if (filters.scope) {
    sql += " AND memories.scope = ?";
    params.push(filters.scope);
  }
  if (filters.workspacePath !== undefined) {
    // Only workspace-scoped rows are constrained by workspace identity.
    // `IS` (not `=`) so legacy NULL-keyed rows are correctly excluded.
    sql += " AND (memories.scope != 'workspace' OR memories.workspace_path IS ?)";
    params.push(filters.workspacePath ?? null);
  }
  if (filters.repoIdentifier !== undefined) {
    sql += " AND (memories.scope != 'repo' OR memories.repo_identifier IS ?)";
    params.push(filters.repoIdentifier ?? null);
  }

  sql += " ORDER BY rank LIMIT ?";
  params.push(filters.limit ?? 10);

  return database.prepare(sql).all(...params) as Array<MemoryRow & { rank: number }>;
}

export function expireOldMemories(database: Database.Database): number {
  const now = new Date().toISOString();
  const result = database
    .prepare(
      "UPDATE memories SET status = 'expired' WHERE expires_at IS NOT NULL AND expires_at < ? AND status = 'active'"
    )
    .run(now);
  return result.changes;
}

export function getMemoryStats(
  database: Database.Database
): { total: number; active: number; expired: number; byScope: Record<string, number> } {
  const total = (
    database.prepare("SELECT COUNT(*) as c FROM memories").get() as { c: number }
  ).c;
  const active = (
    database
      .prepare("SELECT COUNT(*) as c FROM memories WHERE status = 'active'")
      .get() as { c: number }
  ).c;
  const expired = (
    database
      .prepare("SELECT COUNT(*) as c FROM memories WHERE status = 'expired'")
      .get() as { c: number }
  ).c;

  const scopeRows = database
    .prepare(
      "SELECT scope, COUNT(*) as c FROM memories WHERE status = 'active' GROUP BY scope"
    )
    .all() as Array<{ scope: string; c: number }>;

  const byScope: Record<string, number> = {};
  for (const row of scopeRows) {
    byScope[row.scope] = row.c;
  }

  return { total, active, expired, byScope };
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
