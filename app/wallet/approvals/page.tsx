"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  RefreshCcw,
  ShieldOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chainSupportsApprovals,
  fetchApprovals,
  type TokenApproval,
} from "@/lib/approvals";
import { CHAIN_CONFIGS, NETWORK_LABEL, networkSpec } from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { cn, formatBalance, truncate } from "@/lib/utils";
import { setApproval } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

/**
 * ERC-20 approval explorer + revoker.
 *
 * Scans the last ~10k blocks of Approval events for the active EVM
 * account, resolves each unique (token, spender) pair's current
 * allowance, and lists everything still authorised. Each row carries
 * a single-click "Revoke" button that calls
 * `setApproval({ token, spender, amount: 0n })` via WDK.
 *
 * Pages out on non-EVM chains with a clear "approvals only exist
 * on EVM" affordance — the dashboard hides the page entry on those
 * chains too, but a direct URL hit shouldn't blow up.
 */
export default function ApprovalsPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [items, setItems] = useState<TokenApproval[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  const refresh = useCallback(async () => {
    if (!handle) return;
    const account = handle.accounts[activeChain];
    if (!account || !chainSupportsApprovals(activeChain)) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const approvals = await fetchApprovals(
        activeChain,
        handle.network,
        account.address,
      );
      setItems(approvals);
    } finally {
      setLoading(false);
    }
  }, [handle, activeChain]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const config = CHAIN_CONFIGS[activeChain];
  const spec = networkSpec(activeChain, handle.network);
  const isEvm = chainSupportsApprovals(activeChain);

  async function handleRevoke(approval: TokenApproval) {
    if (!handle) return;
    const key = `${approval.token}:${approval.spender}`;
    setRevoking(key);
    try {
      const result = await setApproval(handle, activeChain, {
        token: approval.token,
        spender: approval.spender,
        amount: 0n,
      });
      toast.success(`Revoked ${approval.symbol} approval.`);
      // Optimistic: remove the row immediately. Refresh will reconcile
      // once the next block is mined.
      setItems((prev) =>
        (prev ?? []).filter(
          (a) => a.token !== approval.token || a.spender !== approval.spender,
        ),
      );
      // Surface the explorer link via a follow-up toast so the user
      // can confirm on-chain.
      const url = spec.txExplorer(result.signature);
      toast.info(`Transaction submitted · ${truncate(result.signature, 6, 4)}`);
      // Open in new tab so the user keeps their context here.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't revoke the approval.",
      );
    } finally {
      setRevoking(null);
    }
  }

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
            <h1 className="text-3xl font-semibold tracking-tight">
              Token approvals
            </h1>
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
          {isEvm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              loading={loading}
              aria-label="Refresh approvals"
            >
              {!loading && <RefreshCcw size={14} />} Refresh
            </Button>
          )}
        </header>

        {!isEvm ? (
          <Card>
            <CardTitle>EVM-only feature</CardTitle>
            <CardDescription className="mt-2">
              Token approvals are an ERC-20 concept — they only exist on EVM
              chains. Switch to Ethereum, BSC, Polygon, Arbitrum, Base, or
              Optimism from the dashboard to see this account&apos;s standing
              approvals.
            </CardDescription>
          </Card>
        ) : (
          <>
            <Card className="border-amber-200 dark:border-amber-900/60">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div className="space-y-1">
                  <CardTitle className="text-sm">
                    Why this matters
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Every time you trade on a DEX, list an NFT, or bridge a
                    token, you authorise a contract to spend it on your behalf.
                    Those approvals never expire automatically — a malicious
                    or compromised contract can drain whatever you&apos;ve
                    approved at any moment. Revoke anything you don&apos;t
                    actively need.
                  </CardDescription>
                </div>
              </div>
            </Card>

            {loading && items == null ? (
              <Card className="!p-0">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </li>
                  ))}
                </ul>
              </Card>
            ) : items && items.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 py-10 text-center">
                <ShieldOff size={28} className="text-zinc-400" />
                <CardTitle className="text-base">No standing approvals</CardTitle>
                <CardDescription>
                  This account has no open ERC-20 approvals on {config.label}{" "}
                  {NETWORK_LABEL[handle.network].toLowerCase()} within the
                  last ~10,000 blocks scanned by the public RPC.
                </CardDescription>
                <CardDescription className="text-xs">
                  For full historical coverage on mainnet, plug a Helius /
                  Alchemy / QuickNode URL into Settings → Networks.
                </CardDescription>
              </Card>
            ) : (
              <Card className="!p-0">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items?.map((a) => {
                    const key = `${a.token}:${a.spender}`;
                    const isRevoking = revoking === key;
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 leading-tight">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{a.symbol}</p>
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                                a.unlimited
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                              )}
                            >
                              {a.unlimited
                                ? "Unlimited"
                                : formatBalance(a.allowance, a.decimals)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-zinc-500">
                            {a.name}
                          </p>
                          <p className="truncate font-mono text-[11px] text-zinc-500">
                            Spender:{" "}
                            <a
                              href={spec.addressExplorer(a.spender)}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-foreground hover:underline"
                            >
                              {truncate(a.spender, 6, 4)}
                              <ExternalLink
                                size={9}
                                className="ml-0.5 inline -translate-y-0.5"
                              />
                            </a>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => void handleRevoke(a)}
                          loading={isRevoking}
                          disabled={isRevoking}
                        >
                          <ShieldOff size={13} /> Revoke
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </>
        )}

        <Card className="border-dashed">
          <CardTitle className="text-sm">Scan coverage</CardTitle>
          <CardDescription className="mt-1 text-xs">
            Approvals are discovered by scanning Approval events on the
            public RPC, capped at the last 10,000 blocks (~24-48 hours of
            EVM history). For comprehensive coverage, override the RPC in
            Settings → Networks with a paid provider that lifts the log-
            range cap.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}
