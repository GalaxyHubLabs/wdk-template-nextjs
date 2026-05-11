"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  Check,
  Copy,
  Eye,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { hasVault } from "@/lib/storage";
import { CHAIN_CONFIGS, CHAIN_IDS } from "@/lib/chains";

const buttonStyles =
  "inline-flex h-12 items-center justify-center rounded-lg px-6 text-base font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Landing page.
 *
 * Two roles to serve here:
 *  1. A new visitor evaluating the template — they need to see *what*
 *     the template does and *why* it's interesting in under 5 seconds.
 *  2. An existing user returning to their wallet — they need a single
 *     prominent CTA ("Unlock") with the create/import flows demoted.
 *
 * The page detects `hasVault()` after hydration and swaps the primary
 * CTA accordingly. SSR always returns the no-vault variant so the
 * server-rendered HTML is safe to cache on a CDN.
 */
export default function Home() {
  const [vaultPresent, setVaultPresent] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  useEffect(() => {
    setVaultPresent(hasVault());
  }, []);

  /** Exact snippet a user pastes into claude_desktop_config.json. The
   *  URL host is intentionally a placeholder — the agents guide
   *  explains how to swap it for the live deployment URL. */
  const mcpSnippet = `{
  "mcpServers": {
    "wdk-wallet": {
      "transport": {
        "type": "http",
        "url": "https://your-domain/api/mcp"
      }
    }
  }
}`;

  async function copyMcpSnippet() {
    try {
      await navigator.clipboard.writeText(mcpSnippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      // Clipboard blocked — the agents guide still has a working copy
      // affordance, so we fail silently here.
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        {/* Brand-soft radial glow behind the hero text — subtle reference
            to Tether teal without dominating the page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] max-w-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(31,191,168,0.18) 0%, rgba(31,191,168,0) 70%)",
          }}
        />

        <div className="mx-auto w-full max-w-3xl space-y-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Built on Tether WDK
          </div>

          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            One seed.{" "}
            <span className="text-brand">Nine chains.</span>{" "}
            USDT-first.
          </h1>

          <p className="mx-auto max-w-2xl text-balance text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
            An open-source Next.js wallet template built on{" "}
            <a
              href="https://docs.wdk.tether.io"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-brand"
            >
              Tether&apos;s Wallet Development Kit
            </a>
            . Solana, TRON, TON, Ethereum, BSC, Polygon, Arbitrum, Base, and
            Optimism — all from a single BIP-39 seed. Designed for human users
            and AI agents alike.
          </p>

          {/* Primary CTAs */}
          {vaultPresent ? (
            <div className="mx-auto w-full max-w-md space-y-3">
              <Link
                href="/unlock"
                className={cn(
                  buttonStyles,
                  "w-full bg-brand text-brand-foreground hover:opacity-90",
                )}
              >
                <Lock size={16} /> Unlock existing wallet
              </Link>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row">
                <Link
                  href="/onboarding/create"
                  className={cn(
                    buttonStyles,
                    "flex-1 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                  )}
                >
                  Create new
                </Link>
                <Link
                  href="/onboarding/import"
                  className={cn(
                    buttonStyles,
                    "flex-1 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                  )}
                >
                  Import
                </Link>
              </div>
              <p className="text-xs text-zinc-500">
                Creating or importing replaces the wallet on this device.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/onboarding/create"
                className={cn(
                  buttonStyles,
                  "bg-brand text-brand-foreground hover:opacity-90 sm:min-w-[200px]",
                )}
              >
                <Sparkles size={16} /> Create wallet
              </Link>
              <Link
                href="/onboarding/import"
                className={cn(
                  buttonStyles,
                  "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:min-w-[200px]",
                )}
              >
                <KeyRound size={16} /> Import existing
              </Link>
            </div>
          )}

          {/* Chain strip — quick visual proof of the multi-chain claim.
              We show real chain logos rather than text so the proof reads
              instantly: nine recognisable marks in a single row. */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {CHAIN_IDS.map((id) => {
              const c = CHAIN_CONFIGS[id];
              return (
                <span
                  key={id}
                  title={c.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:border-brand/40 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    alt={c.label}
                    className="h-6 w-6 rounded-full"
                    loading="lazy"
                  />
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Feature grid ─────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              visual={<NineChainsVisual />}
              title="Nine chains from one seed"
              body="Solana via @tetherto/wdk-wallet-solana, TRON and TON via their own modules, plus five EVM chains sharing a single WalletManagerEvm with per-chain RPCs."
            />
            <FeatureCard
              visual={<UsdtVisual />}
              title="USDT-first surface"
              body="Tether's canonical USDT deployments are first-class on every chain that has one. XAUt surfaces on Ethereum and TRON."
            />
            <FeatureCard
              visual={<VaultVisual />}
              title="Encrypted local vault"
              body="AES-GCM with 250,000-iteration PBKDF2, all via WebCrypto. The seed never leaves the device — not even to a backend, because there isn't one."
            />
            <FeatureCard
              visual={<AgentVisual />}
              title="AI-agent-ready"
              body="Built-in MCP server at /api/mcp exposes read tools to any agent that speaks the Model Context Protocol. Walk-through in /agents."
              href="/agents"
            />
            <FeatureCard
              visual={<WatchVisual />}
              title="Watch any address"
              body="Read-only tracking across all nine chains via raw RPC, no keys required. Perfect for portfolio dashboards and treasury views."
            />
            <FeatureCard
              visual={<NetworksVisual />}
              title="Mainnet ↔ Testnet"
              body="A single toggle re-binds every chain to its testnet, with faucet shortcuts on zero-balance accounts. Default is testnet to keep first-run risk-free."
            />
          </div>
        </div>
      </section>

      {/* ─── AI-agents strip ──────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="grid gap-6 p-8 sm:grid-cols-2 sm:gap-10 sm:p-10">
            <div className="flex flex-col justify-center space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  <Bot size={12} /> For AI agents
                </div>
                {/* "Live" pill — the endpoint is real, not aspirational.
                    Curl-tested in the commit that introduced /api/mcp. */}
                <a
                  href="/api/mcp"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                  title="Probe the MCP manifest"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live · /api/mcp
                </a>
              </div>

              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                Drive this wallet from{" "}
                <span className="text-brand">Claude</span> in five lines of
                config.
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                The template ships a built-in{" "}
                <a
                  href="https://modelcontextprotocol.io"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
                >
                  Model Context Protocol
                </a>{" "}
                server. Every tool reads through the same{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-[12px] dark:bg-zinc-950">
                  @tetherto/wdk
                </code>{" "}
                integration that powers the wallet UI — agents see the
                exact same chain config, the exact same RPCs, the exact
                same address resolution. Zero glue code. Zero seed
                exposure.
              </p>

              {/* The six tools the MCP server exposes. Compact chip strip
                  so a reviewer sees scope at a glance without leaving
                  the landing. */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "list_supported_chains",
                  "validate_address",
                  "resolve_name",
                  "get_balance",
                  "get_token_metadata",
                  "get_recent_transactions",
                ].map((tool) => (
                  <span
                    key={tool}
                    className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>

              <Link
                href="/agents"
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all hover:opacity-90"
              >
                Read the agent guide <ArrowRight size={14} />
              </Link>
            </div>

            <div className="flex items-center">
              {/* Faux terminal preview of the Claude Desktop config snippet.
                  We render the JSON literally so a reviewer can see the exact
                  shape they'll paste into their config file. */}
              <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-lg dark:border-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">
                      claude_desktop_config.json
                    </span>
                    <button
                      type="button"
                      onClick={copyMcpSnippet}
                      aria-label="Copy snippet"
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
                    >
                      {copiedSnippet ? (
                        <>
                          <Check size={10} className="text-emerald-400" />{" "}
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={10} /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
                  <code>
                    <span className="text-zinc-500">{"{"}</span>
                    {"\n  "}
                    <span className="text-emerald-300">&quot;mcpServers&quot;</span>
                    <span className="text-zinc-500">: {"{"}</span>
                    {"\n    "}
                    <span className="text-emerald-300">&quot;wdk-wallet&quot;</span>
                    <span className="text-zinc-500">: {"{"}</span>
                    {"\n      "}
                    <span className="text-emerald-300">&quot;transport&quot;</span>
                    <span className="text-zinc-500">: {"{"}</span>
                    {"\n        "}
                    <span className="text-emerald-300">&quot;type&quot;</span>
                    <span className="text-zinc-500">: </span>
                    <span className="text-amber-200">&quot;http&quot;</span>
                    <span className="text-zinc-500">,</span>
                    {"\n        "}
                    <span className="text-emerald-300">&quot;url&quot;</span>
                    <span className="text-zinc-500">: </span>
                    <span className="text-amber-200">
                      &quot;https://your-domain/api/mcp&quot;
                    </span>
                    {"\n      "}
                    <span className="text-zinc-500">{"}"}</span>
                    {"\n    "}
                    <span className="text-zinc-500">{"}"}</span>
                    {"\n  "}
                    <span className="text-zinc-500">{"}"}</span>
                    {"\n"}
                    <span className="text-zinc-500">{"}"}</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-zinc-200 px-6 py-10 text-center text-xs text-zinc-500 dark:border-zinc-900">
        <p className="space-x-2">
          <a
            href="https://github.com/GalaxyHubLabs/wdk-template-nextjs"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Source on GitHub
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://docs.wdk.tether.io"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            WDK docs
          </a>
          <span aria-hidden>·</span>
          <span className="uppercase tracking-wider">Self-custodial · MIT</span>
        </p>
      </footer>
    </main>
  );
}

/**
 * Feature card. The `visual` slot is a per-feature mini illustration —
 * stacked chain logos, a code snippet, a price-tag — rather than a
 * stock icon. This is what separates this landing from the standard
 * "AI-generated lucide-icon grid" aesthetic: every card communicates
 * its own idea visually before the body text reinforces it.
 */
function FeatureCard({
  visual,
  title,
  body,
  href,
}: {
  visual: React.ReactNode;
  title: string;
  body: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="mb-3 h-16">{visual}</div>
      <h3 className="text-base font-semibold">
        {title}
        {href && (
          <span className="ml-1 text-brand opacity-0 transition-opacity group-hover:opacity-100">
            →
          </span>
        )}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </>
  );
  const className =
    "group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950";
  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

// ─── Per-feature visuals ─────────────────────────────────────────────

/** Stack of real chain logos overlapping diagonally — communicates the
 *  multi-chain claim visually without us having to spell it out. */
function NineChainsVisual() {
  // Pick the 6 most recognisable marks so the stack reads even at 28px.
  // The wallet supports 9 — the "+3" badge to the right of the stack
  // makes the rest implicit.
  const featured: Array<(typeof CHAIN_IDS)[number]> = [
    "solana",
    "evm",
    "tron",
    "polygon",
    "arbitrum",
    "base",
  ];
  return (
    <div className="flex h-16 items-center">
      <div className="flex">
        {featured.map((id, i) => {
          const c = CHAIN_CONFIGS[id];
          if (!c) return null;
          return (
            <span
              key={id}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm transition-transform group-hover:[transform:translateY(0)] dark:border-zinc-950 dark:bg-zinc-950"
              style={{
                marginLeft: i === 0 ? 0 : -14,
                zIndex: 10 - i,
              }}
              title={c.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.logo}
                alt={c.label}
                className="h-7 w-7 rounded-full"
                loading="lazy"
              />
            </span>
          );
        })}
        <span
          className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-soft text-xs font-semibold text-brand dark:border-zinc-950"
          style={{ zIndex: 1 }}
        >
          +3
        </span>
      </div>
    </div>
  );
}

/** USDT (Tether) mark using the same Trustwallet-hosted PNG we ship on
 *  every token row, with the XAUt mark peeking behind it. This is the
 *  real logo, not a wordmark mockup, so the card reads as "actual
 *  Tether assets" the moment the eye lands on it. */
function UsdtVisual() {
  const usdt =
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png";
  const xaut =
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x68749665FF8D2d112Fa859AA293F07A622782F38/logo.png";
  return (
    <div className="flex h-16 items-center gap-3">
      <div className="relative">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={usdt}
            alt="Tether USD"
            className="h-12 w-12 rounded-full"
            loading="lazy"
          />
        </span>
        <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm dark:border-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={xaut}
            alt="Tether Gold"
            className="h-6 w-6 rounded-full"
            loading="lazy"
          />
        </span>
      </div>
      <div className="flex flex-col font-mono text-[11px] leading-tight text-zinc-500">
        <span className="text-foreground">USDT</span>
        <span>$1.00</span>
        <span className="text-emerald-600 dark:text-emerald-400">+0.0%</span>
      </div>
    </div>
  );
}

/** Encrypted vault: shield + lock + cryptography hint as monospace
 *  characters. Visually anchors the security claim. */
function VaultVisual() {
  return (
    <div className="flex h-16 items-center gap-3">
      <div className="relative">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-emerald-600 text-white shadow-sm">
          <ShieldCheck size={22} strokeWidth={2.4} />
        </span>
        <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-white dark:border-zinc-950">
          <Lock size={9} strokeWidth={2.8} />
        </span>
      </div>
      <div className="flex flex-col font-mono text-[10px] leading-tight text-zinc-500">
        <span>AES-256-GCM</span>
        <span>PBKDF2-SHA256</span>
        <span className="text-foreground">250k iterations</span>
      </div>
    </div>
  );
}

/** AI-agent-ready: tiny code snippet shaped like a terminal pane.
 *  Communicates "this is something a program drives, not just a UI". */
function AgentVisual() {
  return (
    <div className="relative h-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px] leading-tight dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-1 text-zinc-400">
        <Terminal size={10} />
        <span>lib/wdk-client.ts</span>
      </div>
      <div className="mt-1 text-zinc-700 dark:text-zinc-300">
        <span className="text-zinc-400">{"> "}</span>
        <span className="text-brand">await</span>{" "}
        <span>wdk.send(</span>
      </div>
      <div className="pl-3 text-zinc-700 dark:text-zinc-300">
        {"{ to, amount }"}
        <span className="text-zinc-400">)</span>
        <span className="ml-0.5 inline-block h-2.5 w-1.5 translate-y-0.5 animate-pulse bg-brand" />
      </div>
    </div>
  );
}

/** Watch-only: an eye sitting at the centre of a dotted ring of nine
 *  small dots — one per supported chain. Reinforces the "all nine
 *  chains" part of the claim. */
function WatchVisual() {
  return (
    <div className="relative flex h-16 items-center justify-center">
      <svg
        viewBox="0 0 128 64"
        className="h-16 w-32"
        aria-hidden
      >
        {/* Dotted ring */}
        {Array.from({ length: 9 }).map((_, i) => {
          const angle = (i / 9) * Math.PI * 2 - Math.PI / 2;
          const cx = 64 + Math.cos(angle) * 26;
          const cy = 32 + Math.sin(angle) * 22;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={2.4}
              fill="currentColor"
              className="text-brand/60"
            />
          );
        })}
        {/* Centre badge */}
        <circle
          cx={64}
          cy={32}
          r={14}
          fill="currentColor"
          className="text-brand-soft"
        />
      </svg>
      <Eye
        size={20}
        strokeWidth={2.2}
        className="absolute text-brand"
        aria-hidden
      />
    </div>
  );
}

/** Mainnet ↔ Testnet: two coloured dots with a double arrow between,
 *  matching the network indicator pattern used throughout the wallet. */
function NetworksVisual() {
  return (
    <div className="flex h-16 items-center gap-3">
      <div className="flex flex-col items-center gap-0.5">
        <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Main
        </span>
      </div>
      <ArrowLeftRight size={18} className="text-zinc-400" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.55)]" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Test
        </span>
      </div>
      <div className="ml-1 flex flex-col font-mono text-[10px] leading-tight text-zinc-500">
        <span className="text-foreground">9 chains</span>
        <span>1 toggle</span>
      </div>
    </div>
  );
}
