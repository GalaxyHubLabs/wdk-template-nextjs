"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BookUser,
  Copy,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  ImageIcon,
  Lock,
  Plus,
  RefreshCcw,
  Settings,
  Trash2,
} from "lucide-react";

import { AddressAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  COMING_SOON_CHAINS,
  NETWORK_LABEL,
  type ChainId,
  type NetworkKey,
  networkSpec,
} from "@/lib/chains";
import {
  getCustomTokens,
  removeCustomToken,
  type CustomToken,
} from "@/lib/custom-tokens";
import {
  formatChange,
  formatUsd,
  getPriceChanges,
  getPrices,
  toUsd,
} from "@/lib/prices";
import {
  getNativeBalance,
  getSolanaRecentTransactions,
  getTetherTokenBalances,
  getTokenBalance,
  switchNetwork,
  type SolanaTxSummary,
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
  const setActiveNetwork = useWalletStore((s) => s.setActiveNetwork);
  const setHandle = useWalletStore((s) => s.setHandle);
  const nativeBalances = useWalletStore((s) => s.nativeBalances);
  const tetherBalances = useWalletStore((s) => s.tetherBalances);
  const prices = useWalletStore((s) => s.prices);
  const priceChanges = useWalletStore((s) => s.priceChanges);
  const setAllBalances = useWalletStore((s) => s.setAllBalances);
  const setPrices = useWalletStore((s) => s.setPrices);
  const clearBalances = useWalletStore((s) => s.clearBalances);
  const balanceHidden = useWalletStore((s) => s.balanceHidden);
  const toggleBalanceHidden = useWalletStore((s) => s.toggleBalanceHidden);
  const reset = useWalletStore((s) => s.reset);

  const [refreshing, setRefreshing] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [customBalances, setCustomBalances] = useState<Record<string, bigint>>({});
  /** Last 3 Solana transactions for the active account. `null` while the
   *  initial fetch is in-flight; `[]` after a confirmed empty response. */
  const [recentTx, setRecentTx] = useState<SolanaTxSummary[] | null>(null);

  useEffect(() => {
    setCustomTokens(getCustomTokens(activeChain));
    const onFocus = () => setCustomTokens(getCustomTokens(activeChain));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [activeChain]);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refreshBalances = useCallback(
    async (h: WalletHandle) => {
      setRefreshing(true);
      try {
        // Fetch native + Tether tokens + USD prices in parallel
        const [chainResults, priceData, changeData] = await Promise.all([
          Promise.all(
            CHAIN_IDS.map(async (chain) => {
              const [native, tethers] = await Promise.all([
                getNativeBalance(h, chain).catch(() => 0n),
                getTetherTokenBalances(h, chain).catch(() => ({})),
              ]);
              return [chain, native, tethers] as const;
            }),
          ),
          getPrices(),
          getPriceChanges(),
        ]);
        const natives: Partial<Record<ChainId, bigint>> = {};
        const tethers: Partial<Record<ChainId, Record<string, bigint>>> = {};
        for (const [chain, native, tetherMap] of chainResults) {
          natives[chain] = native;
          tethers[chain] = tetherMap;
        }
        setAllBalances(natives, tethers);
        setPrices(
          priceData as Record<string, number>,
          changeData as Record<string, number>,
        );

        // Custom tokens for the active chain
        const active = getCustomTokens(activeChain);
        if (active.length > 0) {
          const entries = await Promise.all(
            active.map(async (token) => {
              const bal = await getTokenBalance(h, activeChain, token.address).catch(
                () => 0n,
              );
              return [token.address, bal] as const;
            }),
          );
          setCustomBalances(Object.fromEntries(entries));
        } else {
          setCustomBalances({});
        }
      } finally {
        setRefreshing(false);
      }
    },
    [activeChain, setAllBalances, setPrices],
  );

  useEffect(() => {
    if (handle) {
      void refreshBalances(handle);
    }
  }, [handle, refreshBalances]);

  // Pull the most recent Solana transactions for the active account. Other
  // chains link out to their explorer instead — keeping multi-chain
  // history coverage out of scope avoids us partially reimplementing the
  // SDK's transaction view for every backend.
  useEffect(() => {
    if (!handle || activeChain !== "solana") {
      setRecentTx(null);
      return;
    }
    setRecentTx(null);
    void (async () => {
      try {
        const txs = await getSolanaRecentTransactions(handle, 3);
        setRecentTx(txs);
      } catch {
        setRecentTx([]);
      }
    })();
  }, [handle, activeChain, handle?.network, handle?.accountIndex]);

  const handleNetworkChange = useCallback(
    async (next: NetworkKey) => {
      if (!handle || next === handle.network) return;
      setSwitchingNetwork(true);
      try {
        clearBalances();
        const newHandle = await switchNetwork(handle, next);
        setHandle(newHandle);
        setActiveNetwork(next);
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

  // ─── Derived values ───────────────────────────────────────────────────

  const activeAccount = handle.accounts[activeChain];
  const activeConfig = CHAIN_CONFIGS[activeChain];
  const activeSpec = networkSpec(activeChain, handle.network);
  const nativeBalance = nativeBalances[activeChain] ?? null;

  // Per-chain USD totals (for portfolio header)
  const chainUsd: Partial<Record<ChainId, number>> = {};
  for (const chain of CHAIN_IDS) {
    const cfg = CHAIN_CONFIGS[chain];
    const native = nativeBalances[chain];
    const nativeUsd = toUsd(native ?? 0n, cfg.nativeDecimals, prices[cfg.nativePriceId]) ?? 0;
    let tetherUsd = 0;
    const spec = networkSpec(chain, handle.network);
    const tetherBals = tetherBalances[chain] ?? {};
    for (const t of spec.tetherTokens) {
      const bal = tetherBals[t.address] ?? 0n;
      tetherUsd += toUsd(bal, t.decimals, prices[t.priceId]) ?? 0;
    }
    chainUsd[chain] = nativeUsd + tetherUsd;
  }
  const portfolioTotal = Object.values(chainUsd).reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0,
  );
  /** True once at least one chain's native balance has resolved. Used to
   *  decide between showing a skeleton (initial load) versus the
   *  computed total (real data, possibly $0). */
  const balancesLoaded = CHAIN_IDS.some((c) => nativeBalances[c] != null);

  const nativeUsdValue = toUsd(
    nativeBalance ?? 0n,
    activeConfig.nativeDecimals,
    prices[activeConfig.nativePriceId],
  );

  // ─── Handlers ────────────────────────────────────────────────────────

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

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        {/* Portfolio total — the headline of the wallet */}
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Portfolio
              </p>
              <button
                type="button"
                onClick={toggleBalanceHidden}
                aria-label={balanceHidden ? "Show balances" : "Hide balances"}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
              >
                {balanceHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">
              {balanceHidden ? (
                "••••"
              ) : balancesLoaded ? (
                formatUsd(portfolioTotal)
              ) : (
                <Skeleton className="h-10 w-40" />
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              across {CHAIN_IDS.length} chains · {NETWORK_LABEL[handle.network]}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/wallet/addresses"
              className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
              aria-label="Address book"
              title="Address book"
            >
              <BookUser size={16} />
            </Link>
            <Link
              href="/settings"
              className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={16} />
            </Link>
            <Button variant="ghost" size="sm" onClick={lock} aria-label="Lock wallet">
              <Lock size={14} /> Lock
            </Button>
          </div>
        </div>

        {/* Chain + network selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            ariaLabel="Select chain"
            value={activeChain}
            onChange={(v) => setActiveChain(v as ChainId)}
            items={[
              ...CHAIN_IDS.map((chain) => {
                const c = CHAIN_CONFIGS[chain];
                const hasAcc = Boolean(handle.accounts[chain]);
                const usd = chainUsd[chain];
                return {
                  value: chain,
                  label: c.label,
                  sublabel: c.shortLabel,
                  leading: <ChainBadge chain={chain} />,
                  trailing:
                    hasAcc && !balanceHidden && usd != null
                      ? formatUsd(usd)
                      : undefined,
                  disabled: !hasAcc,
                };
              }),
              ...COMING_SOON_CHAINS.map((c) => ({
                value: `__coming_soon_${c.shortLabel}`,
                label: c.label,
                sublabel: "Coming soon",
                leading: (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logo}
                    alt={c.label}
                    className="h-6 w-6 rounded-full bg-zinc-100 opacity-50 dark:bg-zinc-800"
                    loading="lazy"
                  />
                ),
                trailing: c.note as string,
                disabled: true,
              })),
            ]}
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

        {switchingNetwork && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
            Re-binding wallet to {NETWORK_LABEL[handle.network === "mainnet" ? "testnet" : "mainnet"]}…
          </div>
        )}

        {/* Account card */}
        {activeAccount ? (
          <Card>
            <div className="flex items-start gap-4">
              {/* Deterministic per-address avatar — same input always
                  paints the same gradient so users learn their accounts
                  visually. Stacked next to the address summary. */}
              <AddressAvatar
                address={activeAccount.address}
                size={48}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <CardDescription>
                  {activeConfig.label} · {NETWORK_LABEL[handle.network]}
                </CardDescription>
                <div className="mt-1 flex items-center justify-between gap-3">
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
                <p className="mt-1 flex items-baseline gap-1.5 text-3xl font-semibold tracking-tight">
                  {balanceHidden ? (
                    "••••"
                  ) : nativeBalance == null ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    formatBalance(nativeBalance, activeConfig.nativeDecimals)
                  )}
                  <span className="text-lg font-medium text-zinc-500">
                    {activeConfig.nativeSymbol}
                  </span>
                </p>
                {!balanceHidden && (
                  <div className="mt-0.5 flex items-center gap-2 text-sm">
                    {nativeUsdValue == null ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      <span className="text-zinc-500">
                        {formatUsd(nativeUsdValue)}
                      </span>
                    )}
                    <PriceChangeBadge
                      change={priceChanges[activeConfig.nativePriceId]}
                    />
                  </div>
                )}
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
              The {activeConfig.label} RPC was unreachable when this wallet was
              opened. Lock and unlock to retry derivation.
            </CardDescription>
          </Card>
        )}

        {/* Faucet hint — only shows when this is a testnet account with zero
            native balance. Helps brand-new users actually use the wallet. */}
        {activeAccount &&
          handle.network === "testnet" &&
          activeSpec.faucetUrl &&
          (nativeBalance == null || nativeBalance === 0n) && (
            <a
              href={activeSpec.faucetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand-soft px-4 py-3 transition-all hover:bg-brand-soft hover:brightness-95"
            >
              <div className="flex items-center gap-3">
                <Droplets size={18} className="text-brand" />
                <div className="leading-tight">
                  <p className="text-sm font-medium text-foreground">
                    Get test {activeConfig.nativeSymbol} from the faucet
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Free testnet funds — no real money required.
                  </p>
                </div>
              </div>
              <ExternalLink size={14} className="text-brand" />
            </a>
          )}

        {/* Primary actions */}
        {activeAccount && (
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/wallet/send"
              className={cn(
                "flex h-12 items-center justify-center rounded-lg bg-brand text-brand-foreground font-medium transition-all hover:opacity-90 active:opacity-80",
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

        {/* Solana-only entry point into the collectibles view. Hidden on
            other chains since their NFT pipelines aren't wired yet. */}
        {activeAccount && activeChain === "solana" && (
          <Link
            href="/wallet/collectibles"
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                <ImageIcon size={16} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium">Collectibles</p>
                <p className="text-xs text-zinc-500">
                  Solana NFTs owned by this account
                </p>
              </div>
            </div>
            <span className="text-xs text-zinc-400">→</span>
          </Link>
        )}

        {/* Recent activity */}
        {activeAccount && (
          <Card>
            <div className="flex items-center justify-between">
              <CardDescription>Recent activity</CardDescription>
              <Link
                href="/wallet/history"
                className="text-xs text-zinc-500 hover:text-foreground"
              >
                See all →
              </Link>
            </div>
            <ActivityList
              chain={activeChain}
              recentTx={recentTx}
              spec={activeSpec}
              address={activeAccount.address}
            />
          </Card>
        )}

        {/* Tokens card */}
        {activeAccount && (
          <Card>
            <div className="flex items-center justify-between">
              <CardDescription>Tokens</CardDescription>
              <Link
                href="/wallet/tokens/add"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
                aria-label="Add custom token"
              >
                <Plus size={14} /> Add token
              </Link>
            </div>

            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* Canonical Tether tokens (USDT, XAUt, …) */}
              {activeSpec.tetherTokens.map((token) => {
                const bal = tetherBalances[activeChain]?.[token.address] ?? null;
                const usdValue = toUsd(bal, token.decimals, prices[token.priceId]);
                return (
                  <TokenRow
                    key={token.address}
                    logo={token.logo}
                    symbol={token.symbol}
                    name={`${token.name} on ${activeConfig.label}`}
                    balance={bal}
                    decimals={token.decimals}
                    usdValue={usdValue}
                    change={priceChanges[token.priceId]}
                    hidden={balanceHidden}
                  />
                );
              })}
              {/* User-added tokens */}
              {customTokens.map((token) => (
                <TokenRow
                  key={token.address}
                  logo={token.logo}
                  symbol={token.symbol}
                  name={token.name}
                  balance={customBalances[token.address] ?? null}
                  decimals={token.decimals}
                  usdValue={null}
                  change={undefined}
                  hidden={balanceHidden}
                  onRemove={() => {
                    removeCustomToken(activeChain, token.address);
                    setCustomTokens(getCustomTokens(activeChain));
                  }}
                />
              ))}
            </ul>

            {activeSpec.tetherTokens.length === 0 && customTokens.length === 0 && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                No tokens registered for {activeConfig.label}{" "}
                {NETWORK_LABEL[handle.network].toLowerCase()} yet. Switch to{" "}
                <button
                  onClick={() =>
                    void handleNetworkChange(
                      handle.network === "mainnet" ? "testnet" : "mainnet",
                    )
                  }
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {handle.network === "mainnet" ? "Testnet" : "Mainnet"}
                </button>{" "}
                or click <strong>Add token</strong> to import any contract.
              </p>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

function TokenRow({
  logo,
  symbol,
  name,
  balance,
  decimals,
  usdValue,
  change,
  hidden,
  onRemove,
}: {
  logo?: string;
  symbol: string;
  name: string;
  balance: bigint | null;
  decimals: number;
  usdValue: number | null;
  change: number | undefined;
  hidden: boolean;
  onRemove?: () => void;
}) {
  return (
    <li className="group flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={symbol}
            className="h-9 w-9 rounded-full bg-zinc-100 object-contain p-1 dark:bg-zinc-900"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {symbol.slice(0, 3).toUpperCase()}
          </div>
        )}
        <div className="leading-tight">
          <p className="text-sm font-medium">{symbol}</p>
          <p className="text-xs text-zinc-500">{name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <div className="font-mono text-sm">
            {hidden ? (
              "••••"
            ) : balance == null ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              formatBalance(balance, decimals)
            )}
          </div>
          {!hidden && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
              {usdValue != null ? (
                <span className="text-zinc-500">{formatUsd(usdValue)}</span>
              ) : balance != null ? null : (
                <Skeleton className="h-3 w-10" />
              )}
              <PriceChangeBadge change={change} compact />
            </div>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${symbol}`}
            className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Coloured percentage pill for a 24-hour price change. Hides itself
 * silently when there's no change data (e.g. CoinGecko throttled us)
 * so the layout doesn't reserve dead space.
 */
function PriceChangeBadge({
  change,
  compact = false,
}: {
  change: number | undefined;
  compact?: boolean;
}) {
  if (change == null || !isFinite(change)) return null;
  const isUp = change >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        compact ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        isUp
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
      )}
    >
      {formatChange(change)}
    </span>
  );
}

/**
 * Inline recent-activity list. For Solana we render the last 3 signatures
 * with status + relative timestamp directly. For every other chain we
 * surface a single "View activity on <explorer>" affordance — the WDK
 * modules for those chains don't expose a list endpoint, and we'd rather
 * link out than ship a partial reimplementation per chain.
 */
function ActivityList({
  chain,
  recentTx,
  spec,
  address,
}: {
  chain: ChainId;
  recentTx: SolanaTxSummary[] | null;
  spec: ReturnType<typeof networkSpec>;
  address: string;
}) {
  if (chain !== "solana") {
    return (
      <a
        href={spec.addressExplorer(address)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-600 transition-colors hover:border-brand/40 hover:text-foreground dark:border-zinc-800 dark:text-zinc-300"
      >
        <span>View activity on the chain explorer</span>
        <ExternalLink size={14} className="text-zinc-400" />
      </a>
    );
  }
  if (recentTx == null) {
    return (
      <div className="mt-3 space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (recentTx.length === 0) {
    return (
      <p className="mt-3 text-sm text-zinc-500">
        No transactions on this account yet — when you send or receive, the
        last few signatures will appear here.
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
      {recentTx.map((tx) => {
        const failed = tx.err != null;
        return (
          <li key={tx.signature} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-mono text-xs">
                {tx.signature.slice(0, 8)}…{tx.signature.slice(-6)}
              </p>
              <p className="text-[11px] text-zinc-500">
                {relativeTime(tx.blockTime)} · slot {tx.slot.toLocaleString()}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                failed
                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
              )}
            >
              {failed ? "Failed" : "Confirmed"}
            </span>
            <a
              href={spec.txExplorer(tx.signature)}
              target="_blank"
              rel="noreferrer"
              aria-label="View transaction on explorer"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
            >
              <ExternalLink size={12} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact "5m ago / 2h ago / Apr 3" formatter for transaction lists. */
function relativeTime(blockTime: number | null): string {
  if (!blockTime) return "—";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - blockTime));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86_400) return `${Math.floor(diffSec / 86_400)}d ago`;
  return new Date(blockTime * 1000).toLocaleDateString();
}

function ChainBadge({ chain, size = 24 }: { chain: ChainId; size?: number }) {
  const c = CHAIN_CONFIGS[chain];
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={c.logo}
      alt={c.label}
      width={size}
      height={size}
      className="rounded-full bg-zinc-100 dark:bg-zinc-800"
      loading="lazy"
    />
  );
}
