/**
 * MCP (Model Context Protocol) HTTP transport for the WDK Template
 * Wallet.
 *
 * Exposes the wallet's read surface as a set of MCP tools that any
 * MCP-aware AI agent (Claude Desktop, Anthropic API client, custom
 * agent runtimes) can invoke. Because the server is stateless and
 * the seed phrase only exists on the user's device, every tool here
 * is read-only by design — balances, name resolution, transaction
 * lists, ERC-20 metadata, address validation. Signing and sending
 * stay on the device, available through the wallet UI or via the
 * `examples/agent-send-usdt.ts` script.
 *
 * Transport: JSON-RPC 2.0 over HTTP POST. We implement the three
 * essentials of the MCP spec — `initialize`, `tools/list`,
 * `tools/call` — plus the `notifications/initialized` notification.
 * That's the minimum set every MCP client requires; richer features
 * (resources, prompts, roots, sampling) are out of scope for the
 * template's read surface.
 *
 * Wiring this into Claude Desktop is a single line in the user's
 * `claude_desktop_config.json`:
 *
 *     {
 *       "mcpServers": {
 *         "wdk-wallet": {
 *           "transport": {
 *             "type": "http",
 *             "url": "https://wdk-template.dev/api/mcp"
 *           }
 *         }
 *       }
 *     }
 *
 * The `/agents` page in this app walks the user through the setup
 * step by step.
 */

import { TOOLS } from "@/lib/mcp-tools";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number | string | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "wdk-template-wallet";
const SERVER_VERSION = "0.1.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(null, -32700, "Parse error: invalid JSON.");
  }

  // The MCP spec allows batched arrays of requests. We implement the
  // simpler single-request path here since none of our tools benefit
  // from batching and Claude Desktop never batches anyway.
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((entry) => handleSingle(entry as JsonRpcRequest)),
    );
    return jsonResponse(responses.filter((r) => r !== null));
  }
  const result = await handleSingle(body as JsonRpcRequest);
  if (result === null) {
    // Notification — no response body, per JSON-RPC spec.
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return jsonResponse(result);
}

async function handleSingle(
  req: JsonRpcRequest,
): Promise<JsonRpcSuccess | JsonRpcError | null> {
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return errorPayload(req?.id ?? null, -32600, "Invalid Request.");
  }

  const id = req.id ?? null;
  const isNotification = req.id === undefined;

  try {
    switch (req.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: {
            tools: { listChanged: false },
          },
        });

      case "notifications/initialized":
        // Notification — no response.
        return null;

      case "tools/list":
        return ok(id, {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });

      case "tools/call": {
        const params = (req.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        const tool = TOOLS.find((t) => t.name === params.name);
        if (!tool) {
          return errorPayload(id, -32602, `Unknown tool: ${params.name}`);
        }
        try {
          const result = await tool.execute(params.arguments ?? {});
          return ok(id, result);
        } catch (err) {
          // Tools may throw a friendly Error; surface it as a tool
          // error (isError=true) inside the result rather than a
          // protocol-level error so the agent can still parse and
          // act on it.
          const message =
            err instanceof Error ? err.message : String(err);
          return ok(id, {
            isError: true,
            content: [{ type: "text", text: message }],
          });
        }
      }

      case "ping":
        // MCP spec ping; respond with empty object.
        return ok(id, {});

      default:
        if (isNotification) return null;
        return errorPayload(id, -32601, `Method not found: ${req.method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error.";
    return errorPayload(id, -32603, message);
  }
}

// ─── Response helpers ─────────────────────────────────────────────────

function ok(
  id: number | string | null,
  result: unknown,
): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

function errorPayload(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function errorResponse(
  id: number | string | null,
  code: number,
  message: string,
): Response {
  return jsonResponse(errorPayload(id, code, message));
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * GET handler for human discoverability. Returns a short JSON
 * description of the endpoint so curious visitors who hit
 * `/api/mcp` in a browser see something useful instead of a
 * 405 Method Not Allowed.
 */
export async function GET(): Promise<Response> {
  return jsonResponse({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: "Model Context Protocol",
    protocolVersion: PROTOCOL_VERSION,
    transport: "Streamable HTTP (JSON-RPC 2.0 over POST)",
    tools: TOOLS.map((t) => t.name),
    docs: "/agents",
  });
}
