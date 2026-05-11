"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Lock, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { NETWORKS } from "@/lib/networks";
import { getNativeBalance, getTokenBalances } from "@/lib/wdk-client";
import { hasVault } from "@/lib/storage";
import { getKnownTokens, type SplToken } from "@/lib/tokens";
import { cn, formatBalance, truncate } from "@/lib/utils";
import { useWalletStore } from "@/store/wallet";

export default function WalletPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const network = useWalletStore((s) => s.network);
  const balance = useWalletStore((s) => s.balance);
  const setBalance = useWalletStore((s) => s.setBalance);
  const reset = useWalletStore((s) => s.reset);

  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});
  const knownTokens: SplToken[] = getKnownTokens(network);

  // If we lost the in-memory handle (e.g. tab reload after lock), bounce to
  // the unlock screen when an encrypted vault is available on this device,
  // or back to the landing otherwise.
  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refreshBalance = useCallback(async () => {
    if (!handle) return;
    setRefreshing(true);
    try {
      // Run native + token balance fetches in parallel — both rely on the same
      // RPC connection and short-circuit each other's UX wait if one is slow.
      const [lamports, tokens] = await Promise.all([
        getNativeBalance(handle),
        knownTokens.length > 0
          ? getTokenBalances(
              handle,
              knownTokens.map((t) => t.mint),
            )
          : Promise.resolve({} as Record<string, bigint>),
      ]);
      setBalance(lamports);
      setTokenBalances(tokens);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      setBalance(null);
    } finally {
      setRefreshing(false);
    }
  }, [handle, knownTokens, setBalance]);

  // Fetch balance on initial mount once we have a handle.
  useEffect(() => {
    if (handle) {
      refreshBalance();
    }
  }, [handle, refreshBalance]);

  async function copyAddress() {
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(handle.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  /** Clear the in-memory handle. The encrypted vault stays on this device so
   * the user can return and unlock with their password. To wipe the vault
   * entirely, use the "Wipe wallet" affordance on the unlock screen. */
  function lock() {
    reset();
    router.replace(hasVault() ? "/unlock" : "/");
  }

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const networkCfg = NETWORKS[network];
  const explorerHref = networkCfg.explorerUrl(handle.address, "address");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-950">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {networkCfg.label}
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

        {/* Account card */}
        <Card>
          <CardDescription>Account</CardDescription>
          <div className="mt-2 flex items-center justify-between gap-3">
            <CardTitle className="font-mono text-lg">
              {truncate(handle.address, 6, 6)}
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
                href={explorerHref}
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
              <CardDescription>Balance</CardDescription>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {balance == null ? "—" : formatBalance(balance, 9)}
                <span className="ml-1.5 text-lg font-medium text-zinc-500">
                  SOL
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshBalance}
              loading={refreshing}
              aria-label="Refresh balance"
            >
              {!refreshing && <RefreshCcw size={14} />} Refresh
            </Button>
          </div>
        </Card>

        {/* Primary actions */}
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

        {/* Token balances */}
        {knownTokens.length > 0 && (
          <Card>
            <CardDescription>Tokens</CardDescription>
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {knownTokens.map((token) => {
                const bal = tokenBalances[token.mint] ?? 0n;
                return (
                  <li
                    key={token.mint}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        {token.symbol.slice(0, 3)}
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-medium">{token.symbol}</p>
                        <p className="text-xs text-zinc-500">{token.name}</p>
                      </div>
                    </div>
                    <p className="font-mono text-sm">
                      {formatBalance(bal, token.decimals)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-zinc-500">
              SPL token send is not in this template yet — coming in a follow-up.
              Edit{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                lib/tokens.ts
              </code>{" "}
              to surface additional tokens.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
