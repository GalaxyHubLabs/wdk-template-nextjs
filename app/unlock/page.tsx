"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clearVault, hasVault, unlockVault } from "@/lib/storage";
import { openWallet } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

export default function UnlockPage() {
  const router = useRouter();
  const setHandle = useWalletStore((s) => s.setHandle);
  const setStatus = useWalletStore((s) => s.setStatus);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  // If there's no vault on this device, send the user back to the landing
  // — there's nothing to unlock.
  useEffect(() => {
    if (!hasVault()) {
      router.replace("/");
    }
  }, [router]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setStatus("loading");
    try {
      const seed = await unlockVault(password);
      const handle = await openWallet(seed, "devnet");
      setHandle(handle);
      setStatus("ready");
      router.push("/wallet");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to unlock.";
      setError(message);
      setStatus("error", message);
      setBusy(false);
    }
  }

  function handleWipe() {
    clearVault();
    setShowWipeConfirm(false);
    router.replace("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Unlock wallet</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your password to decrypt the locally-stored seed phrase.
          </p>
        </header>

        <Card>
          <form onSubmit={handleUnlock} className="space-y-4">
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
                  placeholder="Your wallet password"
                  autoComplete="current-password"
                  autoFocus
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

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" loading={busy} disabled={busy} className="w-full">
              <ShieldCheck size={16} /> Unlock
            </Button>
          </form>
        </Card>

        <div className="space-y-3 text-center">
          <p className="text-xs text-zinc-500">
            Forgot your password?{" "}
            <button
              type="button"
              onClick={() => setShowWipeConfirm((v) => !v)}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Wipe wallet
            </button>
            {" or "}
            <Link
              href="/onboarding/import"
              className="underline underline-offset-2 hover:text-foreground"
            >
              import another
            </Link>
          </p>

          {showWipeConfirm && (
            <Card className="border-red-200 dark:border-red-900">
              <CardTitle className="text-red-700 dark:text-red-400 text-base">
                Wipe locally-stored wallet?
              </CardTitle>
              <CardDescription className="mt-1 mb-4">
                This will erase the encrypted seed phrase from this device. You
                will need your recovery phrase to restore the wallet.
              </CardDescription>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowWipeConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleWipe}
                  className="flex-1"
                >
                  <Trash2 size={16} /> Wipe
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
