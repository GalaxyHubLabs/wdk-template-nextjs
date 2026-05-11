"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Code2,
  Copy,
  Plug,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useState } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";

/**
 * AI-agents documentation page.
 *
 * The wallet ships a Model Context Protocol server at `/api/mcp` that
 * any MCP-aware client can drive — desktop clients (Claude Desktop,
 * Cursor, Continue, Cline, Windsurf, …), custom agent runtimes, or
 * plain HTTP from a CI job. The page walks the user through three
 * integration paths in increasing order of vendor specificity:
 *
 *   1. TypeScript directly through `lib/wdk-client.ts` — the most
 *      WDK-native path, also the only one capable of signing.
 *   2. Plain HTTP (curl) — works from anything that speaks
 *      JSON-RPC 2.0.
 *   3. An MCP-client config (Claude Desktop's `claude_desktop_config
 *      .json` is the example, but the shape is identical for Cursor
 *      / Continue / Cline / Windsurf).
 */

const TS_SNIPPET = `import { openWallet, sendToken } from "@/lib/wdk-client";
import { networkSpec } from "@/lib/chains";

// Same module the wallet UI uses — no glue code.
const wdk = await openWallet(seed, "mainnet");

const usdt = networkSpec("polygon", "mainnet")
  .tetherTokens.find(t => t.symbol === "USDT")!;

await sendToken(wdk, "polygon", usdt.address, recipient, 100_000_000n);`;

const CURL_SNIPPET = `# Manifest
curl https://<your-deployment>/api/mcp

# Call a tool
curl -X POST https://<your-deployment>/api/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "resolve_name",
      "arguments": { "chain": "evm", "name": "vitalik.eth" }
    }
  }'`;

const CLIENT_CONFIG_SNIPPET = `{
  "mcpServers": {
    "wdk-wallet": {
      "transport": {
        "type": "http",
        "url": "https://<your-deployment>/api/mcp"
      }
    }
  }
}`;

const TOOL_SUMMARIES: Array<{ name: string; description: string }> = [
  {
    name: "list_supported_chains",
    description:
      "Returns every chain id this template supports with its native asset symbol and decimals.",
  },
  {
    name: "validate_address",
    description:
      "Syntactically validates an address for a chain. Use to fail fast before more expensive RPC calls.",
  },
  {
    name: "resolve_name",
    description:
      "Resolves `.eth` (EVM) and `.sol` (Solana mainnet) names to their concrete addresses.",
  },
  {
    name: "get_balance",
    description:
      "Returns native + USDT + XAUt balances for an address on a chain, via the configured public RPC.",
  },
  {
    name: "get_token_metadata",
    description:
      "ERC-20 metadata read (symbol / decimals / name) for any EVM token contract.",
  },
  {
    name: "get_recent_transactions",
    description:
      "Recent transactions for an address. Solana via JSON-RPC, EVM family via Etherscan-compatible APIs.",
  },
];

interface CopyableSnippetProps {
  label: string;
  body: string;
}

function CopyableSnippet({ label, body }: CopyableSnippetProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      toast.success(`${label} copied.`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied.");
    }
  }

  return (
    <div className="relative mt-4">
      <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-[11px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
        {body}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy snippet"
        className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {copied ? (
          "Copied"
        ) : (
          <span className="inline-flex items-center gap-1">
            <Copy size={11} /> Copy
          </span>
        )}
      </button>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <Bot size={12} /> AI agents
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Drive this wallet from any AI agent
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The same{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              @tetherto/wdk
            </code>{" "}
            integration that powers the wallet UI is exposed as a Model
            Context Protocol server at{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              /api/mcp
            </code>
            . Read balances, resolve names, list transactions, and inspect
            token metadata across all nine chains — zero glue code, zero
            seed exposure.
          </p>
        </header>

        {/* Tools */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>The tools the agent gets</CardTitle>
              <CardDescription className="mt-1">
                Every tool below is read-only: the wallet&apos;s seed phrase
                never leaves the user&apos;s device, so the MCP server
                cannot sign or send. The write path lives in the
                TypeScript example below.
              </CardDescription>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {TOOL_SUMMARIES.map((tool) => (
              <li key={tool.name} className="py-3">
                <p className="font-mono text-sm font-medium">{tool.name}</p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {tool.description}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        {/* TypeScript — WDK-native */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Code2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>1. TypeScript — direct WDK from your agent</CardTitle>
              <CardDescription className="mt-1">
                The cleanest integration goes through{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  lib/wdk-client.ts
                </code>{" "}
                — the same module the wallet UI uses. This is the only path
                that can also <em>sign and send</em>, since it owns the
                seed locally. Wire it into your agent runtime when you need
                state-changing actions.
              </CardDescription>
            </div>
          </div>
          <CopyableSnippet label="TypeScript snippet" body={TS_SNIPPET} />
          <CardDescription className="mt-3 text-xs">
            See{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              examples/agent-send-usdt.ts
            </code>{" "}
            in the repo for a runnable 130-line script that loads a seed
            from{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              SEED_PHRASE
            </code>
            , quotes a USDT transfer, sends, and prints the explorer link.
          </CardDescription>
        </Card>

        {/* HTTP — vendor neutral */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Terminal size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>2. HTTP — probe and call from anywhere</CardTitle>
              <CardDescription className="mt-1">
                The MCP endpoint speaks JSON-RPC 2.0 over HTTP. A plain GET
                returns a manifest with the protocol version and registered
                tool names — useful for health-checks. POSTs follow the{" "}
                <a
                  href="https://spec.modelcontextprotocol.io/specification/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-brand"
                >
                  MCP spec
                </a>{" "}
                for the message shapes.
              </CardDescription>
            </div>
          </div>
          <CopyableSnippet label="curl snippet" body={CURL_SNIPPET} />
        </Card>

        {/* Desktop client config */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Plug size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>
                3. Desktop MCP clients — paste a snippet into their config
              </CardTitle>
              <CardDescription className="mt-1">
                Every major desktop MCP client (Claude Desktop, Cursor,
                Continue, Cline, Windsurf) reads a JSON config file with
                this same shape. The snippet below uses Claude Desktop&apos;s{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  claude_desktop_config.json
                </code>{" "}
                as the host, but the inner{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  mcpServers
                </code>{" "}
                block transposes to the other clients verbatim. Replace{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  &lt;your-deployment&gt;
                </code>{" "}
                with the public URL of your fork.
              </CardDescription>
            </div>
          </div>
          <CopyableSnippet
            label="Client config snippet"
            body={CLIENT_CONFIG_SNIPPET}
          />
          <CardDescription className="mt-3 text-xs">
            Restart the client. The wallet&apos;s tools then appear under
            the{" "}
            <span className="font-medium text-foreground">wdk-wallet</span>{" "}
            server in any conversation. Rename that key in the snippet if
            you prefer a different label.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}
