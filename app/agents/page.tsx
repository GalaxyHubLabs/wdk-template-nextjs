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
 * AI agents documentation page.
 *
 * The WDK Template Wallet's killer differentiator vs other wallet
 * starters is that it ships an MCP server that exposes the read
 * surface to any AI agent that speaks the Model Context Protocol
 * (Claude Desktop, the Anthropic API with the official MCP client,
 * any custom agent runtime).
 *
 * This page walks the user through:
 *   1. The five-line config snippet to plug the deployment into
 *      Claude Desktop.
 *   2. The list of tools the MCP server exposes.
 *   3. A pointer to the runnable `examples/agent-send-usdt.ts`
 *      script for the *write* path that can't live on the server
 *      (because it needs the seed phrase).
 */

const CLAUDE_CONFIG_SNIPPET = `{
  "mcpServers": {
    "wdk-wallet": {
      "transport": {
        "type": "http",
        "url": "<YOUR_DEPLOYMENT_URL>/api/mcp"
      }
    }
  }
}`;

const TOOL_SUMMARIES: Array<{ name: string; description: string }> = [
  {
    name: "list_supported_chains",
    description:
      "Returns every chain id this template supports with its native asset symbol + decimals.",
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

export default function AgentsPage() {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(CLAUDE_CONFIG_SNIPPET);
      setCopied(true);
      toast.success("Snippet copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied.");
    }
  }

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
            Drive this wallet from an AI agent
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The template ships a built-in{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
            >
              Model Context Protocol
            </a>{" "}
            server at{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              /api/mcp
            </code>
            . Any MCP-aware AI agent can read balances, resolve names, list
            transactions, and inspect token metadata across all nine
            supported chains — zero glue code required.
          </p>
        </header>

        {/* Step 1 — config snippet */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Plug size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>1. Add the server to Claude Desktop</CardTitle>
              <CardDescription className="mt-1">
                Paste the snippet into your{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  claude_desktop_config.json
                </code>
                . Replace{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  &lt;YOUR_DEPLOYMENT_URL&gt;
                </code>{" "}
                with the public URL of your fork — locally that&apos;s{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  http://localhost:3000
                </code>
                ; on Vercel it&apos;s the project&apos;s{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  *.vercel.app
                </code>{" "}
                or custom domain.
              </CardDescription>
            </div>
          </div>
          <div className="relative mt-4">
            <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
              {CLAUDE_CONFIG_SNIPPET}
            </pre>
            <button
              type="button"
              onClick={copySnippet}
              aria-label="Copy snippet"
              className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {copied ? "Copied" : <span className="inline-flex items-center gap-1"><Copy size={11} /> Copy</span>}
            </button>
          </div>
          <CardDescription className="mt-3 text-xs">
            Restart Claude Desktop. The wallet&apos;s tools then appear under
            the <span className="font-medium text-foreground">wdk-wallet</span>{" "}
            server in any conversation.
          </CardDescription>
        </Card>

        {/* Step 2 — tool list */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>2. The tools the agent gets</CardTitle>
              <CardDescription className="mt-1">
                Every tool below is read-only: the wallet&apos;s seed phrase
                never leaves the user&apos;s device, so the MCP server
                can&apos;t sign or send. Use the agent example script
                below for the write path.
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

        {/* Step 3 — agent example */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Code2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>3. For the write path — signing &amp; sending</CardTitle>
              <CardDescription className="mt-1">
                Agents that need to <em>move</em> funds (not just read) must
                run with the seed phrase loaded. The repo ships{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  examples/agent-send-usdt.ts
                </code>{" "}
                — a 130-line standalone script that opens the wallet, quotes
                the fee, sends USDT to a recipient, and prints the explorer
                link. Wire that pattern into your agent runtime when you
                need state-changing actions.
              </CardDescription>
            </div>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-[11px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
            {`# 1. clone the template, install deps
git clone <repo>
cd wdk-template-nextjs && npm install

# 2. set the script's env
export SEED_PHRASE="testnet twelve words go here ..."
export RECIPIENT="<solana-or-evm-address>"
export AMOUNT_USDT="1.5"

# 3. run
npx tsx examples/agent-send-usdt.ts`}
          </pre>
        </Card>

        {/* Step 4 — endpoint discovery */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Terminal size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>Probing the endpoint</CardTitle>
              <CardDescription className="mt-1">
                A plain GET to{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                  /api/mcp
                </code>{" "}
                returns a JSON manifest with the protocol version, server
                name, and the list of registered tool names — useful for
                health-checks and discovery. POSTs follow JSON-RPC 2.0;
                see{" "}
                <a
                  href="https://spec.modelcontextprotocol.io/specification/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-brand"
                >
                  the MCP spec
                </a>{" "}
                for the message shapes.
              </CardDescription>
            </div>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-[11px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
            {`# manifest
curl https://wdk-template.dev/api/mcp

# call a tool directly
curl -X POST https://wdk-template.dev/api/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "resolve_name",
      "arguments": { "chain": "evm", "name": "vitalik.eth" }
    }
  }'`}
          </pre>
        </Card>
      </div>
    </main>
  );
}
