"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  type ChainId,
} from "@/lib/chains";
import {
  getNativeBalance,
  getUsdtBalance,
  type WalletHandle,
} from "@/lib/wdk-client";
import { hasVault } from "@/lib/storage";
import { cn, formatBalance, truncate } from "@/lib/utils";
import { useWalletStore } from "@/store/wallet";

export default function WalletPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);
  const setActiveChain = useWalletStore((s) => s.setActiveChain);
  const nativeBalances = useWalletStore((s) => s.nativeBalances);
  const usdtBalances = useWalletStore((s) => s.usdtBalances);
  const setAllBalances = useWalletStore((s) => s.setAllBalances);
  const balanceHidden = useWalletStore((s) => s.balanceHidden);
  const toggleBalanceHidden = useWalletStore((s) => s.toggleBalanceHidden);
  const reset = useWalletStore((s) => s.reset);

  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refreshBalances = useCallback(async (h: WalletHandle) => {
    setRefreshing(true);
    try {
      // Fan out across every registered chain in parallel. Each pair
      // (native + usdt) within a chain also resolves in parallel.
      const results = await Promise.all(
        CHAIN_IDS.map(async (chain) => {
          const [native, usdt] = await Promise.all([
            getNativeBalance(h, chain).catch(() => 0n),
            getUsdtBalance(h, chain).catch(() => 0n),
          ]);
          return [chain, native, usdt] as const;
        }),
      );
      const natives: Partial<Record<ChainId, bigint>> = {};
      const usdts: Partial<Record<ChainId, bigint>> = {};
      for (const [chain, native, usdt] of results) {
        natives[chain] = native;
        usdts[chain] = usdt;
      }
      setAllBalances(natives, usdts);
    } finally {
      setRefreshing(false);
    }
  }, [setAllBalances]);

  // Initial fetch on first mount with a live handle.
  useEffect(() => {
    if (handle) {
      void refreshBalances(handle);
    }
  }, [handle, refreshBalances]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const activeAccount = handle.accounts[activeChain];
  const activeConfig = CHAIN_CONFIGS[activeChain];
  const nativeBalance = nativeBalances[activeChain] ?? null;
  const usdtBalance = usdtBalances[activeChain] ?? null;

  async function copyAddress() {
    if (!activeAccount) return;
    try {
      await navigator.clipboard.writeText(activeAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function lock() {
    reset();
    router.replace(hasVault() ? "/unlock" : "/");
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-950">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {activeConfig.isTestnet ? "Testnet · " : ""}
            {activeConfig.label}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={lock}
            aria-label="Lock wallet"
          >
            <Lock size={14} /> Lock
          </Button>
        </div>

        {/* Chain switcher */}
        <div
          className="grid gap-1.5 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950"
          style={{ gridTemplateColumns: `repeat(${CHAIN_IDS.length}, minmax(0, 1fr))` }}
        >
          {CHAIN_IDS.map((chain) => {
            const c = CHAIN_CONFIGS[chain];
            const isActive = chain === activeChain;
            const hasAccount = Boolean(handle.accounts[chain]);
            return (
              <button
                key={chain}
                type="button"
                onClick={() => setActiveChain(chain)}
                disabled={!hasAccount}
                className={cn(
                  "rounded-lg px-2 py-2 text-xs font-medium transition-all",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                  !hasAccount && "opacity-30 cursor-not-allowed",
                )}
              >
                <span className="block">{c.shortLabel}</span>
                <span className="block text-[10px] font-normal opacity-60">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active chain account card */}
        {activeAccount ? (
          <Card>
            <CardDescription>Account · {activeConfig.label}</CardDescription>
            <div className="mt-2 flex items-center justify-between gap-3">
              <CardTitle className="font-mono text-lg break-all">
                {truncate(activeAccount.address, 6, 6)}
              </CardTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyAddress}
                  aria-label="Copy address"
                  className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                >
                  <Copy size={14} />
                </button>
                <a
                  href={activeConfig.addressExplorer(activeAccount.address)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View on explorer"
                  className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
            {copied && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Address copied
              </p>
            )}

            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardDescription>Balance</CardDescription>
                  <button
                    type="button"
                    onClick={toggleBalanceHidden}
                    aria-label={balanceHidden ? "Show balances" : "Hide balances"}
                    className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                  >
                    {balanceHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {balanceHidden
                    ? "••••"
                    : nativeBalance == null
                      ? "—"
                      : formatBalance(nativeBalance, activeConfig.nativeDecimals)}
                  <span className="ml-1.5 text-lg font-medium text-zinc-500">
                    {activeConfig.nativeSymbol}
                  </span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handle && refreshBalances(handle)}
                loading={refreshing}
                aria-label="Refresh balances"
              >
                {!refreshing && <RefreshCcw size={14} />} Refresh
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <CardTitle>Account unavailable</CardTitle>
            <CardDescription className="mt-2">
              The {activeConfig.label} RPC was unreachable when this wallet
              was opened. Lock and unlock the wallet to retry derivation.
            </CardDescription>
          </Card>
        )}

        {/* Primary actions */}
        {activeAccount && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/wallet/send"
              className={cn(
                "flex h-12 items-center justify-center rounded-lg bg-foreground text-background font-medium transition-all hover:opacity-90 active:opacity-80",
              )}
            >
              Send
            </Link>
            <Link
              href="/wallet/receive"
              className={cn(
                "flex h-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 font-medium transition-all hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              Receive
            </Link>
          </div>
        )}

        {/* USDT card (when configured for this chain) */}
        {activeConfig.usdt && activeAccount && (
          <Card>
            <CardDescription>Tokens</CardDescription>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                {activeConfig.usdt.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeConfig.usdt.logo}
                    alt="USDT"
                    className="h-9 w-9 rounded-full bg-zinc-100 object-contain p-1 dark:bg-zinc-900"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    USDT
                  </div>
                )}
                <div className="leading-tight">
                  <p className="text-sm font-medium">USDT</p>
                  <p className="text-xs text-zinc-500">
                    Tether USD on {activeConfig.label}
                  </p>
                </div>
              </div>
              <p className="font-mono text-sm">
                {balanceHidden
                  ? "••••"
                  : usdtBalance == null
                    ? "—"
                    : formatBalance(usdtBalance, activeConfig.usdt.decimals)}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              SPL/jetton/TRC-20/ERC-20 transfer flows ship next. Add more
              tokens in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                lib/chains.ts
              </code>
              .
            </p>
          </Card>
        )}

        {!activeConfig.usdt && activeAccount && (
          <Card>
            <CardDescription>Tokens</CardDescription>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              No USDT contract configured for {activeConfig.label}{" "}
              {activeConfig.isTestnet ? "testnet" : "mainnet"}. Set the
              relevant{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                NEXT_PUBLIC_*_USDT_*
              </code>{" "}
              environment variable in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                lib/chains.ts
              </code>{" "}
              to enable.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
