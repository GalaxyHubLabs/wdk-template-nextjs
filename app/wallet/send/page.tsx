"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NETWORKS } from "@/lib/networks";
import { hasVault } from "@/lib/storage";
import { cn, formatBalance, truncate } from "@/lib/utils";
import {
  isLikelySolanaAddress,
  quoteNativeSend,
  sendNative,
  type SendQuote,
} from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

type Step = "form" | "review" | "sending" | "success";

const LAMPORTS_PER_SOL = 1_000_000_000n;

function parseSolAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 9) return null; // too many decimals for lamports
  const padded = (frac + "000000000").slice(0, 9);
  try {
    return BigInt(whole) * LAMPORTS_PER_SOL + BigInt(padded);
  } catch {
    return null;
  }
}

export default function SendPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const network = useWalletStore((s) => s.network);
  const balance = useWalletStore((s) => s.balance);
  const setBalance = useWalletStore((s) => s.setBalance);

  const [step, setStep] = useState<Step>("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SendQuote | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const networkCfg = NETWORKS[network];
  const amountLamports = parseSolAmount(amount);
  const balanceLamports = balance ?? 0n;
  const totalIfSending =
    amountLamports != null && quote != null ? amountLamports + quote.fee : null;
  const insufficientFunds =
    totalIfSending != null && totalIfSending > balanceLamports;

  const canReview =
    isLikelySolanaAddress(recipient) &&
    amountLamports != null &&
    amountLamports > 0n &&
    amountLamports <= balanceLamports;

  async function handleReview() {
    if (!canReview || !handle || amountLamports == null) return;
    setError(null);
    setBusy(true);
    try {
      const q = await quoteNativeSend(handle, recipient.trim(), amountLamports);
      setQuote(q);
      setStep("review");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to estimate fee.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!handle || amountLamports == null) return;
    setError(null);
    setBusy(true);
    setStep("sending");
    try {
      const result = await sendNative(handle, recipient.trim(), amountLamports);
      setSignature(result.signature);
      setStep("success");
      // Optimistic balance update: subtract sent + fee. Real value will be
      // re-fetched when the user returns to /wallet.
      setBalance(balanceLamports - amountLamports - result.fee);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed.";
      setError(message);
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
          <h1 className="text-3xl font-semibold tracking-tight">Send SOL</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sending on{" "}
            <span className="font-medium text-foreground">{networkCfg.label}</span>
            {" · "}Balance{" "}
            <span className="font-mono font-medium text-foreground">
              {formatBalance(balanceLamports, 9)} SOL
            </span>
          </p>
        </header>

        {step === "form" && (
          <Card>
            <CardTitle>Recipient & amount</CardTitle>
            <CardDescription className="mt-1 mb-4">
              Double-check the address — Solana transactions are irreversible.
            </CardDescription>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="recipient">
                  Recipient address
                </label>
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Solana address (base58)"
                  autoComplete="off"
                  spellCheck={false}
                />
                {recipient && !isLikelySolanaAddress(recipient) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Doesn&apos;t look like a Solana address.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="amount">
                  Amount (SOL)
                </label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                {amountLamports != null && amountLamports > balanceLamports && (
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

        {step === "review" && quote && amountLamports != null && (
          <Card>
            <CardTitle>Review</CardTitle>
            <CardDescription className="mt-1 mb-4">
              Confirm the transaction. Once submitted, it cannot be reversed.
            </CardDescription>

            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <Row label="To" value={<span className="font-mono">{truncate(recipient.trim(), 8, 8)}</span>} />
              <Row
                label="Amount"
                value={
                  <span className="font-mono">
                    {formatBalance(amountLamports, 9)} SOL
                  </span>
                }
              />
              <Row
                label="Network fee"
                value={
                  <span className="font-mono">
                    {formatBalance(quote.fee, 9)} SOL
                  </span>
                }
              />
              <Row
                label="Total"
                value={
                  <span className="font-mono font-medium text-foreground">
                    {formatBalance(amountLamports + quote.fee, 9)} SOL
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
              Submitting transaction to {networkCfg.label}…
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
              Transaction submitted. It will finalize on{" "}
              {networkCfg.label} in a few seconds.
            </CardDescription>

            <a
              href={networkCfg.explorerUrl(signature, "tx")}
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
