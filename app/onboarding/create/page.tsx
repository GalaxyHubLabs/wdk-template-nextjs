"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { generateMnemonic } from "bip39";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { openWallet } from "@/lib/wdk-client";
import { saveVault } from "@/lib/storage";
import { resetAccounts } from "@/lib/accounts";
import { useWalletStore } from "@/store/wallet";

type Step = "password" | "reveal" | "confirm";

export default function CreateWalletPage() {
  const router = useRouter();
  const setHandle = useWalletStore((s) => s.setHandle);
  const setStatus = useWalletStore((s) => s.setStatus);
  const activeNetwork = useWalletStore((s) => s.activeNetwork);

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledgedBackup, setAcknowledgedBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Generate the seed phrase ONCE when this page mounts. 128 bits → 12 words.
  const seedPhrase = useMemo(() => generateMnemonic(128), []);
  const words = seedPhrase.split(" ");

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setStep("reveal");
  }

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(seedPhrase);
    } catch {
      // ignore clipboard errors (e.g. unsupported)
    }
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    setStatus("loading");
    try {
      await saveVault(seedPhrase, password);
      resetAccounts();
      const handle = await openWallet(seedPhrase, activeNetwork);
      setHandle(handle);
      setStatus("ready");
      router.push("/wallet");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create wallet.";
      setError(message);
      setStatus("error", message);
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Create your wallet
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Step {step === "password" ? 1 : step === "reveal" ? 2 : 3} of 3
          </p>
        </header>

        {step === "password" && (
          <Card>
            <CardTitle>Set a password</CardTitle>
            <CardDescription className="mt-1 mb-6">
              This password encrypts your seed phrase locally in this browser
              session. We cannot recover it for you.
            </CardDescription>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password-confirm">
                  Confirm password
                </label>
                <Input
                  id="password-confirm"
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </Card>
        )}

        {step === "reveal" && (
          <Card>
            <CardTitle>Your recovery phrase</CardTitle>
            <CardDescription className="mt-1 mb-6">
              Write down these 12 words in order and store them somewhere safe.
              Anyone with this phrase has full control of your wallet.
            </CardDescription>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              {words.map((word, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm dark:bg-zinc-950"
                >
                  <span className="text-xs text-zinc-400">{i + 1}.</span>
                  <span className="font-mono">{word}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={copySeed}
                className="flex-1"
              >
                <Copy size={16} /> Copy phrase
              </Button>
              <Button
                type="button"
                onClick={() => setStep("confirm")}
                className="flex-1"
              >
                I&apos;ve saved it
              </Button>
            </div>
          </Card>
        )}

        {step === "confirm" && (
          <Card>
            <CardTitle>Final check</CardTitle>
            <CardDescription className="mt-1 mb-6">
              Confirm you&apos;ve backed up your recovery phrase. Without it,
              your funds are unrecoverable if this session ends.
            </CardDescription>

            <label className="mb-6 flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <input
                type="checkbox"
                checked={acknowledgedBackup}
                onChange={(e) => setAcknowledgedBackup(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                I have written down or otherwise securely stored my 12-word
                recovery phrase. I understand that losing it means losing access
                to my wallet.
              </span>
            </label>

            {error && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("reveal")}
                className="flex-1"
                disabled={busy}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!acknowledgedBackup || busy}
                loading={busy}
                className="flex-1"
              >
                <ShieldCheck size={16} /> Create wallet
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
