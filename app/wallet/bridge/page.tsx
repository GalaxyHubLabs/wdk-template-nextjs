"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Network as NetworkIcon,
  Repeat,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import {
  CHAIN_CONFIGS,
  NETWORK_LABEL,
  networkSpec,
  type ChainId,
} from "@/lib/chains";
import { looksLikeName, resolveName } from "@/lib/name-resolution";
import { formatUsd, toUsd } from "@/lib/prices";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { formatBalance, truncate } from "@/lib/utils";
import {
  executeBridge,
  isBridgeSupported,
  isLikelyAddressFor,
  quoteBridge,
  setApproval,
  type BridgeQuote,
} from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

/**
 * USDT0 cross-chain bridge.
 *
 * Powered by Tether's `@tetherto/wdk-protocol-bridge-usdt0-evm` —
 * an official WDK module that wraps the USDT0 LayerZero OFT
 * (Omnichain Fungible Token) bridge. Send USDT from any supported
 * EVM chain to any other supported EVM chain in one signature on
 * the source, with the bridged tokens landing on the destination
 * after LayerZero's relayers confirm (seconds to a few minutes).
 *
 * The flow is intentionally similar to /wallet/swap so the user
 * doesn't have to learn a new pattern: pick destination chain →
 * enter amount → approve USDT for the bridge router → quote →
 * confirm. The wallet's existing approvals page can revoke the
 * allowance later.
 */

type Step =
  | "form"
  | "approving"
  | "quoting"
  | "review"
  | "bridging"
  | "success";

/** EVM chains the wallet exposes as bridge source / destination. */
const EVM_FAMILY: ChainId[] = [
  "evm",
  "bsc",
  "polygon",
  "arbitrum",
  "base",
  "optimism",
];

export default function BridgePage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);
  const tetherBalances = useWalletStore((s) => s.tetherBalances);
  const prices = useWalletStore((s) => s.prices);

  const [step, setStep] = useState<Step>("form");
  const [targetChain, setTargetChain] = useState<ChainId | "">("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [resolvedRecipient, setResolvedRecipient] = useState<string | null>(
    null,
  );
  const [resolving, setResolving] = useState(false);
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  useEffect(() => {
    setStep("form");
    setTargetChain("");
    setRecipient("");
    setAmount("");
    setQuote(null);
    setSignature(null);
    setError(null);
  }, [activeChain]);

  // Default the recipient to the same address on the destination chain —
  // EVM keypair derives the same hex address on every EVM chain, so this
  // is the common case (bridging to your own address on a different L2).
  useEffect(() => {
    if (
      !recipient &&
      handle &&
      targetChain &&
      handle.accounts[targetChain]?.address
    ) {
      setRecipient(handle.accounts[targetChain]!.address);
    }
  }, [targetChain, handle, recipient]);

  // ENS resolution on the destination chain. Same pattern as the send form.
  useEffect(() => {
    if (!handle || !targetChain) return;
    const trimmed = recipient.trim();
    if (!looksLikeName(trimmed)) {
      setResolvedRecipient(null);
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    const timer = setTimeout(async () => {
      try {
        const addr = await resolveName(
          targetChain as ChainId,
          trimmed,
          handle.network,
        );
        if (cancelled) return;
        setResolvedRecipient(addr);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipient, targetChain, handle]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const sourceConfig = CHAIN_CONFIGS[activeChain];
  const sourceSpec = networkSpec(activeChain, handle.network);
  const supported = isBridgeSupported(activeChain);

  // USDT contract on the source chain — USDT0 expects the input token
  // address. Tether's canonical USDT mainnet deployment on each EVM
  // is registered in lib/chains.ts; we pick it out by symbol.
  const usdt = sourceSpec.tetherTokens.find((t) => t.symbol === "USDT");

  const targetConfig =
    targetChain && targetChain !== activeChain
      ? CHAIN_CONFIGS[targetChain as ChainId]
      : null;

  const amountUnits = useMemo(() => {
    if (!usdt) return null;
    return parseAmount(amount, usdt.decimals);
  }, [amount, usdt]);

  const effectiveRecipient = resolvedRecipient ?? recipient.trim();
  const recipientValid =
    targetChain &&
    isLikelyAddressFor(targetChain as ChainId, effectiveRecipient);

  const canQuote =
    supported &&
    usdt != null &&
    targetChain !== "" &&
    targetChain !== activeChain &&
    amountUnits != null &&
    amountUnits > 0n &&
    recipientValid &&
    !resolving;

  async function handleApproveAndQuote() {
    if (!handle || !usdt || amountUnits == null || !targetChain) return;
    setError(null);
    setStep("approving");
    try {
      // Bridge contract is auto-resolved by the WDK module from the
      // source chain. We approve uint256-max to the OFT router so
      // subsequent bridges of the same token skip the round-trip; the
      // user can revoke from /wallet/approvals any time.
      //
      // USDT0 wraps LayerZero OFT contracts. The actual OFT contract
      // address per chain is internal to the package — the SDK
      // resolves it at bridge time. For the approval we use the
      // canonical OFT helper address (USDT0 publishes the same one
      // across mainnets it supports). Production forks should verify
      // against the latest USDT0 docs.
      const USDT0_OFT_ROUTER =
        "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee";
      const MAX_APPROVAL =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
      await setApproval(handle, activeChain, {
        token: usdt.address,
        spender: USDT0_OFT_ROUTER,
        amount: MAX_APPROVAL,
      });
      toast.success(`Approved USDT for the USDT0 bridge.`);
      setStep("quoting");
      const q = await quoteBridge(handle, activeChain, {
        token: usdt.address,
        amount: amountUnits,
        recipient: effectiveRecipient,
        targetChain: targetChain as ChainId,
      });
      setQuote(q);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't quote the bridge.");
      setStep("form");
    }
  }

  async function handleBridge() {
    if (!handle || !usdt || amountUnits == null || !targetChain) return;
    setError(null);
    setStep("bridging");
    try {
      const result = await executeBridge(handle, activeChain, {
        token: usdt.address,
        amount: amountUnits,
        recipient: effectiveRecipient,
        targetChain: targetChain as ChainId,
      });
      setSignature(result.signature);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge failed.");
      setStep("review");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-md space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/wallet")}
          className="-ml-2"
        >
          <ArrowLeft size={14} /> Back
        </Button>

        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bridge USDT
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Cross-chain USDT via{" "}
            <a
              href="https://docs.wdk.tether.io/sdk/bridge-modules"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
            >
              Tether&apos;s WDK USDT0 protocol module
            </a>{" "}
            (LayerZero OFT).
          </p>
        </header>

        {!supported ? (
          <Card>
            <CardTitle>EVM-only feature</CardTitle>
            <CardDescription className="mt-2">
              USDT0 bridging starts from an EVM source chain. Switch to
              Ethereum, BSC, Polygon, Arbitrum, Base, or Optimism from the
              dashboard.
            </CardDescription>
          </Card>
        ) : !usdt ? (
          <Card>
            <CardTitle>USDT not configured on this chain</CardTitle>
            <CardDescription className="mt-2">
              {sourceConfig.label} doesn&apos;t have an official USDT
              deployment registered. Configure one via the env override
              (see <code>lib/chains.ts</code>) or switch to another EVM
              chain.
            </CardDescription>
          </Card>
        ) : step === "success" && signature ? (
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2
              size={40}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <CardTitle>Bridge submitted</CardTitle>
            <CardDescription>
              {amountUnits != null && targetConfig &&
                `Sent ${formatBalance(amountUnits, usdt.decimals)} USDT to ${targetConfig.label}. LayerZero relays usually complete in seconds to a few minutes.`}
            </CardDescription>
            <a
              href={sourceSpec.txExplorer(signature)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              View source tx <ExternalLink size={14} />
            </a>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep("form");
                setAmount("");
                setQuote(null);
                setSignature(null);
              }}
            >
              <Repeat size={14} /> Bridge again
            </Button>
          </Card>
        ) : (
          <Card className="space-y-3">
            {/* Source → target chain route. Bigger visual block so the
                cross-chain nature of the action reads at a glance. */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Route
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceConfig.logo}
                    alt={sourceConfig.label}
                    className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium">
                      {sourceConfig.label}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      From
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="shrink-0 text-zinc-400" />
                <div className="flex-1">
                  <Dropdown
                    ariaLabel="Destination chain"
                    value={targetChain || ""}
                    onChange={(v) => {
                      setTargetChain(v as ChainId);
                      setQuote(null);
                      setRecipient("");
                    }}
                    items={EVM_FAMILY.filter((c) => c !== activeChain).map(
                      (id) => {
                        const c = CHAIN_CONFIGS[id];
                        return {
                          value: id,
                          label: c.label,
                          sublabel: c.shortLabel,
                          leading: (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.logo}
                              alt={c.label}
                              className="h-5 w-5 rounded-full bg-zinc-100 dark:bg-zinc-800"
                              loading="lazy"
                            />
                          ),
                        };
                      },
                    )}
                    triggerLeading={
                      targetConfig ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={targetConfig.logo}
                          alt={targetConfig.label}
                          className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800"
                          loading="lazy"
                        />
                      ) : (
                        <NetworkIcon size={14} />
                      )
                    }
                    buttonClassName="h-12 bg-white dark:bg-zinc-950"
                  />
                </div>
              </div>
            </div>

            {/* Amount + USDT balance pair. Single visual block with the
                balance + Max affordance built in, mirroring the swap
                page's SwapField. */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                <span>You send</span>
                {(() => {
                  const usdtBal =
                    tetherBalances[activeChain]?.[usdt.address] ?? 0n;
                  return (
                    <span>
                      Balance:{" "}
                      <span className="font-mono text-foreground">
                        {formatBalance(usdtBal, usdt.decimals)}
                      </span>{" "}
                      USDT
                    </span>
                  );
                })()}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-12 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={usdt.logo}
                    alt="USDT"
                    className="h-6 w-6 rounded-full"
                    loading="lazy"
                  />
                  <span className="text-sm font-medium">USDT</span>
                </div>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setQuote(null);
                    if (step === "review") setStep("form");
                  }}
                  placeholder="0.00"
                  disabled={step === "approving" || step === "bridging"}
                  className="h-12 flex-1 border-none bg-transparent text-right font-mono text-xl shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                <span>
                  {amountUnits != null
                    ? formatUsd(
                        toUsd(amountUnits, usdt.decimals, prices[usdt.priceId]),
                      )
                    : "—"}
                </span>
                {(tetherBalances[activeChain]?.[usdt.address] ?? 0n) > 0n && (
                  <button
                    type="button"
                    onClick={() => {
                      const bal =
                        tetherBalances[activeChain]?.[usdt.address] ?? 0n;
                      setAmount(formatBalance(bal, usdt.decimals));
                      setQuote(null);
                    }}
                    className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 transition-colors hover:border-brand/40 hover:text-foreground dark:border-zinc-800 dark:text-zinc-300"
                  >
                    Max
                  </button>
                )}
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Recipient on {targetConfig?.label ?? "destination"}
              </label>
              <Input
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setQuote(null);
                }}
                placeholder={
                  targetConfig ? `${targetConfig.label} address or .eth` : "0x…"
                }
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              {resolving && (
                <p className="text-xs text-zinc-500">Resolving name…</p>
              )}
              {!resolving && resolvedRecipient && (
                <p className="break-all text-xs text-emerald-600 dark:text-emerald-400">
                  → {truncate(resolvedRecipient, 8, 8)}
                </p>
              )}
              {targetChain && handle.accounts[targetChain as ChainId] && (
                <button
                  type="button"
                  onClick={() =>
                    setRecipient(
                      handle.accounts[targetChain as ChainId]?.address ?? "",
                    )
                  }
                  className="text-[11px] text-zinc-500 underline-offset-2 hover:text-foreground hover:underline"
                >
                  Use my{" "}
                  {CHAIN_CONFIGS[targetChain as ChainId]?.label ?? ""} address
                </button>
              )}
            </div>

            {/* Quote info */}
            {step === "review" && quote && targetConfig && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <Row label="Source fee">
                  <span className="font-mono">
                    {quote.fee === 0n
                      ? "—"
                      : `${formatBalance(quote.fee, sourceConfig.nativeDecimals)} ${sourceConfig.nativeSymbol}`}
                  </span>
                </Row>
                <Row label="Bridge fee">
                  <span className="font-mono">
                    {quote.bridgeFee === 0n
                      ? "—"
                      : `${formatBalance(quote.bridgeFee, sourceConfig.nativeDecimals)} ${sourceConfig.nativeSymbol}`}
                  </span>
                </Row>
                <Row label="Powered by">
                  <span className="font-medium">USDT0 · WDK</span>
                </Row>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            {step === "form" && (
              <Button
                type="button"
                onClick={handleApproveAndQuote}
                disabled={!canQuote}
                className="w-full"
              >
                <NetworkIcon size={16} /> Approve USDT & quote
              </Button>
            )}
            {step === "approving" && (
              <Button type="button" loading disabled className="w-full">
                Approving USDT…
              </Button>
            )}
            {step === "quoting" && (
              <Button type="button" loading disabled className="w-full">
                Quoting bridge…
              </Button>
            )}
            {step === "review" && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep("form");
                    setQuote(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleBridge}
                  className="flex-1"
                >
                  <ArrowRight size={16} /> Confirm bridge
                </Button>
              </div>
            )}
            {step === "bridging" && (
              <Button type="button" loading disabled className="w-full">
                Bridging…
              </Button>
            )}
          </Card>
        )}

        <Card className="border-dashed">
          <CardTitle className="text-sm">How this is wired</CardTitle>
          <CardDescription className="mt-1 text-xs">
            Every bridge goes through{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              @tetherto/wdk-protocol-bridge-usdt0-evm
            </code>{" "}
            with the active EVM account from the same{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              WdkManager
            </code>{" "}
            that powers the rest of the wallet. USDT0 uses LayerZero OFT
            under the hood — same security model used by Tether for
            cross-chain USDT.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-zinc-500">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function parseAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return null;
  }
}

