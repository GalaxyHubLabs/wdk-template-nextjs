"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Lock,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  NETWORK_LABEL,
  type ChainId,
  type NetworkKey,
  networkSpec,
} from "@/lib/chains";
import {
  getNativeBalance,
  getUsdtBalance,
  switchNetwork,
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
  const activeNetwork = useWalletStore((s) => s.activeNetwork);
  const setActiveNetwork = useWalletStore((s) => s.setActiveNetwork);
  const setHandle = useWalletStore((s) => s.setHandle);
  const nativeBalances = useWalletStore((s) => s.nativeBalances);
  const usdtBalances = useWalletStore((s) => s.usdtBalances);
  const setAllBalances = useWalletStore((s) => s.setAllBalances);
  const clearBalances = useWalletStore((s) => s.clearBalances);
  const balanceHidden = useWalletStore((s) => s.balanceHidden);
  const toggleBalanceHidden = useWalletStore((s) => s.toggleBalanceHidden);
  const reset = useWalletStore((s) => s.reset);

  const [refreshing, setRefreshing] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refreshBalances = useCallback(
    async (h: WalletHandle) => {
      setRefreshing(true);
      try {
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
    },
    [setAllBalances],
  );

  // Initial balance fetch when the wallet first loads.
  useEffect(() => {
    if (handle) {
      void refreshBalances(handle);
    }
  }, [handle, refreshBalances]);

  const handleNetworkChange = useCallback(
    async (next: NetworkKey) => {
      if (!handle || next === handle.network) return;
      setSwitchingNetwork(true);
      try {
        clearBalances();
        const newHandle = await switchNetwork(handle, next);
        setHandle(newHandle);
        setActiveNetwork(next);
        // Balances will be refetched by the effect below once the new
        // handle is in the store.
      } catch (err) {
        console.error("Failed to switch network:", err);
      } finally {
        setSwitchingNetwork(false);
      }
    },
    [handle, clearBalances, setHandle, setActiveNetwork],
  );

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const activeAccount = handle.accounts[activeChain];
  const activeConfig = CHAIN_CONFIGS[activeChain];
  const activeSpec = networkSpec(activeChain, handle.network);
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
        {/* Top bar: chain selector + network selector + lock */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              ariaLabel="Select chain"
              value={activeChain}
              onChange={(v) => setActiveChain(v as ChainId)}
              items={CHAIN_IDS.map((chain) => {
                const c = CHAIN_CONFIGS[chain];
                const hasAcc = Boolean(handle.accounts[chain]);
                const bal = nativeBalances[chain];
                return {
                  value: chain,
                  label: c.label,
                  sublabel: c.shortLabel,
                  leading: <ChainBadge chain={chain} />,
                  trailing: hasAcc && bal != null && !balanceHidden
                    ? `${formatBalance(bal, c.nativeDecimals)} ${c.nativeSymbol}`
                    : undefined,
                  disabled: !hasAcc,
                };
              })}
              triggerLeading={<ChainBadge chain={activeChain} />}
            />
            <Dropdown
              ariaLabel="Select network"
              value={handle.network}
              onChange={(v) => void handleNetworkChange(v as NetworkKey)}
              items={[
                {
                  value: "mainnet",
                  label: "Mainnet",
                  sublabel: "Live assets",
                  leading: <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />,
                },
                {
                  value: "testnet",
                  label: "Testnet",
                  sublabel: "Faucet funds only",
                  leading: <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />,
                },
              ]}
              triggerLeading={
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    handle.network === "mainnet" ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
              }
            />
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

        {switchingNetwork && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
            Re-binding wallet to {NETWORK_LABEL[handle.network === "mainnet" ? "testnet" : "mainnet"]}…
          </div>
        )}

        {/* Active chain account card */}
        {activeAccount ? (
          <Card>
            <CardDescription>
              {activeConfig.label} · {NETWORK_LABEL[handle.network]}
            </CardDescription>
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
                  href={activeSpec.addressExplorer(activeAccount.address)}
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
              was opened. Lock and unlock to retry derivation.
            </CardDescription>
          </Card>
        )}

        {/* Primary actions */}
        {activeAccount && (
          <div className="grid grid-cols-3 gap-3">
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
            <Link
              href="/wallet/history"
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 font-medium transition-all hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              <History size={14} /> History
            </Link>
          </div>
        )}

        {/* USDT card — only render when the active chain × network has USDT */}
        {activeAccount && activeSpec.usdt && (
          <Card>
            <CardDescription>Tokens</CardDescription>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                {activeSpec.usdt.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeSpec.usdt.logo}
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
                    : formatBalance(usdtBalance, activeSpec.usdt.decimals)}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              SPL / jetton / TRC-20 / ERC-20 transfer flows ship next. Add more
              tokens in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                lib/chains.ts
              </code>
              .
            </p>
          </Card>
        )}

        {/* When no USDT is configured for this chain × network, show a
            constructive hint instead of an empty section. */}
        {activeAccount && !activeSpec.usdt && (
          <Card>
            <CardDescription>Tokens</CardDescription>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              No USDT contract is registered for {activeConfig.label}{" "}
              {NETWORK_LABEL[handle.network].toLowerCase()}. Switch to{" "}
              <button
                onClick={() => void handleNetworkChange(handle.network === "mainnet" ? "testnet" : "mainnet")}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {handle.network === "mainnet" ? "Testnet" : "Mainnet"}
              </button>
              {handle.network === "mainnet"
                ? " for a test deployment, or "
                : " for the live USDT contract, or "}
              point{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                NEXT_PUBLIC_{activeConfig.id.toUpperCase()}_USDT_{handle.network.toUpperCase()}
              </code>{" "}
              at your own deployment.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

function ChainBadge({ chain }: { chain: ChainId }) {
  const c = CHAIN_CONFIGS[chain];
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {c.shortLabel.slice(0, 3)}
    </span>
  );
}
