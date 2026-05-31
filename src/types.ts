export type MemoryScope = "global" | "workspace" | "repo" | "file-pattern";

export type MemoryStatus = "active" | "archived" | "expired";

export interface Memory {
  id: string;
  summary: string;
  scope: MemoryScope;
  workspacePath: string | null;
  repoIdentifier: string | null;
  filePattern: string | null;
  tags: string[];
  source: string;
  confidence: number;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
}

export interface SaveMemoryInput {
  summary: string;
  scope?: MemoryScope;
  workspacePath?: string;
  repoIdentifier?: string;
  filePattern?: string;
  tags?: string[];
  source?: string;
  confidence?: number;
  expiresAt?: string;
}

export interface SearchMemoryInput {
  query: string;
  workspacePath?: string;
  repoIdentifier?: string;
  activeFilePath?: string;
  tags?: string[];
  limit?: number;
}

export interface SearchResult {
  memory: Memory;
  score: number;
  matchReason: string;
}

export interface UpdateMemoryInput {
  id: string;
  summary?: string;
  scope?: MemoryScope;
  tags?: string[];
  filePattern?: string;
  expiresAt?: string | null;
  confidence?: number;
}

export interface ListMemoriesInput {
  scope?: MemoryScope;
  workspacePath?: string;
  repoIdentifier?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface MemoryStats {
  total: number;
  active: number;
  expired: number;
  byScope: Record<MemoryScope, number>;
}

export interface IDEAdapter {
  name: string;
  detect(): boolean;
  writeMcpConfig(workspaceRoot: string): Promise<void>;
  writeInstructions(workspaceRoot: string): Promise<void>;
  validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }>;
}

export interface Config {
  dataDir: string;
  defaultScope: MemoryScope;
  defaultTtlDays: Record<MemoryScope, number | null>;
  maxSearchResults: number;
}

export const DEFAULT_CONFIG: Config = {
  dataDir: "",
  defaultScope: "workspace",
  defaultTtlDays: {
    global: null,
    workspace: 90,
    repo: 90,
    "file-pattern": 180,
  },
  maxSearchResults: 5,
};
