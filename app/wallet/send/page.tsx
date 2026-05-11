"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookUser,
  CheckCircle2,
  ExternalLink,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { getAddressBook, type AddressEntry } from "@/lib/address-book";
import { CHAIN_CONFIGS, NETWORK_LABEL, networkSpec } from "@/lib/chains";
import { getCustomTokens } from "@/lib/custom-tokens";
import { looksLikeName, resolveName } from "@/lib/name-resolution";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { cn, formatBalance, truncate } from "@/lib/utils";
import {
  isLikelyAddressFor,
  quoteNativeSend,
  quoteTokenSend,
  sendNative,
  sendToken,
  type SendQuote,
} from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

type Step = "form" | "review" | "sending" | "success";

/** Convert a "1.234" style human input into a chain-native bigint amount. */
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

export default function SendPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);
  const nativeBalances = useWalletStore((s) => s.nativeBalances);
  const tetherBalances = useWalletStore((s) => s.tetherBalances);
  const setNativeBalance = useWalletStore((s) => s.setNativeBalance);
  const setAllBalances = useWalletStore((s) => s.setAllBalances);

  const [step, setStep] = useState<Step>("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  /** Identifier for the asset being sent:
   *    - "native" — the chain's native asset (SOL, ETH, MATIC, …)
   *    - any other string — the contract address of the SPL / ERC-20 /
   *      TRC-20 / jetton token to transfer.
   *  Defaults to native each time the user enters the page or switches
   *  chains, so a casual user sees the familiar SOL/ETH send screen
   *  without having to think about asset selection. */
  const [assetKey, setAssetKey] = useState<string>("native");
  const [quote, setQuote] = useState<SendQuote | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookEntries, setBookEntries] = useState<AddressEntry[]>([]);
  /** ENS / SNS resolution state. `resolvedAddress` is null both before
   *  the user types a name and after a name fails to resolve. */
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);

  // Load the active chain's saved addresses for the recipient picker.
  useEffect(() => {
    setBookEntries(getAddressBook(activeChain));
  }, [activeChain]);

  // Name resolution. Fires whenever the recipient field looks like a
  // `.eth` / `.sol` name and the active chain supports it. Cancels in-
  // flight resolutions when the input changes again so we always show
  // the answer for what's currently typed.
  useEffect(() => {
    if (!handle) return;
    const trimmed = recipient.trim();
    if (!looksLikeName(trimmed)) {
      setResolvedAddress(null);
      setResolving(false);
      setResolveFailed(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveFailed(false);
    // Small debounce so typing one character at a time doesn't fire
    // an RPC per keystroke.
    const timer = setTimeout(async () => {
      try {
        const addr = await resolveName(activeChain, trimmed, handle.network);
        if (cancelled) return;
        setResolvedAddress(addr);
        setResolveFailed(addr == null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipient, activeChain, handle]);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  // Reset the form whenever the user toggles between chains via the wallet
  // page — quotes from one chain are meaningless on another.
  useEffect(() => {
    setStep("form");
    setRecipient("");
    setAmount("");
    setQuote(null);
    setError(null);
    setAssetKey("native");
  }, [activeChain]);

  const activeAccount = handle?.accounts[activeChain];
  const config = CHAIN_CONFIGS[activeChain];
  const network = handle?.network ?? "testnet";
  const spec = networkSpec(activeChain, network);

  // ─── Asset descriptor ─────────────────────────────────────────────
  // The dropdown lists native + every canonical Tether token on this
  // network + every custom token the user has added for the chain.
  // Each option carries the metadata the form needs (decimals, symbol,
  // balance) so the rest of the component doesn't branch per-asset.
  type AssetOption = {
    key: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: bigint;
    logo?: string;
    /** null = native (uses sendNative); contract address for tokens. */
    address: string | null;
  };
  const customTokens = useMemo(
    () => getCustomTokens(activeChain),
    [activeChain],
  );
  const assets: AssetOption[] = useMemo(() => {
    const native: AssetOption = {
      key: "native",
      symbol: config.nativeSymbol,
      name: config.nativeName,
      decimals: config.nativeDecimals,
      balance: nativeBalances[activeChain] ?? 0n,
      logo: config.logo,
      address: null,
    };
    const tethers = spec.tetherTokens.map<AssetOption>((t) => ({
      key: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      balance: tetherBalances[activeChain]?.[t.address] ?? 0n,
      logo: t.logo,
      address: t.address,
    }));
    const customs = customTokens.map<AssetOption>((t) => ({
      key: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      // Custom-token balances are fetched per-page; the send screen
      // doesn't subscribe to them, but the user can still send if they
      // know they hold some.
      balance: 0n,
      logo: t.logo,
      address: t.address,
    }));
    return [native, ...tethers, ...customs];
  }, [
    config,
    activeChain,
    nativeBalances,
    tetherBalances,
    spec.tetherTokens,
    customTokens,
  ]);
  const asset = assets.find((a) => a.key === assetKey) ?? assets[0];
  const isNativeAsset = asset.address == null;
  /** Native balance is always required: even token transfers spend gas in
   *  the native asset. We hold it separately for the "insufficient gas"
   *  warning below. */
  const nativeBalanceUnits = nativeBalances[activeChain] ?? 0n;

  const amountUnits = useMemo(
    () => parseAmount(amount, asset.decimals),
    [amount, asset.decimals],
  );
  const totalIfSending =
    amountUnits != null && quote != null
      ? isNativeAsset
        ? amountUnits + quote.fee
        : amountUnits
      : null;
  const insufficientAsset =
    totalIfSending != null && totalIfSending > asset.balance;
  const insufficientGas =
    !isNativeAsset && quote != null && quote.fee > nativeBalanceUnits;
  const insufficientFunds = insufficientAsset || insufficientGas;

  /** The address we'll actually send to: either the resolved name target
   *  or the typed value if it's already a literal address. */
  const effectiveRecipient =
    resolvedAddress ?? (recipient.trim() || "");
  const recipientIsValid = isLikelyAddressFor(activeChain, effectiveRecipient);

  const canReview =
    recipientIsValid &&
    !resolving &&
    amountUnits != null &&
    amountUnits > 0n &&
    amountUnits <= asset.balance;

  if (!handle || !activeAccount) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  async function handleReview() {
    if (!canReview || !handle || amountUnits == null) return;
    setError(null);
    setBusy(true);
    try {
      const q = isNativeAsset
        ? await quoteNativeSend(
            handle,
            activeChain,
            effectiveRecipient,
            amountUnits,
          )
        : await quoteTokenSend(
            handle,
            activeChain,
            asset.address!,
            effectiveRecipient,
            amountUnits,
          );
      setQuote(q);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to estimate fee.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!handle || amountUnits == null) return;
    setError(null);
    setBusy(true);
    setStep("sending");
    try {
      const result = isNativeAsset
        ? await sendNative(
            handle,
            activeChain,
            effectiveRecipient,
            amountUnits,
          )
        : await sendToken(
            handle,
            activeChain,
            asset.address!,
            effectiveRecipient,
            amountUnits,
          );
      setSignature(result.signature);
      setStep("success");
      // Optimistic local update — the next /wallet refresh will reconcile
      // with the on-chain truth, but the immediate-feedback feel matters
      // here. Native asset always pays gas; token asset spends the token
      // plus gas in native.
      if (isNativeAsset) {
        setNativeBalance(
          activeChain,
          (nativeBalances[activeChain] ?? 0n) - amountUnits - result.fee,
        );
      } else {
        const prevTokenBal = tetherBalances[activeChain]?.[asset.address!] ?? 0n;
        setAllBalances(
          {
            [activeChain]:
              (nativeBalances[activeChain] ?? 0n) - result.fee,
          },
          {
            [activeChain]: {
              ...(tetherBalances[activeChain] ?? {}),
              [asset.address!]: prevTokenBal - amountUnits,
            },
          },
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
      setStep("review");
    } finally {
      setBusy(false);
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
          disabled={busy || step === "sending"}
        >
          <ArrowLeft size={14} /> Back
        </Button>

        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Send {asset.symbol}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sending on{" "}
            <span className="font-medium text-foreground">
              {config.label} {NETWORK_LABEL[network]}
            </span>{" "}
            · Balance{" "}
            <span className="font-mono font-medium text-foreground">
              {formatBalance(asset.balance, asset.decimals)} {asset.symbol}
            </span>
          </p>
        </header>

        {step === "form" && (
          <Card>
            <CardTitle>Recipient & amount</CardTitle>
            <CardDescription className="mt-1 mb-4">
              Double-check the address — {config.label} transactions are
              irreversible.
            </CardDescription>

            <div className="space-y-4">
              {/* Asset selector. Hidden when the chain has only the native
                  asset (i.e. no Tether tokens and no custom tokens) — the
                  dropdown would be a single-item menu, which is just noise. */}
              {assets.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Asset</label>
                  <Dropdown
                    ariaLabel="Select asset to send"
                    value={asset.key}
                    onChange={(v) => {
                      setAssetKey(v);
                      setAmount("");
                      setQuote(null);
                    }}
                    items={assets.map((a) => ({
                      value: a.key,
                      label: a.symbol,
                      sublabel: a.name,
                      leading: a.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.logo}
                          alt={a.symbol}
                          className="h-6 w-6 rounded-full bg-zinc-100 object-contain dark:bg-zinc-800"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                          {a.symbol.slice(0, 3)}
                        </div>
                      ),
                      trailing: (
                        <span className="font-mono text-xs text-zinc-500">
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
                          className="h-6 w-6 rounded-full bg-zinc-100 object-contain dark:bg-zinc-800"
                          loading="lazy"
                        />
                      ) : undefined
                    }
                  />
                  {!isNativeAsset && (
                    <p className="text-[11px] text-zinc-500">
                      Network fee is paid in{" "}
                      <span className="font-medium text-foreground">
                        {config.nativeSymbol}
                      </span>{" "}
                      regardless of the asset being sent.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="recipient">
                    Recipient address
                  </label>
                  {bookEntries.length > 0 && (
                    <span className="text-[11px] text-zinc-500">
                      {bookEntries.length} saved · pick below
                    </span>
                  )}
                </div>
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={
                    activeChain === "solana"
                      ? `${config.label} address or .sol name`
                      : activeChain === "evm" ||
                          activeChain === "bsc" ||
                          activeChain === "polygon" ||
                          activeChain === "arbitrum" ||
                          activeChain === "base" ||
                          activeChain === "optimism"
                        ? `${config.label} address or .eth name`
                        : `${config.label} address`
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
                {resolving && (
                  <p className="text-xs text-zinc-500">Resolving name…</p>
                )}
                {!resolving && resolvedAddress && (
                  <p className="break-all text-xs text-emerald-600 dark:text-emerald-400">
                    → {truncate(resolvedAddress, 8, 8)}
                  </p>
                )}
                {!resolving && resolveFailed && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Couldn&apos;t resolve that name on this chain.
                  </p>
                )}
                {!resolving &&
                  !looksLikeName(recipient) &&
                  recipient &&
                  !isLikelyAddressFor(activeChain, recipient) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Doesn&apos;t look like a {config.label} address.
                    </p>
                  )}
                {bookEntries.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-500">
                      <BookUser size={11} /> Address book
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {bookEntries.slice(0, 6).map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setRecipient(entry.address);
                            toast.info(`Loaded ${entry.name}'s address.`);
                          }}
                          className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs hover:bg-zinc-50 hover:border-brand dark:border-zinc-800 dark:hover:bg-zinc-900"
                        >
                          {entry.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="amount">
                  Amount ({asset.symbol})
                </label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-mono"
                />
                {amountUnits != null && amountUnits > asset.balance && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Amount exceeds your {asset.symbol} balance.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="button"
                onClick={handleReview}
                disabled={!canReview || busy}
                loading={busy}
                className="w-full"
              >
                Review
              </Button>
            </div>
          </Card>
        )}

        {step === "review" && quote && amountUnits != null && (
          <Card>
            <CardTitle>Review</CardTitle>
            <CardDescription className="mt-1 mb-4">
              Confirm the transaction. Once submitted, it cannot be reversed.
            </CardDescription>

            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <Row
                label="Chain"
                value={
                  <span className="font-medium">
                    {config.label} {NETWORK_LABEL[network]}
                  </span>
                }
              />
              <Row
                label="To"
                value={
                  <div className="flex flex-col items-end leading-tight">
                    {resolvedAddress && (
                      <span className="text-xs text-zinc-500">
                        {recipient.trim().toLowerCase()}
                      </span>
                    )}
                    <span className="font-mono">
                      {truncate(effectiveRecipient, 8, 8)}
                    </span>
                  </div>
                }
              />
              <Row
                label="Amount"
                value={
                  <span className="font-mono">
                    {formatBalance(amountUnits, asset.decimals)} {asset.symbol}
                  </span>
                }
              />
              <Row
                label="Network fee"
                value={
                  <span className="font-mono">
                    {quote.fee === 0n
                      ? "—"
                      : `${formatBalance(quote.fee, config.nativeDecimals)} ${config.nativeSymbol}`}
                  </span>
                }
              />
              {/* Total only really makes sense when the asset being sent
                  and the gas asset are the same — i.e. a native send.
                  For token transfers the two amounts are denominated in
                  different units, so we drop the row entirely rather
                  than rendering a misleading sum. */}
              {isNativeAsset && (
                <Row
                  label="Total"
                  value={
                    <span className="font-mono font-medium text-foreground">
                      {formatBalance(amountUnits + quote.fee, asset.decimals)}{" "}
                      {asset.symbol}
                    </span>
                  }
                />
              )}
            </dl>

            {insufficientFunds && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {insufficientGas
                    ? `You don't have enough ${config.nativeSymbol} to cover the network fee. Top up your ${config.nativeSymbol} balance and try again.`
                    : `Total exceeds your ${asset.symbol} balance. Reduce the amount and try again.`}
                </p>
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep("form");
                  setError(null);
                }}
                disabled={busy}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={busy || insufficientFunds}
                loading={busy}
                className="flex-1"
              >
                <Send size={16} /> Send
              </Button>
            </div>
          </Card>
        )}

        {step === "sending" && (
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-current border-r-transparent text-zinc-500" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Submitting transaction to {config.label}…
            </p>
          </Card>
        )}

        {step === "success" && signature && (
          <Card className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <CardTitle>Sent</CardTitle>
            <CardDescription>
              Transaction submitted to {config.label}. It will finalize on-chain
              shortly.
            </CardDescription>

            <a
              href={spec.txExplorer(signature)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              {truncate(signature, 8, 8)} <ExternalLink size={12} />
            </a>

            <Link
              href="/wallet"
              className={cn(
                "mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-all hover:opacity-90",
              )}
            >
              Done
            </Link>
          </Card>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
