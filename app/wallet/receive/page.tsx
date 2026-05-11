"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { NETWORKS } from "@/lib/networks";
import { hasVault } from "@/lib/storage";
import { useWalletStore } from "@/store/wallet";

export default function ReceivePage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const network = useWalletStore((s) => s.network);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  async function copyAddress() {
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(handle.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const networkCfg = NETWORKS[network];

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
            Scan the QR or copy the address below to receive on{" "}
            <span className="font-medium text-foreground">{networkCfg.label}</span>.
          </p>
        </header>

        <Card className="flex flex-col items-center gap-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800">
            <QRCodeSVG
              value={handle.address}
              size={220}
              level="M"
              marginSize={2}
              className="block"
            />
          </div>

          <div className="w-full space-y-2">
            <CardDescription>Wallet address</CardDescription>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <code className="flex-1 break-all text-xs font-mono text-foreground">
                {handle.address}
              </code>
              <button
                onClick={copyAddress}
                aria-label="Copy address"
                className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-white hover:text-foreground dark:hover:bg-zinc-950"
              >
                {copied ? (
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>

          <CardDescription className="text-center text-xs">
            Only send Solana ({networkCfg.label}) assets to this address.
            Sending tokens from other chains will result in permanent loss.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}
