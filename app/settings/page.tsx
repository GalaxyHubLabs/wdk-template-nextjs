"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookUser,
  Eye,
  EyeOff,
  Monitor,
  Moon,
  ShieldAlert,
  Sun,
  Trash2,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useTheme, type Theme } from "@/components/theme";
import { CHAIN_CONFIGS, CHAIN_IDS, NETWORK_LABEL } from "@/lib/chains";
import { clearVault, hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { cn, truncate } from "@/lib/utils";
import { setAccountIndex } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

const ACCOUNTS_TO_SHOW = 5; // accounts 0..4

export default function SettingsPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const setHandle = useWalletStore((s) => s.setHandle);
  const clearBalances = useWalletStore((s) => s.clearBalances);
  const balanceHidden = useWalletStore((s) => s.balanceHidden);
  const setBalanceHidden = useWalletStore((s) => s.setBalanceHidden);
  const reset = useWalletStore((s) => s.reset);

  const [theme, setTheme] = useTheme();
  const [switching, setSwitching] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

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

  async function handleAccountChange(index: number) {
    if (!handle || index === handle.accountIndex) return;
    setSwitching(true);
    try {
      clearBalances();
      const next = await setAccountIndex(handle, index);
      setHandle(next);
      toast.success(`Switched to Account ${index + 1}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to switch account.",
      );
    } finally {
      setSwitching(false);
    }
  }

  function handleWipe() {
    reset();
    clearVault();
    setShowWipeConfirm(false);
    toast.info("Wallet wiped from this device.");
    router.replace("/");
  }

  const themes: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "system", label: "System", Icon: Monitor },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/wallet")}
          className="-ml-2"
        >
          <ArrowLeft size={14} /> Back
        </Button>

        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Preferences and tools for this wallet.
          </p>
        </header>

        {/* Appearance */}
        <Card>
          <CardTitle>Appearance</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Light, dark, or follow your operating system.
          </CardDescription>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
                  theme === value
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* Privacy */}
        <Card>
          <CardTitle>Privacy</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Hide every balance numeric value across the wallet.
          </CardDescription>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              {balanceHidden ? <EyeOff size={18} /> : <Eye size={18} />}
              <div className="leading-tight">
                <p className="text-sm font-medium">Hide balances</p>
                <p className="text-xs text-zinc-500">
                  Show <code>••••</code> instead of amounts.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={balanceHidden}
              onClick={() => setBalanceHidden(!balanceHidden)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                balanceHidden ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-800",
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                  balanceHidden ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </Card>

        {/* Accounts */}
        <Card>
          <CardTitle>Accounts</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Switch the BIP-44 derivation index. The same index applies to
            every chain — Account 2 on Solana is paired with Account 2 on
            Ethereum, TRON, TON, and BSC.
          </CardDescription>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: ACCOUNTS_TO_SHOW }, (_, i) => {
              const isActive = i === handle.accountIndex;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void handleAccountChange(i)}
                    disabled={switching}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 py-3 text-left transition-colors",
                      isActive ? "" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                          isActive
                            ? "bg-brand text-brand-foreground"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                        )}
                      >
                        <User size={14} />
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-medium">Account {i + 1}</p>
                        {isActive && (
                          <p className="text-xs text-zinc-500 font-mono">
                            {handle.accounts.solana
                              ? truncate(handle.accounts.solana.address, 6, 6) +
                                " · Solana"
                              : "Active"}
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-xs font-medium text-brand">Active</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Address book shortcut */}
        <Link
          href="/wallet/addresses"
          className="block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                <BookUser size={16} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium">Address book</p>
                <p className="text-xs text-zinc-500">Saved recipients across chains</p>
              </div>
            </div>
            <ArrowLeft size={16} className="rotate-180 text-zinc-400" />
          </div>
        </Link>

        {/* Networks summary */}
        <Card>
          <CardTitle>Networks</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Currently bound to{" "}
            <span className="font-medium text-foreground">
              {NETWORK_LABEL[handle.network]}
            </span>{" "}
            for every chain. Switch from the wallet dashboard.
          </CardDescription>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {CHAIN_IDS.map((chain) => {
              const c = CHAIN_CONFIGS[chain];
              const hasAcc = Boolean(handle.accounts[chain]);
              return (
                <li key={chain} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.logo}
                      alt={c.label}
                      className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800"
                    />
                    <span className="text-sm">{c.label}</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      hasAcc ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400",
                    )}
                  >
                    {hasAcc ? "Connected" : "Unavailable"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200 dark:border-red-950">
          <CardTitle className="text-red-700 dark:text-red-400">Danger zone</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Permanently erase the encrypted seed phrase from this device. You'll
            need your recovery phrase to restore the wallet.
          </CardDescription>
          {!showWipeConfirm ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowWipeConfirm(true)}
            >
              <Trash2 size={14} /> Wipe wallet
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-start gap-2">
                <ShieldAlert
                  size={16}
                  className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                />
                <p className="text-sm text-red-700 dark:text-red-300">
                  This will log you out and remove the encrypted vault from this
                  device. Make sure you have your recovery phrase saved before
                  proceeding.
                </p>
              </div>
              <div className="flex gap-2">
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
                  <Trash2 size={14} /> Confirm wipe
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
