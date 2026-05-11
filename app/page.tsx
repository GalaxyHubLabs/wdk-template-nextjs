"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { hasVault } from "@/lib/storage";

const buttonStyles =
  "inline-flex h-14 items-center justify-center rounded-lg px-6 text-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function Home() {
  // Detect on mount whether a vault already exists on this device so we can
  // surface "Unlock existing" as the primary CTA. SSR returns the no-vault
  // variant (safe default), and hydration swaps in the right state.
  const [vaultPresent, setVaultPresent] = useState(false);
  useEffect(() => {
    setVaultPresent(hasVault());
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-12 text-center">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Built on Tether WDK · Featured chain: Solana
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            WDK Template Wallet
          </h1>
          <p className="text-balance text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
            A self-custodial Next.js wallet template. Designed for both human
            users and the next generation of autonomous AI agents.
          </p>
        </header>

        {vaultPresent ? (
          <div className="space-y-3">
            <Link
              href="/unlock"
              className={cn(
                buttonStyles,
                "w-full bg-foreground text-background hover:opacity-90 active:opacity-80",
              )}
            >
              Unlock existing wallet
            </Link>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/onboarding/create"
                className={cn(
                  buttonStyles,
                  "flex-1 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
              >
                Create new
              </Link>
              <Link
                href="/onboarding/import"
                className={cn(
                  buttonStyles,
                  "flex-1 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
              >
                Import
              </Link>
            </div>
            <p className="text-xs text-zinc-500">
              Creating or importing replaces the wallet stored on this device.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding/create"
              className={cn(
                buttonStyles,
                "bg-foreground text-background hover:opacity-90 active:opacity-80 sm:min-w-[200px]",
              )}
            >
              Create new wallet
            </Link>
            <Link
              href="/onboarding/import"
              className={cn(
                buttonStyles,
                "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:min-w-[200px]",
              )}
            >
              Import existing
            </Link>
          </div>
        )}

        <footer className="space-y-2 text-xs text-zinc-500 dark:text-zinc-500">
          <p>
            Source on{" "}
            <a
              href="https://github.com/GalaxyHubLabs/wdk-template-nextjs"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              GitHub
            </a>
            {" · "}
            Powered by{" "}
            <a
              href="https://docs.wdk.tether.io"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              WDK
            </a>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-400">
            Self-custodial · Open source · MIT
          </p>
        </footer>
      </div>
    </main>
  );
}
