import { nanoid } from "nanoid";
import { getDatabase } from "../storage/db.js";
import {
  insertMemory,
  getMemoryById,
  updateMemoryRow,
  deleteMemory,
  listMemoriesFromDb,
  expireOldMemories,
} from "../storage/db.js";
import { scanForSecrets } from "../safety/secret-scanner.js";
import type {
  Memory,
  SaveMemoryInput,
  UpdateMemoryInput,
  ListMemoriesInput,
} from "../types.js";

export function saveMemory(input: SaveMemoryInput): Memory {
  const scan = scanForSecrets(input.summary);
  if (!scan.safe) {
    throw new Error(
      `Memory rejected: detected potential secrets (${scan.detectedSecrets.join(", ")}). ` +
        `Never store credentials, API keys, tokens, or passwords in memory.`
    );
  }

  const now = new Date().toISOString();
  const memory: Memory = {
    id: nanoid(12),
    summary: input.summary.trim(),
    scope: input.scope ?? "workspace",
    workspacePath: input.workspacePath ?? null,
    repoIdentifier: input.repoIdentifier ?? null,
    filePattern: input.filePattern ?? null,
    tags: input.tags ?? [],
    source: input.source ?? "user",
    confidence: input.confidence ?? 1.0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    lastVerifiedAt: now,
    expiresAt: input.expiresAt ?? null,
  };

  const db = getDatabase();
  insertMemory(db, memory);
  return memory;
}

export function getMemory(id: string): Memory | null {
  const db = getDatabase();
  return getMemoryById(db, id);
}

export function updateMemory(input: UpdateMemoryInput): Memory | null {
  const db = getDatabase();
  const existing = getMemoryById(db, input.id);
  if (!existing) return null;

  if (input.summary) {
    const scan = scanForSecrets(input.summary);
    if (!scan.safe) {
      throw new Error(
        `Memory update rejected: detected potential secrets (${scan.detectedSecrets.join(", ")}).`
      );
    }
  }

  const now = new Date().toISOString();
  updateMemoryRow(db, input.id, {
    ...(input.summary !== undefined && { summary: input.summary.trim() }),
    ...(input.scope !== undefined && { scope: input.scope }),
    ...(input.tags !== undefined && { tags: JSON.stringify(input.tags) }),
    ...(input.filePattern !== undefined && { file_pattern: input.filePattern }),
    ...(input.expiresAt !== undefined && { expires_at: input.expiresAt }),
    ...(input.confidence !== undefined && { confidence: input.confidence }),
    updated_at: now,
  });

  return getMemoryById(db, input.id);
}

export function forgetMemory(id: string): boolean {
  const db = getDatabase();
  return deleteMemory(db, id);
}

export function listMemories(input: ListMemoriesInput): Memory[] {
  const db = getDatabase();
  return listMemoriesFromDb(db, {
    scope: input.scope,
    workspacePath: input.workspacePath,
    repoIdentifier: input.repoIdentifier,
    tags: input.tags,
    status: "active",
    limit: input.limit,
    offset: input.offset,
  });
}

export function markMemoryUsed(id: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  updateMemoryRow(db, id, { last_used_at: now });
}

export function runRetention(): number {
  const db = getDatabase();
  return expireOldMemories(db);
}
