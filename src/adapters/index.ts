import type { IDEAdapter } from "./base.js";
import { VSCodeAdapter } from "./vscode.js";
import { CursorAdapter } from "./cursor.js";
import { WindsurfAdapter } from "./windsurf.js";
import { ClaudeAdapter } from "./claude.js";

const adapters: Record<string, () => IDEAdapter> = {
  vscode: () => new VSCodeAdapter(),
  cursor: () => new CursorAdapter(),
  windsurf: () => new WindsurfAdapter(),
  claude: () => new ClaudeAdapter(),
};

export function getAdapter(name: string): IDEAdapter | null {
  const factory = adapters[name.toLowerCase()];
  return factory ? factory() : null;
}

export function getAllAdapterNames(): string[] {
  return Object.keys(adapters);
}

export function getAllAdapters(): IDEAdapter[] {
  return Object.values(adapters).map((f) => f());
}

export type { IDEAdapter } from "./base.js";
