"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  ExternalLink,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";

import { AddressAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CHAIN_CONFIGS,
  NETWORK_LABEL,
  networkSpec,
} from "@/lib/chains";
import { formatUsd, getPrices, toUsd } from "@/lib/prices";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { cn, formatBalance, truncate } from "@/lib/utils";
import {
  fetchNativeBalance,
  fetchTetherBalances,
} from "@/lib/watch-balances";
import {
  getWatchEntry,
  removeWatchEntry,
  renameWatchEntry,
  type WatchEntry,
} from "@/lib/watch-list";
import { useWalletStore } from "@/store/wallet";

export default function WatchAddressPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  const handle = useWalletStore((s) => s.handle);
  const activeNetwork = useWalletStore((s) => s.activeNetwork);
  const balanceHidden = useWalletStore((s) => s.balanceHidden);

  const [entry, setEntry] = useState<WatchEntry | null>(null);
  const [native, setNative] = useState<bigint | null>(null);
  const [tethers, setTethers] = useState<Record<string, bigint | null>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  useEffect(() => {
    if (!id) return;
    const found = getWatchEntry(id);
    if (!found) {
      setMissing(true);
      return;
    }
    setEntry(found);
    setLabelDraft(found.label);
  }, [id]);

  // The wallet's active network is the source of truth for which RPC to
  // query — watch entries don't carry their own network, they ride the
  // same global toggle as your seed-derived accounts.
  const network = handle?.network ?? activeNetwork;

  const config = entry ? CHAIN_CONFIGS[entry.chain] : null;
  const spec = useMemo(
    () => (entry ? networkSpec(entry.chain, network) : null),
    [entry, network],
  );

  const refresh = useCallback(
    async (e: WatchEntry, net: typeof network) => {
      setRefreshing(true);
      try {
        const [nativeBal, tetherMap, priceData] = await Promise.all([
          fetchNativeBalance(e.chain, net, e.address),
          fetchTetherBalances(e.chain, net, e.address),
          getPrices(),
        ]);
        setNative(nativeBal);
        setTethers(tetherMap);
        setPrices(priceData as Record<string, number>);
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (entry) {
      void refresh(entry, network);
    }
    // Refresh whenever the active network flips at the dashboard level,
    // so a Mainnet ↔ Testnet toggle propagates here too.
  }, [entry, network, refresh]);

  if (missing) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-sm text-zinc-500">
            This watched address was removed or doesn&apos;t exist on this
            device.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            <ArrowLeft size={14} /> Back to settings
          </Link>
        </div>
      </main>
    );
  }

  if (!handle || !entry || !config || !spec) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  const nativeUsd = toUsd(native, config.nativeDecimals, prices[config.nativePriceId]);
  const totalUsd =
    (nativeUsd ?? 0) +
    spec.tetherTokens.reduce((sum, t) => {
      const bal = tethers[t.address];
      return sum + (toUsd(bal ?? 0n, t.decimals, prices[t.priceId]) ?? 0);
    }, 0);

  async function copyAddress() {
    if (!entry) return;
    try {
      await navigator.clipboard.writeText(entry.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function saveLabel() {
    if (!entry) return;
    const next = labelDraft.trim();
    if (next && next !== entry.label) {
      renameWatchEntry(entry.id, next);
      setEntry({ ...entry, label: next });
      toast.success("Renamed.");
    }
    setEditing(false);
  }

  function remove() {
    if (!entry) return;
    if (
      !window.confirm(
        `Stop watching ${entry.label}? You can add it again from Settings → Add account → Watch any address.`,
      )
    ) {
      return;
    }
    removeWatchEntry(entry.id);
    toast.info(`Stopped watching ${entry.label}.`);
    router.push("/settings");
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Read-only banner */}
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <Eye size={14} />
          <span>
            Watch-only — keys for this address are not on this device. You
            can&apos;t send from it.
          </span>
        </div>

        {/* Header: label + chain + actions */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {editing ? (
              <Input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={saveLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabel();
                  if (e.key === "Escape") {
                    setLabelDraft(entry.label);
                    setEditing(false);
                  }
                }}
                maxLength={32}
                className="text-lg font-semibold"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate text-3xl font-semibold tracking-tight">
                  {entry.label}
                </h1>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Rename"
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logo}
                alt={config.label}
                className="h-4 w-4 rounded-full bg-zinc-100 dark:bg-zinc-800"
                loading="lazy"
              />
              <span>{config.label}</span>
              <span aria-hidden>·</span>
              <span>{NETWORK_LABEL[network]}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={remove}
            aria-label="Stop watching"
            className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            <Trash2 size={14} />
          </button>
        </header>

        {/* Address card */}
        <Card>
          <div className="flex items-start gap-4">
            <AddressAvatar address={entry.address} size={48} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <CardDescription>Address</CardDescription>
              <div className="mt-1 flex items-center justify-between gap-3">
                <CardTitle className="break-all font-mono text-lg">
                  {truncate(entry.address, 6, 6)}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyAddress}
                    aria-label="Copy address"
                    className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <a
                    href={spec.addressExplorer(entry.address)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View on explorer"
                    className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between">
            <div>
              <CardDescription>Total value</CardDescription>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {balanceHidden ? "••••" : formatUsd(totalUsd)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {balanceHidden
                  ? "—"
                  : native == null
                    ? "—"
                    : `${formatBalance(native, config.nativeDecimals)} ${config.nativeSymbol}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => entry && refresh(entry, network)}
              loading={refreshing}
              aria-label="Refresh balances"
            >
              {!refreshing && <RefreshCcw size={14} />} Refresh
            </Button>
          </div>
        </Card>

        {/* Tokens */}
        {spec.tetherTokens.length > 0 && (
          <Card>
            <CardDescription>Tether tokens</CardDescription>
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {spec.tetherTokens.map((token) => {
                const bal = tethers[token.address];
                const usdValue = toUsd(
                  bal ?? 0n,
                  token.decimals,
                  prices[token.priceId],
                );
                return (
                  <li
                    key={token.address}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {token.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={token.logo}
                          alt={token.symbol}
                          className="h-9 w-9 rounded-full bg-zinc-100 object-contain p-1 dark:bg-zinc-900"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                          {token.symbol.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <div className="leading-tight">
                        <p className="text-sm font-medium">{token.symbol}</p>
                        <p className="text-xs text-zinc-500">
                          {token.name} on {config.label}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">
                        {balanceHidden
                          ? "••••"
                          : bal == null
                            ? "—"
                            : formatBalance(bal, token.decimals)}
                      </p>
                      {!balanceHidden && bal != null && usdValue != null && (
                        <p className="text-[11px] text-zinc-500">
                          {formatUsd(usdValue)}
                        </p>
                      )}
                      {!balanceHidden && bal == null && (
                        <p className="text-[11px] text-zinc-400">
                          <a
                            href={spec.addressExplorer(entry.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            View on explorer
                          </a>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Disabled actions footer — make it explicit that send is unavailable */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              "flex h-12 items-center justify-center rounded-lg bg-zinc-100 font-medium text-zinc-400 dark:bg-zinc-900",
            )}
            aria-disabled
            title="Send is disabled for watch-only addresses"
          >
            Send
          </div>
          <a
            href={spec.addressExplorer(entry.address)}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-100 font-medium text-zinc-900 transition-all hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <ExternalLink size={14} /> View on explorer
          </a>
        </div>
      </div>
    </main>
  );
}
