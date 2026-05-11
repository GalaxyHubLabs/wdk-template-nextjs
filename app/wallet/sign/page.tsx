"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  PenLine,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CHAIN_CONFIGS, NETWORK_LABEL } from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { signMessage } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

/**
 * Sign an arbitrary text message with the active account.
 *
 * The wallet primarily exists to send funds, but signing arbitrary
 * messages is the auth primitive that powers "Sign-in with Ethereum",
 * "Sign-in with Solana", off-chain order books, and a long list of
 * AI-agent attestations. Every WDK wallet module exposes a uniform
 * `sign()` method, so this single page works across every chain the
 * template supports.
 *
 * Security note: signing is irreversible attestation, not transfer.
 * A signature can't move funds but it CAN authenticate the holder
 * to a third-party service — so we surface a clear "what is this?"
 * warning before exposing the signing flow.
 */
export default function SignMessagePage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const account = handle.accounts[activeChain];
  const config = CHAIN_CONFIGS[activeChain];

  async function handleSign() {
    if (!message.trim() || !handle) return;
    setBusy(true);
    try {
      const sig = await signMessage(handle, activeChain, message);
      setSignature(sig);
      toast.success("Message signed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't sign the message.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copySignature() {
    if (!signature) return;
    try {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      toast.success("Signature copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied.");
    }
  }

  function reset() {
    setMessage("");
    setSignature(null);
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

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign message
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Prove ownership of your{" "}
            <span className="font-medium text-foreground">
              {config.label} {NETWORK_LABEL[handle.network]}
            </span>{" "}
            address by signing an arbitrary text payload. The signature is
            generated locally — your seed never leaves the device.
          </p>
        </header>

        <Card className="border-amber-200 dark:border-amber-900/60">
          <div className="flex items-start gap-3">
            <ShieldAlert
              size={18}
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <div className="space-y-1">
              <CardTitle className="text-sm">
                Only sign messages you understand
              </CardTitle>
              <CardDescription className="text-xs">
                A signature can&apos;t move funds directly, but malicious sites
                use it to authenticate you to off-chain services or to approve
                actions in their own UX. If a third party asked you to sign
                something here, double-check the text before continuing.
              </CardDescription>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <CardTitle>Message</CardTitle>
            <CardDescription className="mt-1">
              Plain UTF-8 text. Most dApp auth flows include the host they
              represent and a nonce.
            </CardDescription>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`I authorise example.com to query my balance.\nNonce: 7c2a4f`}
            rows={5}
            className="w-full resize-y rounded-lg border border-zinc-200 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-brand dark:border-zinc-800"
            disabled={signature != null}
          />

          {account && (
            <p className="break-all text-[11px] text-zinc-500">
              Signing as <span className="font-mono">{account.address}</span>
            </p>
          )}

          {signature == null ? (
            <Button
              type="button"
              onClick={handleSign}
              disabled={busy || message.trim().length === 0}
              loading={busy}
              className="w-full"
            >
              <PenLine size={16} /> Sign as{" "}
              {account ? config.nativeSymbol : config.label}
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Signature
                </p>
                <div className="mt-1 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <code className="flex-1 break-all font-mono text-[11px]">
                    {signature}
                  </code>
                  <button
                    onClick={copySignature}
                    aria-label="Copy signature"
                    className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-white hover:text-foreground dark:hover:bg-zinc-950"
                  >
                    {copied ? (
                      <Check
                        size={14}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={reset}
                className="w-full"
              >
                <RotateCcw size={14} /> Sign another
              </Button>
            </div>
          )}
        </Card>

        <Card className="border-dashed">
          <CardTitle className="text-sm">For developers / agents</CardTitle>
          <CardDescription className="mt-1 text-xs">
            The same primitive is exposed programmatically via{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              signMessage(handle, chain, message)
            </code>{" "}
            in{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              lib/wdk-client.ts
            </code>
            . An AI agent driving the wallet can call it without
            touching this UI.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}
