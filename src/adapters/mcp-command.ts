export const MCP_PACKAGE_SPEC = "contextnudge@latest";

export interface McpServerCommand {
  command: string;
  args: string[];
}

/**
 * On Windows `npx` is a `.cmd` shim, which cannot be spawned directly by the
 * IDE's stdio transport (it spawns without a shell and fails with ENOENT).
 * Routing through `cmd /c` lets the shell resolve `npx.cmd` correctly.
 */
export function getMcpServerCommand(
  platform: NodeJS.Platform = process.platform
): McpServerCommand {
  const npxArgs = ["-y", MCP_PACKAGE_SPEC, "--mcp"];

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "npx", ...npxArgs] };
  }

  return { command: "npx", args: npxArgs };
}
