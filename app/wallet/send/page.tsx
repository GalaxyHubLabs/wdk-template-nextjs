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
import { Input } from "@/components/ui/input";
import { getAddressBook, type AddressEntry } from "@/lib/address-book";
import { CHAIN_CONFIGS, NETWORK_LABEL, networkSpec } from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { cn, formatBalance, truncate } from "@/lib/utils";
import {
  isLikelyAddressFor,
  quoteNativeSend,
  sendNative,
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
  const setNativeBalance = useWalletStore((s) => s.setNativeBalance);

  const [step, setStep] = useState<Step>("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SendQuote | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookEntries, setBookEntries] = useState<AddressEntry[]>([]);

  // Load the active chain's saved addresses for the recipient picker.
  useEffect(() => {
    setBookEntries(getAddressBook(activeChain));
  }, [activeChain]);

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
  }, [activeChain]);

  const activeAccount = handle?.accounts[activeChain];
  const config = CHAIN_CONFIGS[activeChain];
  const network = handle?.network ?? "testnet";
  const spec = networkSpec(activeChain, network);

  const amountUnits = useMemo(
    () => parseAmount(amount, config.nativeDecimals),
    [amount, config.nativeDecimals],
  );
  const balance = nativeBalances[activeChain] ?? 0n;
  const totalIfSending =
    amountUnits != null && quote != null ? amountUnits + quote.fee : null;
  const insufficientFunds = totalIfSending != null && totalIfSending > balance;

  const canReview =
    isLikelyAddressFor(activeChain, recipient) &&
    amountUnits != null &&
    amountUnits > 0n &&
    amountUnits <= balance;

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
      const q = await quoteNativeSend(
        handle,
        activeChain,
        recipient.trim(),
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
      const result = await sendNative(
        handle,
        activeChain,
        recipient.trim(),
        amountUnits,
      );
      setSignature(result.signature);
      setStep("success");
      setNativeBalance(activeChain, balance - amountUnits - result.fee);
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
            Send {config.nativeSymbol}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sending on{" "}
            <span className="font-medium text-foreground">
              {config.label} {NETWORK_LABEL[network]}
            </span>{" "}
            · Balance{" "}
            <span className="font-mono font-medium text-foreground">
              {formatBalance(balance, config.nativeDecimals)} {config.nativeSymbol}
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
                  placeholder={`${config.label} address`}
                  autoComplete="off"
                  spellCheck={false}
                />
                {recipient && !isLikelyAddressFor(activeChain, recipient) && (
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
                  Amount ({config.nativeSymbol})
                </label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                {amountUnits != null && amountUnits > balance && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Amount exceeds available balance.
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
                value={<span className="font-mono">{truncate(recipient.trim(), 8, 8)}</span>}
              />
              <Row
                label="Amount"
                value={
                  <span className="font-mono">
                    {formatBalance(amountUnits, config.nativeDecimals)} {config.nativeSymbol}
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
              <Row
                label="Total"
                value={
                  <span className="font-mono font-medium text-foreground">
                    {formatBalance(amountUnits + quote.fee, config.nativeDecimals)} {config.nativeSymbol}
                  </span>
                }
              />
            </dl>

            {insufficientFunds && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Total exceeds your balance once the network fee is included.
                  Reduce the amount and try again.
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
