"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, LogOut, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { NETWORKS } from "@/lib/networks";
import { getNativeBalance } from "@/lib/wdk-client";
import { clearVault } from "@/lib/storage";
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

  // Bounce back to the landing if there's no open wallet handle. This is the
  // template's session-only behavior — a real production wallet would prompt
  // for password to decrypt the stored vault instead.
  useEffect(() => {
    if (!handle) {
      router.replace("/");
    }
  }, [handle, router]);

  const refreshBalance = useCallback(async () => {
    if (!handle) return;
    setRefreshing(true);
    try {
      const lamports = await getNativeBalance(handle);
      setBalance(lamports);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      setBalance(null);
    } finally {
      setRefreshing(false);
    }
  }, [handle, setBalance]);

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

  function logout() {
    reset();
    clearVault();
    router.replace("/");
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
            onClick={logout}
            aria-label="Log out and clear local data"
          >
            <LogOut size={14} /> Log out
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

        {/* Actions — Send / Receive coming on day 2 */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/wallet/send"
            className={cn(
              "flex h-12 items-center justify-center rounded-lg bg-foreground text-background font-medium opacity-50 cursor-not-allowed",
            )}
            aria-disabled="true"
            onClick={(e) => e.preventDefault()}
          >
            Send
          </Link>
          <Link
            href="/wallet/receive"
            className={cn(
              "flex h-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 font-medium dark:bg-zinc-900 dark:text-zinc-100 opacity-50 cursor-not-allowed",
            )}
            aria-disabled="true"
            onClick={(e) => e.preventDefault()}
          >
            Receive
          </Link>
        </div>

        <p className="text-center text-xs text-zinc-500">
          Send & Receive flows ship in the next iteration of this template.
        </p>
      </div>
    </main>
  );
}
