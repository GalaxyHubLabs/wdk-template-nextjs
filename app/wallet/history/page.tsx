"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHAIN_CONFIGS,
  NETWORK_LABEL,
  networkSpec,
  type ChainId,
} from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import { cn, formatBalance, truncate } from "@/lib/utils";
import {
  getEvmRecentTransactions,
  getSolanaRecentTransactions,
  type EvmTxSummary,
  type SolanaTxSummary,
  type WalletHandle,
} from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

/**
 * Activity page.
 *
 * Unified view across all supported chains: Solana via the JSON-RPC
 * `getSignaturesForAddress`, EVM-family via each chain's Etherscan-
 * compatible API. Failed lookups fall back to a "view on explorer"
 * affordance rather than failing silently.
 *
 * Transactions are normalised to a single `Activity` row and grouped
 * by day so the list reads as a journal instead of a flat dump.
 */

type Direction = "sent" | "received" | "neutral";

interface Activity {
  /** Stable identity for React keys. */
  id: string;
  signature: string;
  /** Unix-seconds timestamp. null when the API didn't return one. */
  blockTime: number | null;
  failed: boolean;
  direction: Direction;
  /** Native-asset amount in chain-smallest units. 0n when unknown. */
  amount: bigint;
  /** Counterparty address (the "other" side of the transfer). */
  counterparty: string;
  /** URL to the canonical explorer for this transaction. */
  href: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [items, setItems] = useState<Activity[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refresh = useCallback(
    async (h: WalletHandle, chain: ChainId) => {
      setLoading(true);
      try {
        if (chain === "solana") {
          const txs = await getSolanaRecentTransactions(h, 20);
          const account = h.accounts.solana;
          const explorerTx = networkSpec("solana", h.network).txExplorer;
          setItems(txs.map((tx) => normaliseSolana(tx, account?.address ?? "", explorerTx)));
        } else if (isEvmFamily(chain)) {
          const txs = await getEvmRecentTransactions(h, chain, 20);
          const account = h.accounts[chain];
          const explorerTx = networkSpec(chain, h.network).txExplorer;
          setItems(
            txs.map((tx) =>
              normaliseEvm(tx, account?.address.toLowerCase() ?? "", explorerTx),
            ),
          );
        } else {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (handle) void refresh(handle, activeChain);
  }, [handle, activeChain, refresh]);

  const grouped = useMemo(() => groupByDay(items ?? []), [items]);

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
  const supportsInlineHistory =
    activeChain === "solana" || isEvmFamily(activeChain);

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
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logo}
                alt={config.label}
                className="h-4 w-4 rounded-full"
                loading="lazy"
              />
              <span className="font-medium text-foreground">{config.label}</span>
              <span aria-hidden>·</span>
              <span>{NETWORK_LABEL[handle.network]}</span>
            </p>
          </div>
          {supportsInlineHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handle && refresh(handle, activeChain)}
              loading={loading}
              aria-label="Refresh activity"
            >
              {!loading && <RefreshCcw size={14} />} Refresh
            </Button>
          )}
        </header>

        {!supportsInlineHistory ? (
          <Card>
            <CardTitle className="text-base">
              Inline history pending for {config.label}
            </CardTitle>
            <CardDescription className="mt-2">
              WDK&apos;s {config.label} module exposes per-signature receipt
              lookups but no paginated list endpoint. Use the chain explorer
              directly to browse activity for this account:
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
        ) : loading && items == null ? (
          <Card className="!p-0">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-3.5 w-16" />
                </li>
              ))}
            </ul>
          </Card>
        ) : items && items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <CardTitle className="text-base">No activity yet</CardTitle>
            <CardDescription>
              When you send or receive on {config.label}{" "}
              {NETWORK_LABEL[handle.network].toLowerCase()}, transactions will
              appear here.
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
          <div className="space-y-4">
            {grouped.map(({ label, rows }) => (
              <div key={label} className="space-y-1.5">
                <p className="px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {label}
                </p>
                <Card className="!p-0 overflow-hidden">
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rows.map((tx) => (
                      <ActivityRow
                        key={tx.id}
                        tx={tx}
                        chain={activeChain}
                        decimals={config.nativeDecimals}
                        symbol={config.nativeSymbol}
                      />
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────

function ActivityRow({
  tx,
  decimals,
  symbol,
}: {
  tx: Activity;
  chain: ChainId;
  decimals: number;
  symbol: string;
}) {
  return (
    <li>
      <a
        href={tx.href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <div className="flex min-w-0 items-center gap-3">
          <StatusBadge failed={tx.failed} direction={tx.direction} />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-mono text-sm">
              {truncate(tx.signature, 6, 6)}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {tx.failed
                ? "Failed"
                : tx.direction === "sent"
                  ? "Sent"
                  : tx.direction === "received"
                    ? "Received"
                    : "Interaction"}
              {tx.counterparty &&
                tx.direction !== "neutral" &&
                ` · ${tx.direction === "sent" ? "to" : "from"} ${truncate(tx.counterparty, 5, 4)}`}
              {tx.blockTime &&
                ` · ${new Date(tx.blockTime * 1000).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right">
          {tx.amount > 0n && tx.direction !== "neutral" ? (
            <span
              className={cn(
                "font-mono text-sm",
                tx.direction === "sent"
                  ? "text-foreground"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {tx.direction === "sent" ? "−" : "+"}
              {formatBalance(tx.amount, decimals)} {symbol}
            </span>
          ) : null}
          <ArrowUpRight size={14} className="text-zinc-400" />
        </div>
      </a>
    </li>
  );
}

function StatusBadge({
  failed,
  direction,
}: {
  failed: boolean;
  direction: Direction;
}) {
  if (failed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
        <XCircle size={16} />
      </div>
    );
  }
  if (direction === "sent") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        <ArrowUpRight size={16} />
      </div>
    );
  }
  if (direction === "received") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
        <ArrowDownLeft size={16} />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
      <CheckCircle2 size={16} />
    </div>
  );
}

// ─── Normalisation + grouping ────────────────────────────────────────

function normaliseSolana(
  tx: SolanaTxSummary,
  _self: string,
  txExplorer: (id: string) => string,
): Activity {
  // Solana's signatures-for-address endpoint doesn't include the from/to
  // pair without an extra getTransaction call. We surface the activity as
  // "neutral" and let the user click into the explorer for the breakdown.
  return {
    id: tx.signature,
    signature: tx.signature,
    blockTime: tx.blockTime,
    failed: tx.err !== null && tx.err !== undefined,
    direction: "neutral",
    amount: 0n,
    counterparty: "",
    href: txExplorer(tx.signature),
  };
}

function normaliseEvm(
  tx: EvmTxSummary,
  selfLower: string,
  txExplorer: (id: string) => string,
): Activity {
  let direction: Direction = "neutral";
  let counterparty = "";
  if (selfLower) {
    if (tx.from === selfLower) {
      direction = "sent";
      counterparty = tx.to;
    } else if (tx.to === selfLower) {
      direction = "received";
      counterparty = tx.from;
    }
  }
  return {
    id: tx.hash,
    signature: tx.hash,
    blockTime: tx.blockTime,
    failed: tx.failed,
    direction,
    amount: tx.value,
    counterparty,
    href: txExplorer(tx.hash),
  };
}

function groupByDay(
  items: Activity[],
): Array<{ label: string; rows: Activity[] }> {
  const today = startOfDay(new Date());
  const yesterday = startOfDay(new Date(today.getTime() - 24 * 3600 * 1000));
  const groups = new Map<string, Activity[]>();
  for (const tx of items) {
    const key =
      tx.blockTime != null
        ? labelFor(new Date(tx.blockTime * 1000), today, yesterday)
        : "Unknown";
    const arr = groups.get(key) ?? [];
    arr.push(tx);
    groups.set(key, arr);
  }
  // Preserve insertion order — items come in newest-first already.
  return Array.from(groups, ([label, rows]) => ({ label, rows }));
}

function labelFor(date: Date, today: Date, yesterday: Date): string {
  const dayStart = startOfDay(date);
  if (dayStart.getTime() === today.getTime()) return "Today";
  if (dayStart.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isEvmFamily(chain: ChainId): boolean {
  return (
    chain === "evm" ||
    chain === "bsc" ||
    chain === "polygon" ||
    chain === "arbitrum" ||
    chain === "base" ||
    chain === "optimism"
  );
}
