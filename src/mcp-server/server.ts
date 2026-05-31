import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveMemory, forgetMemory, updateMemory, listMemories, runRetention } from "../core/memory.js";
import { searchMemory } from "../retrieval/ranker.js";
import { getDatabase } from "../storage/db.js";
import { getMemoryStats } from "../storage/db.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "contextnudge",
    version: "0.1.0",
  });

  // Run retention on startup
  try {
    getDatabase();
    runRetention();
  } catch {
    // DB will be initialized on first tool call
  }

  server.tool(
    "search_memory",
    "Search the developer's local memory for relevant context. Use this before workspace-specific, repo-specific, debugging, testing, setup, refactoring, or architecture work.",
    {
      query: z.string().describe("Natural language search query describing what context you need"),
      workspacePath: z.string().optional().describe("Absolute path to the current workspace root"),
      repoIdentifier: z.string().optional().describe("Git remote URL or repo identifier (e.g., owner/repo)"),
      activeFilePath: z.string().optional().describe("Path to the currently active file"),
      tags: z.array(z.string()).optional().describe("Tags to filter by"),
      limit: z.number().optional().describe("Max results to return (default 5)"),
    },
    async (params) => {
      try {
        const results = searchMemory({
          query: params.query,
          workspacePath: params.workspacePath,
          repoIdentifier: params.repoIdentifier,
          activeFilePath: params.activeFilePath,
          tags: params.tags,
          limit: params.limit,
        });

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "No relevant memories found." }],
          };
        }

        const formatted = results.map((r) =>
          `[${r.memory.id}] (${r.memory.scope}, confidence: ${r.memory.confidence}) ${r.memory.summary}\n  → matched: ${r.matchReason}`
        ).join("\n\n");

        return {
          content: [{ type: "text", text: formatted }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error searching memory: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_memory",
    "Save a piece of developer context to local memory. Use when discovering stable repo conventions, recurring fixes, build commands, architectural decisions, or personal coding preferences. Never save secrets, credentials, tokens, or temporary guesses.",
    {
      summary: z.string().describe("Concise one-sentence or short-paragraph memory to save"),
      scope: z.enum(["global", "workspace", "repo", "file-pattern"]).optional().describe("Memory scope (default: workspace)"),
      workspacePath: z.string().optional().describe("Workspace path this memory applies to"),
      repoIdentifier: z.string().optional().describe("Git remote URL or repo identifier"),
      filePattern: z.string().optional().describe("File glob pattern this memory applies to (for file-pattern scope)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      source: z.string().optional().describe("Source of this memory (e.g., 'copilot', 'user', 'debug-session')"),
    },
    async (params) => {
      try {
        const memory = saveMemory({
          summary: params.summary,
          scope: params.scope,
          workspacePath: params.workspacePath,
          repoIdentifier: params.repoIdentifier,
          filePattern: params.filePattern,
          tags: params.tags,
          source: params.source ?? "copilot",
        });

        return {
          content: [{ type: "text", text: `Memory saved: [${memory.id}] "${memory.summary}"` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error saving memory: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "forget_memory",
    "Delete a memory permanently. Use when a memory is incorrect, outdated, or no longer relevant.",
    {
      memoryId: z.string().describe("The ID of the memory to delete"),
    },
    async (params) => {
      const deleted = forgetMemory(params.memoryId);
      if (deleted) {
        return {
          content: [{ type: "text", text: `Memory ${params.memoryId} forgotten.` }],
        };
      }
      return {
        content: [{ type: "text", text: `Memory ${params.memoryId} not found.` }],
        isError: true,
      };
    }
  );

  server.tool(
    "list_memories",
    "List saved memories, optionally filtered by scope, workspace, repo, or tags.",
    {
      scope: z.enum(["global", "workspace", "repo", "file-pattern"]).optional().describe("Filter by scope"),
      workspacePath: z.string().optional().describe("Filter by workspace path"),
      repoIdentifier: z.string().optional().describe("Filter by repo identifier"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async (params) => {
      try {
        const memories = listMemories({
          scope: params.scope,
          workspacePath: params.workspacePath,
          repoIdentifier: params.repoIdentifier,
          tags: params.tags,
          limit: params.limit ?? 20,
        });

        if (memories.length === 0) {
          return {
            content: [{ type: "text", text: "No memories found matching filters." }],
          };
        }

        const formatted = memories.map((m) =>
          `[${m.id}] (${m.scope}) ${m.summary}`
        ).join("\n");

        return {
          content: [{ type: "text", text: formatted }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing memories: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_memory",
    "Update an existing memory's summary, tags, scope, or expiration.",
    {
      memoryId: z.string().describe("The ID of the memory to update"),
      summary: z.string().optional().describe("Updated summary text"),
      scope: z.enum(["global", "workspace", "repo", "file-pattern"]).optional().describe("Updated scope"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
      filePattern: z.string().optional().describe("Updated file pattern"),
      expiresAt: z.string().optional().describe("Updated expiration date (ISO 8601)"),
    },
    async (params) => {
      try {
        const updated = updateMemory({
          id: params.memoryId,
          summary: params.summary,
          scope: params.scope,
          tags: params.tags,
          filePattern: params.filePattern,
          expiresAt: params.expiresAt,
        });

        if (!updated) {
          return {
            content: [{ type: "text", text: `Memory ${params.memoryId} not found.` }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: `Memory updated: [${updated.id}] "${updated.summary}"` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating memory: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
