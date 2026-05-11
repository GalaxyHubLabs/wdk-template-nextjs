"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  ExternalLink,
  Repeat,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { CHAIN_CONFIGS, NETWORK_LABEL, networkSpec } from "@/lib/chains";
import { getCustomTokens } from "@/lib/custom-tokens";
import { formatUsd, toUsd } from "@/lib/prices";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { formatBalance } from "@/lib/utils";
import {
  executeSwap,
  isSwapSupported,
  quoteSwap,
  setApproval,
  type SwapQuote,
} from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

/**
 * Token swap via Tether's WDK Velora protocol module.
 *
 * Velora (the new branding of ParaSwap) is an EVM aggregator that
 * Tether ships an official WDK module for:
 * `@tetherto/wdk-protocol-swap-velora-evm`. We instantiate it with
 * the active EVM account from the WalletHandle and surface its
 * `quoteSwap` + `swap` methods.
 *
 * Flow: pick `from` asset → pick `to` asset → enter amount → quote.
 * Velora requires an ERC-20 allowance for the input token; we
 * surface that approval as an explicit step before the swap so the
 * user can review what they're authorising. Native input doesn't
 * need approval and skips that step.
 *
 * Available on every EVM-family chain the template supports
 * (Ethereum, BSC, Polygon, Arbitrum, Base, Optimism). The dashboard
 * hides the entry point on non-EVM chains.
 */

type Step = "form" | "approving" | "quoting" | "review" | "swapping" | "success";

/** Velora identifier for the native asset on every EVM chain. The
 *  protocol accepts this constant as `tokenIn` or `tokenOut` to mean
 *  "the chain's native asset, not an ERC-20". */
const NATIVE_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

interface SwapAsset {
  /** Display key for the selector. */
  key: string;
  symbol: string;
  name: string;
  decimals: number;
  /** ERC-20 contract address, or the Velora native sentinel. */
  address: string;
  logo?: string;
  /** Available balance in chain-smallest units. 0n when the user
   *  holds none of this asset (or we haven't fetched it yet). */
  balance: bigint;
  /** CoinGecko-style asset id used to look up the USD price. null
   *  when this asset isn't priced (e.g. user-imported tokens). */
  priceId: string | null;
}

export default function SwapPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);
  const nativeBalances = useWalletStore((s) => s.nativeBalances);
  const tetherBalances = useWalletStore((s) => s.tetherBalances);
  const prices = useWalletStore((s) => s.prices);

  const [step, setStep] = useState<Step>("form");
  const [fromKey, setFromKey] = useState<string>("native");
  const [toKey, setToKey] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  useEffect(() => {
    // Re-init when the chain changes — a Velora quote on Polygon makes
    // no sense if the user flipped to Optimism in the dashboard.
    setStep("form");
    setFromKey("native");
    setToKey("");
    setAmount("");
    setQuote(null);
    setSignature(null);
    setError(null);
  }, [activeChain]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const config = CHAIN_CONFIGS[activeChain];
  const spec = networkSpec(activeChain, handle.network);
  const supported = isSwapSupported(activeChain);

  // Available assets: native + every canonical Tether token + every
  // custom token the user has imported for the active chain. Each
  // entry carries the user's current balance + price id so the swap
  // form can show balances and USD values inline.
  const assets = useMemo<SwapAsset[]>(() => {
    if (!supported) return [];
    const native: SwapAsset = {
      key: "native",
      symbol: config.nativeSymbol,
      name: config.nativeName,
      decimals: config.nativeDecimals,
      address: NATIVE_SENTINEL,
      logo: config.logo,
      balance: nativeBalances[activeChain] ?? 0n,
      priceId: config.nativePriceId,
    };
    const tethers = spec.tetherTokens.map<SwapAsset>((t) => ({
      key: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      address: t.address,
      logo: t.logo,
      balance: tetherBalances[activeChain]?.[t.address] ?? 0n,
      priceId: t.priceId,
    }));
    const customs = getCustomTokens(activeChain).map<SwapAsset>((t) => ({
      key: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      address: t.address,
      logo: t.logo,
      // Custom-token balances aren't subscribed to in the swap store
      // slice; user can still type an amount they know they hold.
      balance: 0n,
      priceId: null,
    }));
    return [native, ...tethers, ...customs];
  }, [
    supported,
    config,
    activeChain,
    spec.tetherTokens,
    nativeBalances,
    tetherBalances,
  ]);

  const fromAsset = assets.find((a) => a.key === fromKey) ?? assets[0];
  const toAsset =
    assets.find((a) => a.key === toKey) ??
    assets.find((a) => a.key !== fromKey) ??
    null;

  const amountUnits = useMemo(() => {
    if (!fromAsset) return null;
    return parseAmount(amount, fromAsset.decimals);
  }, [amount, fromAsset]);

  const canQuote =
    supported &&
    fromAsset != null &&
    toAsset != null &&
    fromAsset.address !== toAsset.address &&
    amountUnits != null &&
    amountUnits > 0n;

  const needsApproval =
    fromAsset != null && fromAsset.address !== NATIVE_SENTINEL;

  async function handleQuote() {
    if (!canQuote || !handle || !fromAsset || !toAsset || amountUnits == null) {
      return;
    }
    setError(null);
    setStep("quoting");
    try {
      const result = await quoteSwap(handle, activeChain, {
        tokenIn: fromAsset.address,
        tokenOut: toAsset.address,
        amount: amountUnits,
        direction: "sell",
      });
      setQuote(result);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't quote the swap.");
      setStep("form");
    }
  }

  async function handleApprove() {
    if (!handle || !fromAsset || amountUnits == null) return;
    setStep("approving");
    setError(null);
    try {
      // Velora's router pulls tokens from the user's account, so the
      // input token's allowance must cover the swap amount. We use
      // uint256-max once per token so subsequent swaps of the same
      // pair don't require a fresh approval round-trip. The user can
      // always revoke later from /wallet/approvals.
      //
      // Velora v6 deploys the same router address across every EVM
      // chain in its supported set. Production forks should verify
      // against the latest Velora docs before going live with funds.
      const VELORA_ROUTER = "0x6A000F20005980200259B80c5102003040001068";
      const MAX_APPROVAL =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
      await setApproval(handle, activeChain, {
        token: fromAsset.address,
        spender: VELORA_ROUTER,
        amount: MAX_APPROVAL,
      });
      toast.success(`Approved ${fromAsset.symbol} for Velora.`);
      await handleQuote();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
      setStep("form");
    }
  }

  async function handleSwap() {
    if (!handle || !fromAsset || !toAsset || amountUnits == null) return;
    setStep("swapping");
    setError(null);
    try {
      const result = await executeSwap(handle, activeChain, {
        tokenIn: fromAsset.address,
        tokenOut: toAsset.address,
        amount: amountUnits,
        direction: "sell",
      });
      setSignature(result.signature);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed.");
      setStep("review");
    }
  }

  function swapAssets() {
    setFromKey(toKey || (assets[1]?.key ?? "native"));
    setToKey(fromKey);
    setQuote(null);
    setStep("form");
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
          <h1 className="text-3xl font-semibold tracking-tight">Swap</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Powered by{" "}
            <a
              href="https://docs.wdk.tether.io/sdk/swap-modules"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
            >
              Tether&apos;s WDK Velora protocol module
            </a>
            {" — "}
            <span className="font-medium text-foreground">
              {config.label} {NETWORK_LABEL[handle.network]}
            </span>
            .
          </p>
        </header>

        {!supported ? (
          <Card>
            <CardTitle>EVM-only feature</CardTitle>
            <CardDescription className="mt-2">
              The Velora swap module covers the EVM family — Ethereum,
              BSC, Polygon, Arbitrum, Base, Optimism. Switch to one of
              those chains from the dashboard to swap.
            </CardDescription>
          </Card>
        ) : step === "success" && signature ? (
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2
              size={40}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <CardTitle>Swap submitted</CardTitle>
            <CardDescription>
              {fromAsset &&
                toAsset &&
                quote &&
                `Sold ${formatBalance(quote.tokenInAmount, fromAsset.decimals)} ${fromAsset.symbol} for ${formatBalance(quote.tokenOutAmount, toAsset.decimals)} ${toAsset.symbol}.`}
            </CardDescription>
            <a
              href={spec.txExplorer(signature)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              View on explorer <ExternalLink size={14} />
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
              <Repeat size={14} /> Swap again
            </Button>
          </Card>
        ) : (
          <Card className="space-y-2">
            {/* From asset — single visual block: amount input on top,
                asset picker + balance row below. Modelled on Uniswap /
                Jupiter swap inputs so the asset and amount read as a
                single "I'm trading X of Y" unit. */}
            <SwapField
              label="You pay"
              asset={fromAsset}
              assets={assets}
              onChangeAsset={(key) => {
                setFromKey(key);
                setQuote(null);
                if (toKey === key) setToKey("");
              }}
              amountUnits={amountUnits}
              amountInput={amount}
              onAmountChange={(v) => {
                setAmount(v);
                setQuote(null);
                if (step === "review") setStep("form");
              }}
              prices={prices}
              inputDisabled={step === "approving" || step === "swapping"}
              showMax
            />

            {/* Swap direction toggle — overlaps both fields like every
                modern swap UI to read as "this is one trade, not two
                disconnected steps". */}
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={swapAssets}
                aria-label="Flip from and to"
                className="absolute z-10 rounded-full border-2 border-white bg-zinc-100 p-1.5 text-zinc-700 shadow-sm transition-colors hover:bg-zinc-200 dark:border-zinc-950 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <ArrowDown size={14} />
              </button>
              <span className="h-px w-full bg-zinc-100 dark:bg-zinc-800" />
            </div>

            {/* To asset — same visual block, but the amount is a
                read-only quote result rather than a typed input. */}
            <SwapField
              label="You receive"
              asset={toAsset}
              assets={assets.filter((a) => a.key !== fromKey)}
              onChangeAsset={(key) => {
                setToKey(key);
                setQuote(null);
              }}
              amountUnits={quote ? quote.tokenOutAmount : null}
              amountInput={
                quote && toAsset
                  ? formatBalance(quote.tokenOutAmount, toAsset.decimals)
                  : ""
              }
              onAmountChange={() => {}}
              prices={prices}
              inputDisabled
              readonlyOutput
            />

            {/* Quote info */}
            {step === "review" && quote && fromAsset && toAsset && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <Row label="Rate">
                  <span className="font-mono">
                    1 {fromAsset.symbol} ={" "}
                    {(
                      Number(quote.tokenOutAmount) /
                      10 ** toAsset.decimals /
                      (Number(quote.tokenInAmount) / 10 ** fromAsset.decimals)
                    ).toFixed(6)}{" "}
                    {toAsset.symbol}
                  </span>
                </Row>
                <Row label="Network fee">
                  <span className="font-mono">
                    {quote.fee === 0n
                      ? "—"
                      : `${formatBalance(quote.fee, config.nativeDecimals)} ${config.nativeSymbol}`}
                  </span>
                </Row>
                <Row label="Powered by">
                  <span className="font-medium">Velora · WDK</span>
                </Row>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            {/* Action button — branches by step */}
            {step === "form" && (
              <Button
                type="button"
                onClick={
                  needsApproval ? handleApprove : handleQuote
                }
                disabled={!canQuote}
                className="w-full"
              >
                <ArrowLeftRight size={16} />
                {needsApproval
                  ? `Approve ${fromAsset?.symbol ?? ""} & quote`
                  : "Get quote"}
              </Button>
            )}
            {step === "approving" && (
              <Button type="button" loading disabled className="w-full">
                Approving {fromAsset?.symbol}…
              </Button>
            )}
            {step === "quoting" && (
              <Button type="button" loading disabled className="w-full">
                Fetching quote…
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
                  onClick={handleSwap}
                  className="flex-1"
                >
                  <ArrowLeftRight size={16} /> Confirm swap
                </Button>
              </div>
            )}
            {step === "swapping" && (
              <Button type="button" loading disabled className="w-full">
                Swapping…
              </Button>
            )}
          </Card>
        )}

        <Card className="border-dashed">
          <CardTitle className="text-sm">How this is wired</CardTitle>
          <CardDescription className="mt-1 text-xs">
            Every swap goes through{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              @tetherto/wdk-protocol-swap-velora-evm
            </code>{" "}
            with the active EVM account from the same{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              WdkManager
            </code>{" "}
            that powers the rest of the wallet. No raw transaction
            crafting, no third-party SDK. See{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              lib/wdk-client.ts::quoteSwap
            </code>{" "}
            and{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              executeSwap
            </code>
            .
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Single visual block for one side of a swap (You pay / You receive).
 *
 * Layout: a soft-grey card with the amount input on the right, the
 * asset picker on the left, and a balance / USD value row underneath.
 * Both sides of the swap use this same component so the input and
 * output read as a symmetric pair.
 */
function SwapField({
  label,
  asset,
  assets,
  onChangeAsset,
  amountInput,
  amountUnits,
  onAmountChange,
  prices,
  inputDisabled,
  showMax = false,
  readonlyOutput = false,
}: {
  label: string;
  asset: SwapAsset | null;
  assets: SwapAsset[];
  onChangeAsset: (key: string) => void;
  amountInput: string;
  amountUnits: bigint | null;
  onAmountChange: (value: string) => void;
  prices: Record<string, number>;
  inputDisabled: boolean;
  showMax?: boolean;
  readonlyOutput?: boolean;
}) {
  const usd =
    asset && amountUnits != null
      ? toUsd(amountUnits, asset.decimals, asset.priceId ? prices[asset.priceId] : undefined)
      : null;

  function setMax() {
    if (!asset) return;
    onAmountChange(formatBalance(asset.balance, asset.decimals));
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition-colors focus-within:border-brand/40 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        {asset && (
          <span>
            Balance:{" "}
            <span className="font-mono text-foreground">
              {formatBalance(asset.balance, asset.decimals)}
            </span>{" "}
            {asset.symbol}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {asset ? (
          <Dropdown
            ariaLabel={`Select ${label.toLowerCase()} asset`}
            value={asset.key}
            onChange={onChangeAsset}
            items={assets.map((a) => ({
              value: a.key,
              label: a.symbol,
              sublabel: a.name,
              leading: a.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.logo}
                  alt={a.symbol}
                  className="h-5 w-5 rounded-full bg-zinc-100 object-contain dark:bg-zinc-800"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {a.symbol.slice(0, 2)}
                </div>
              ),
              trailing: (
                <span className="font-mono text-[11px] text-zinc-500">
                  {formatBalance(a.balance, a.decimals)}
                </span>
              ),
            }))}
            triggerLeading={
              asset.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.logo}
                  alt={asset.symbol}
                  className="h-5 w-5 rounded-full bg-zinc-100 object-contain dark:bg-zinc-800"
                  loading="lazy"
                />
              ) : undefined
            }
            buttonClassName="h-10 bg-white dark:bg-zinc-950"
          />
        ) : (
          <div className="h-10 w-32 rounded-md border border-zinc-200 dark:border-zinc-800" />
        )}
        <Input
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          disabled={inputDisabled}
          className="h-10 flex-1 border-none bg-transparent text-right font-mono text-xl shadow-none focus-visible:ring-0"
          readOnly={readonlyOutput}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{usd != null ? formatUsd(usd) : "—"}</span>
        {showMax && asset && asset.balance > 0n && (
          <button
            type="button"
            onClick={setMax}
            className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 transition-colors hover:border-brand/40 hover:text-foreground dark:border-zinc-800 dark:text-zinc-300"
          >
            Max
          </button>
        )}
      </div>
    </div>
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

/** Mirrors the parser in /wallet/send so the same human-readable
 *  decimals → bigint conversion applies on both flows. */
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

