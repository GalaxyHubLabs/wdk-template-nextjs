"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Check, Copy, Link as LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { CHAIN_CONFIGS, NETWORK_LABEL, networkSpec } from "@/lib/chains";
import { buildPaymentUri, parseDecimalAmount } from "@/lib/payment-uri";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { useWalletStore } from "@/store/wallet";

/**
 * Receive page with optional amount-encoded payment requests.
 *
 * The default flow — show me a QR for my address — is preserved. The
 * new capability is to specify an asset and an amount, which the page
 * folds into a chain-appropriate payment URI (Solana Pay on Solana,
 * EIP-681 on EVMs, tron: / ton:// on TRON and TON). Any wallet that
 * scans the resulting QR pre-fills the same asset and amount, which
 * is the standard merchant / charging flow.
 */
export default function ReceivePage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [assetKey, setAssetKey] = useState<string>("native");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  // Reset the request whenever the active chain changes — a Solana
  // amount makes no sense once we're looking at Ethereum.
  useEffect(() => {
    setAssetKey("native");
    setAmount("");
  }, [activeChain]);

  const activeAccount = handle?.accounts[activeChain];
  const config = CHAIN_CONFIGS[activeChain];
  const network = handle?.network ?? "testnet";
  const spec = activeAccount ? networkSpec(activeChain, network) : null;

  // Available assets: native + every canonical Tether token for the
  // active chain × network. Custom tokens are intentionally excluded —
  // a payment QR for an unknown contract is more likely to confuse
  // the recipient's wallet than help.
  const assets = useMemo(() => {
    if (!spec) return [];
    const native = {
      key: "native",
      symbol: config.nativeSymbol,
      name: config.nativeName,
      decimals: config.nativeDecimals,
      logo: config.logo,
      address: null as string | null,
    };
    const tethers = spec.tetherTokens.map((t) => ({
      key: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logo: t.logo,
      address: t.address,
    }));
    return [native, ...tethers];
  }, [spec, config]);
  const asset = assets.find((a) => a.key === assetKey) ?? assets[0];

  const amountUnits = useMemo(
    () => (asset ? parseDecimalAmount(amount, asset.decimals) : null),
    [amount, asset],
  );
  const amountInvalid = amount !== "" && amountUnits == null;

  const paymentUri = useMemo(() => {
    if (!activeAccount || !asset) return "";
    return buildPaymentUri({
      chain: activeChain,
      address: activeAccount.address,
      amount: amountUnits ?? 0n,
      tokenAddress: asset.address,
      decimals: asset.decimals,
    });
  }, [activeAccount, asset, amountUnits, activeChain]);

  if (!handle || !activeAccount) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  async function copyAddress() {
    if (!activeAccount) return;
    try {
      await navigator.clipboard.writeText(activeAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(paymentUri);
      setCopiedLink(true);
      toast.success("Payment link copied.");
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      toast.error("Clipboard access denied.");
    }
  }

  const hasAmount = (amountUnits ?? 0n) > 0n;
  const hasToken = asset?.address != null;
  const isPaymentRequest = hasAmount || hasToken;

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
          <h1 className="text-3xl font-semibold tracking-tight">Receive</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Share your address or build a payment request on{" "}
            <span className="font-medium text-foreground">
              {config.label} {NETWORK_LABEL[network]}
            </span>
            .
          </p>
        </header>

        <Card className="flex flex-col items-center gap-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800">
            <QRCodeSVG
              value={paymentUri || activeAccount.address}
              size={220}
              level="M"
              marginSize={2}
              className="block"
            />
          </div>

          <div className="w-full space-y-2">
            <CardDescription>{config.label} address</CardDescription>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <code className="flex-1 break-all font-mono text-xs text-foreground">
                {activeAccount.address}
              </code>
              <button
                onClick={copyAddress}
                aria-label="Copy address"
                className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-white hover:text-foreground dark:hover:bg-zinc-950"
              >
                {copied ? (
                  <Check
                    size={16}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        </Card>

        {/* Payment request builder */}
        <Card className="space-y-4">
          <div>
            <CardTitle className="text-base">Charge a specific amount</CardTitle>
            <CardDescription className="mt-1">
              Encode the asset and amount into the QR so the sender&apos;s
              wallet pre-fills the form on scan. Optional.
            </CardDescription>
          </div>

          {assets.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">
                Asset
              </label>
              <Dropdown
                ariaLabel="Payment request asset"
                value={asset.key}
                onChange={(v) => {
                  setAssetKey(v);
                  setAmount("");
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
                  ) : undefined,
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
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500" htmlFor="amount">
              Amount ({asset?.symbol ?? "—"})
            </label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Optional · e.g. 25.00"
              className="font-mono"
            />
            {amountInvalid && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Not a valid {asset?.symbol} amount.
              </p>
            )}
          </div>

          {isPaymentRequest && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">
                Payment link
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                <code className="flex-1 break-all font-mono text-[11px] text-foreground">
                  {paymentUri}
                </code>
                <button
                  onClick={copyLink}
                  aria-label="Copy payment link"
                  className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-white hover:text-foreground dark:hover:bg-zinc-950"
                >
                  {copiedLink ? (
                    <Check
                      size={14}
                      className="text-emerald-600 dark:text-emerald-400"
                    />
                  ) : (
                    <LinkIcon size={14} />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Compatible with{" "}
                {activeChain === "solana"
                  ? "Solana Pay-aware wallets (Phantom, Solflare, Backpack)"
                  : activeChain === "ton"
                    ? "TON wallets (Tonkeeper, MyTonWallet)"
                    : activeChain === "tron"
                      ? "TRON wallets (TronLink, TronWallet)"
                      : "EIP-681 EVM wallets (MetaMask, Rainbow, Trust, …)"}
                .
              </p>
            </div>
          )}
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/60">
          <CardTitle className="text-sm text-amber-700 dark:text-amber-400">
            Only send {config.label} assets to this address
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            Sending tokens from other chains will result in permanent loss.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}
