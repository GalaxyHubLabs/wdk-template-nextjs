"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { validateMnemonic } from "bip39";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { openWallet } from "@/lib/wdk-client";
import { saveVault } from "@/lib/storage";
import { useWalletStore } from "@/store/wallet";

export default function ImportWalletPage() {
  const router = useRouter();
  const setHandle = useWalletStore((s) => s.setHandle);
  const setStatus = useWalletStore((s) => s.setStatus);

  const [seedPhrase, setSeedPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = seedPhrase.trim().toLowerCase().replace(/\s+/g, " ");
    if (!validateMnemonic(normalized)) {
      setError("Invalid recovery phrase. Check the words and try again.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setStatus("loading");
    try {
      await saveVault(normalized, password);
      const handle = await openWallet(normalized, "devnet");
      setHandle(handle);
      setStatus("ready");
      router.push("/wallet");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import wallet.";
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
            Import wallet
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Restore your wallet using your existing recovery phrase.
          </p>
        </header>

        <Card>
          <CardTitle>Recovery phrase</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Paste your 12 or 24 word BIP-39 recovery phrase, separated by spaces.
          </CardDescription>

          <form onSubmit={handleImport} className="space-y-4">
            <Textarea
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              placeholder="word1 word2 word3 …"
              autoComplete="off"
              spellCheck={false}
              rows={4}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  New password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password-confirm">
                  Confirm password
                </label>
                <Input
                  id="password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={busy} disabled={busy}>
              <ShieldCheck size={16} /> Import wallet
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
