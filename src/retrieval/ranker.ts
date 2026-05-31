import { getDatabase } from "../storage/db.js";
import { searchMemoriesFts, rowToMemory, type MemoryRow } from "../storage/db.js";
import { markMemoryUsed } from "../core/memory.js";
import type { SearchMemoryInput, SearchResult } from "../types.js";

export function searchMemory(input: SearchMemoryInput): SearchResult[] {
  const db = getDatabase();
  const limit = input.limit ?? 5;

  // Build FTS5 query: tokenize the user query into terms
  const ftsQuery = buildFtsQuery(input.query);
  if (!ftsQuery) {
    return [];
  }

  let rows: Array<ReturnType<typeof searchMemoriesFts>[number]>;
  try {
    rows = searchMemoriesFts(db, ftsQuery, {
      workspacePath: input.workspacePath,
      repoIdentifier: input.repoIdentifier,
      limit: limit * 3, // fetch more for re-ranking
    });
  } catch {
    // FTS query syntax error — fall back to simple LIKE search
    rows = fallbackSearch(db, input);
  }

  // Score and rank results
  const scored: SearchResult[] = rows.map((row) => {
    const memory = rowToMemory(row);
    const score = computeScore(row.rank, memory, input);
    const matchReason = buildMatchReason(memory, input);
    return { memory, score, matchReason };
  });

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, limit);

  // Mark returned memories as used
  for (const r of results) {
    markMemoryUsed(r.memory.id);
  }

  return results;
}

function buildFtsQuery(query: string): string {
  // Tokenize: split on whitespace, remove short words, wrap in quotes for phrase-ish matching
  const terms = query
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"`)
    .slice(0, 10); // cap terms to prevent abuse

  if (terms.length === 0) return "";

  // OR join for broader matching
  return terms.join(" OR ");
}

function computeScore(
  ftsRank: number,
  memory: ReturnType<typeof rowToMemory>,
  input: SearchMemoryInput
): number {
  let score = 0;

  // FTS relevance (rank is negative, closer to 0 = better)
  score += Math.max(0, 10 + ftsRank * 5);

  // Scope match bonus
  if (input.workspacePath && memory.workspacePath === input.workspacePath) {
    score += 5;
  }
  if (input.repoIdentifier && memory.repoIdentifier === input.repoIdentifier) {
    score += 4;
  }
  if (memory.scope === "global") {
    score += 1; // global memories always mildly relevant
  }

  // File path relevance
  if (input.activeFilePath && memory.filePattern) {
    if (matchesFilePattern(input.activeFilePath, memory.filePattern)) {
      score += 6;
    }
  }

  // Tag overlap
  if (input.tags && input.tags.length > 0) {
    const overlap = input.tags.filter((t) => memory.tags.includes(t)).length;
    score += overlap * 2;
  }

  // Recency bonus (used in last 7 days)
  if (memory.lastUsedAt) {
    const daysSinceUse =
      (Date.now() - new Date(memory.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUse < 7) score += 2;
    else if (daysSinceUse < 30) score += 1;
  }

  // Confidence weighting
  score *= memory.confidence;

  return score;
}

function matchesFilePattern(filePath: string, pattern: string): boolean {
  // Simple glob-ish matching: support * and **
  const regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{DOUBLESTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{DOUBLESTAR\}\}/g, ".*");
  try {
    return new RegExp(regex).test(filePath);
  } catch {
    return filePath.includes(pattern);
  }
}

function buildMatchReason(
  memory: ReturnType<typeof rowToMemory>,
  input: SearchMemoryInput
): string {
  const reasons: string[] = [];

  if (input.workspacePath && memory.workspacePath === input.workspacePath) {
    reasons.push("workspace match");
  }
  if (input.repoIdentifier && memory.repoIdentifier === input.repoIdentifier) {
    reasons.push("repo match");
  }
  if (input.activeFilePath && memory.filePattern) {
    if (matchesFilePattern(input.activeFilePath, memory.filePattern)) {
      reasons.push("file pattern match");
    }
  }
  if (input.tags && input.tags.some((t) => memory.tags.includes(t))) {
    reasons.push("tag match");
  }

  reasons.push("text relevance");
  return reasons.join(", ");
}

function fallbackSearch(
  db: ReturnType<typeof getDatabase>,
  input: SearchMemoryInput
): Array<MemoryRow & { rank: number }> {
  const terms = input.query
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 5);

  if (terms.length === 0) return [];

  const conditions = terms.map(() => "summary LIKE ?");
  const params = terms.map((t) => `%${t}%`);

  let sql = `SELECT *, -1.0 as rank FROM memories WHERE status = 'active' AND (${conditions.join(" OR ")})`;

  if (input.workspacePath) {
    sql += " AND (workspace_path = ? OR workspace_path IS NULL)";
    params.push(input.workspacePath);
  }

  sql += " LIMIT 20";

  return db.prepare(sql).all(...params) as Array<MemoryRow & { rank: number }>;
}
