"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CHAIN_CONFIGS, networkSpec } from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import { truncate } from "@/lib/utils";
import {
  getSolanaRecentTransactions,
  type SolanaTxSummary,
  type WalletHandle,
} from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

export default function HistoryPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [items, setItems] = useState<SolanaTxSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refresh = useCallback(async (h: WalletHandle) => {
    setLoading(true);
    try {
      if (activeChain === "solana") {
        const txs = await getSolanaRecentTransactions(h, 15);
        setItems(txs);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeChain]);

  useEffect(() => {
    if (handle) void refresh(handle);
  }, [handle, refresh]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const config = CHAIN_CONFIGS[activeChain];
  const spec = networkSpec(activeChain, handle.network);
  const activeAccount = handle.accounts[activeChain];

  // Chains other than Solana don't have a unified history endpoint exposed
  // by WDK today — fall back to a "view on explorer" affordance so users
  // can still inspect activity off-app.
  const isSolana = activeChain === "solana";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/wallet")}
          className="-ml-2"
        >
          <ArrowLeft size={14} /> Back
        </Button>

        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Recent transactions on{" "}
              <span className="font-medium text-foreground">{config.label}</span>
              {handle.network === "testnet" ? " (testnet)" : ""}
            </p>
          </div>
          {isSolana && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handle && refresh(handle)}
              loading={loading}
              aria-label="Refresh activity"
            >
              {!loading && <RefreshCcw size={14} />} Refresh
            </Button>
          )}
        </header>

        {!isSolana ? (
          <Card>
            <CardTitle className="text-base">
              History feed pending for {config.label}
            </CardTitle>
            <CardDescription className="mt-2">
              WDK&apos;s {config.label} module exposes per-signature receipt
              lookups, not a paginated list endpoint. To browse {config.label}{" "}
              activity for this account, use the chain explorer directly:
            </CardDescription>
            {activeAccount && (
              <a
                href={spec.addressExplorer(activeAccount.address)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Open on explorer <ExternalLink size={14} />
              </a>
            )}
          </Card>
        ) : !items ? (
          <Card className="flex flex-col items-center gap-3 py-10">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-current border-r-transparent text-zinc-500" />
            <p className="text-sm text-zinc-500">Loading activity…</p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <CardTitle className="text-base">No activity yet</CardTitle>
            <CardDescription>
              This account hasn&apos;t sent or received any transactions on{" "}
              {handle.network === "testnet" ? "Solana devnet" : "Solana"} yet.
            </CardDescription>
            {activeAccount && (
              <a
                href={spec.addressExplorer(activeAccount.address)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                View account on explorer <ExternalLink size={14} />
              </a>
            )}
          </Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((tx) => {
                const failed = tx.err !== null && tx.err !== undefined;
                const ts =
                  tx.blockTime != null
                    ? new Date(tx.blockTime * 1000)
                    : null;
                return (
                  <li key={tx.signature}>
                    <a
                      href={spec.txExplorer(tx.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            failed
                              ? "flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                              : "flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                          }
                        >
                          {failed ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                        </div>
                        <div className="leading-tight">
                          <p className="text-sm font-mono">
                            {truncate(tx.signature, 6, 6)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {failed ? "Failed · " : ""}
                            {ts
                              ? ts.toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : `slot ${tx.slot}`}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight
                        size={14}
                        className="shrink-0 text-zinc-400"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}
