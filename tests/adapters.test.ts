import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getMcpServerCommand } from "../src/adapters/mcp-command.js";
import { VSCodeAdapter } from "../src/adapters/vscode.js";

describe("getMcpServerCommand", () => {
  it.each(["darwin", "linux"] as const)("invokes npx directly on %s", (platform) => {
    expect(getMcpServerCommand(platform)).toEqual({
      command: "npx",
      args: ["-y", "contextnudge@latest", "--mcp"],
    });
  });

  // On Windows `npx` is a .cmd shim. IDEs spawn the MCP server without a
  // shell, so spawning `npx` directly fails with ENOENT and the server never
  // starts — routing through `cmd /c` lets the shell resolve it.
  it("routes through cmd /c on win32", () => {
    expect(getMcpServerCommand("win32")).toEqual({
      command: "cmd",
      args: ["/c", "npx", "-y", "contextnudge@latest", "--mcp"],
    });
  });
});

describe("VSCodeAdapter", () => {
  let workspace: string;

  const makeWorkspace = () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cn-vscode-"));
    return workspace;
  };

  afterEach(() => {
    if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
  });

  it("writes a valid mcp.json and instructions file", async () => {
    const root = makeWorkspace();
    const adapter = new VSCodeAdapter();
    await adapter.writeMcpConfig(root);
    await adapter.writeInstructions(root);

    const config = JSON.parse(
      fs.readFileSync(path.join(root, ".vscode", "mcp.json"), "utf-8")
    );
    expect(config.servers.contextnudge.type).toBe("stdio");
    expect(config.servers.contextnudge.args).toContain("--mcp");

    expect(await adapter.validate(root)).toEqual({ valid: true, issues: [] });
  });

  it("is idempotent — running init twice does not duplicate anything", async () => {
    const root = makeWorkspace();
    const adapter = new VSCodeAdapter();

    for (let i = 0; i < 2; i++) {
      await adapter.writeMcpConfig(root);
      await adapter.writeInstructions(root);
    }

    const instructions = fs.readFileSync(
      path.join(root, ".github", "copilot-instructions.md"),
      "utf-8"
    );
    const markerCount = instructions.split(
      "<!-- ContextNudge: Auto-generated instructions for GitHub Copilot -->"
    ).length - 1;
    expect(markerCount).toBe(1);

    const config = JSON.parse(
      fs.readFileSync(path.join(root, ".vscode", "mcp.json"), "utf-8")
    );
    expect(Object.keys(config.servers)).toEqual(["contextnudge"]);
  });

  it("preserves unrelated servers already present in mcp.json", async () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".vscode"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".vscode", "mcp.json"),
      JSON.stringify({ servers: { other: { command: "other-server" } } })
    );

    await new VSCodeAdapter().writeMcpConfig(root);

    const config = JSON.parse(
      fs.readFileSync(path.join(root, ".vscode", "mcp.json"), "utf-8")
    );
    expect(config.servers.other.command).toBe("other-server");
    expect(config.servers.contextnudge).toBeDefined();
  });

  it("appends to an existing instructions file without clobbering it", async () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".github", "copilot-instructions.md"),
      "# Existing project rules\n"
    );

    await new VSCodeAdapter().writeInstructions(root);

    const content = fs.readFileSync(
      path.join(root, ".github", "copilot-instructions.md"),
      "utf-8"
    );
    expect(content).toContain("# Existing project rules");
    expect(content).toContain("ContextNudge");
  });
});
