"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bot,
  Coins,
  KeyRound,
  Layers,
  Lock,
  Shield,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { hasVault } from "@/lib/storage";

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
  useEffect(() => {
    setVaultPresent(hasVault());
  }, []);

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
            Built on Tether WDK · Featured chain: Solana
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

          {/* Chain strip — quick visual proof of the multi-chain claim */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {[
              "Solana",
              "TRON",
              "TON",
              "Ethereum",
              "BSC",
              "Polygon",
              "Arbitrum",
              "Base",
              "Optimism",
            ].map((c) => (
              <span
                key={c}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Feature grid ─────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              Icon={Layers}
              title="Nine chains from one seed"
              body="Solana via @tetherto/wdk-wallet-solana, TRON and TON via their own modules, plus five EVM chains (Ethereum, BSC, Polygon, Arbitrum, Base, Optimism) sharing a single WalletManagerEvm with per-chain RPCs."
            />
            <FeatureCard
              Icon={Coins}
              title="USDT-first surface"
              body="Tether's canonical USDT deployments are first-class on every chain that has one. XAUt surfaces on Ethereum and TRON. Custom tokens get a Jupiter auto-fetch on Solana."
            />
            <FeatureCard
              Icon={Shield}
              title="Encrypted local vault"
              body="AES-GCM with 250,000-iteration PBKDF2, all via WebCrypto. The seed never leaves the device — not even to a backend, because there isn't one."
            />
            <FeatureCard
              Icon={Bot}
              title="AI-agent-ready"
              body="A clean lib/wdk-client.ts boundary exposes openWallet, send, quote, balances, and account switching. Agents can drive the wallet without touching React."
            />
            <FeatureCard
              Icon={Sparkles}
              title="Watch any address"
              body="Read-only tracking across all nine chains via raw RPC, no keys required. Useful for portfolio dashboards and treasury views."
            />
            <FeatureCard
              Icon={KeyRound}
              title="Mainnet ↔ Testnet"
              body="A single toggle re-binds every chain to its testnet, with faucet shortcuts on zero-balance accounts. Default is testnet to keep first-run risk-free."
            />
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

function FeatureCard({
  Icon,
  title,
  body,
}: {
  Icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-brand/40 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon size={18} />
      </div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}
