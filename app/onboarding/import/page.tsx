"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { validateMnemonic } from "bip39";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { openWallet } from "@/lib/wdk-client";
import { saveVault } from "@/lib/storage";
import { useWalletStore } from "@/store/wallet";

type WordCount = 12 | 24;

export default function ImportWalletPage() {
  const router = useRouter();
  const setHandle = useWalletStore((s) => s.setHandle);
  const setStatus = useWalletStore((s) => s.setStatus);
  const activeNetwork = useWalletStore((s) => s.activeNetwork);

  const [wordCount, setWordCount] = useState<WordCount>(12);
  const [words, setWords] = useState<string[]>(() => Array.from({ length: 12 }, () => ""));
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const phrase = useMemo(
    () => words.map((w) => w.trim().toLowerCase()).join(" ").trim(),
    [words],
  );
  const filledCount = words.filter((w) => w.trim().length > 0).length;

  function setWordCountAndReset(count: WordCount) {
    setWordCount(count);
    setWords(Array.from({ length: count }, () => ""));
    setError(null);
  }

  function updateWord(index: number, value: string) {
    setWords((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  /** When the user pastes the entire phrase into a single cell, fan it out
   * into the grid and switch to 24-word mode if needed. */
  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return; // single word — let the default paste handler run

    e.preventDefault();
    const targetCount: WordCount = tokens.length >= 24 ? 24 : 12;
    const filled = Array.from({ length: targetCount }, (_, i) => tokens[i] ?? "");
    setWordCount(targetCount);
    setWords(filled);
    setError(null);
    // Focus the next empty cell (or last) for ergonomics.
    setTimeout(() => {
      const focusAt = Math.min(tokens.length, targetCount - 1);
      inputsRef.current[focusAt]?.focus();
    }, 0);
    void index; // not used directly, kept for clarity if extended
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const next = inputsRef.current[index + 1];
      if (next) next.focus();
    } else if (e.key === "Backspace" && words[index] === "" && index > 0) {
      e.preventDefault();
      const prev = inputsRef.current[index - 1];
      prev?.focus();
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (filledCount !== wordCount) {
      setError(`Enter all ${wordCount} words.`);
      return;
    }
    if (!validateMnemonic(phrase)) {
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
      await saveVault(phrase, password);
      const handle = await openWallet(phrase, activeNetwork);
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
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Recovery phrase</CardTitle>
            <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
              {[12, 24].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWordCountAndReset(n as WordCount)}
                  className={
                    wordCount === n
                      ? "rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background"
                      : "rounded-md px-3 py-1 text-xs font-medium text-zinc-500 hover:text-foreground"
                  }
                >
                  {n} words
                </button>
              ))}
            </div>
          </div>
          <CardDescription className="mb-4">
            Type each word in its numbered box, or paste your whole phrase into
            any cell — it&apos;ll fan out automatically.
          </CardDescription>

          <form onSubmit={handleImport} className="space-y-4">
            <div
              className={`grid gap-2 ${wordCount === 12 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"}`}
            >
              {words.map((word, i) => (
                <div
                  key={i}
                  className="relative flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white pl-2 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="select-none text-xs font-mono text-zinc-400">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <input
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    type="text"
                    value={word}
                    onChange={(e) => updateWord(i, e.target.value)}
                    onPaste={(e) => handlePaste(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    className="h-10 w-full bg-transparent pr-2 text-sm font-mono outline-none placeholder:text-transparent focus:placeholder:text-zinc-400"
                    placeholder="word"
                  />
                </div>
              ))}
            </div>

            <p className="text-right text-xs text-zinc-500">
              {filledCount} / {wordCount} words
            </p>

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
