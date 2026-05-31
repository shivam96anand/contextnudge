export interface IDEAdapter {
  name: string;
  detect(): boolean;
  writeMcpConfig(workspaceRoot: string): Promise<void>;
  writeInstructions(workspaceRoot: string): Promise<void>;
  validate(workspaceRoot: string): Promise<{ valid: boolean; issues: string[] }>;
}
