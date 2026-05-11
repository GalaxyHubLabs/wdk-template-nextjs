"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookUser,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Monitor,
  Moon,
  Pencil,
  Plus,
  ShieldAlert,
  Sun,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTheme, type Theme } from "@/components/theme";
import {
  getAccounts,
  removeAccount,
  renameAccount,
  resetAccounts,
  type AccountEntry,
} from "@/lib/accounts";
import { CHAIN_CONFIGS, CHAIN_IDS, NETWORK_LABEL } from "@/lib/chains";
import {
  getWatchList,
  removeWatchEntry,
  resetWatchList,
  type WatchEntry,
} from "@/lib/watch-list";
import { clearVault, hasVault, unlockVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { cn, truncate } from "@/lib/utils";
import { setAccountIndex } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

export default function SettingsPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const setHandle = useWalletStore((s) => s.setHandle);
  const clearBalances = useWalletStore((s) => s.clearBalances);
  const balanceHidden = useWalletStore((s) => s.balanceHidden);
  const setBalanceHidden = useWalletStore((s) => s.setBalanceHidden);
  const reset = useWalletStore((s) => s.reset);

  const [theme, setTheme] = useTheme();
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [watchList, setWatchList] = useState<WatchEntry[]>([]);
  const [switching, setSwitching] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  // Backup seed flow state
  const [backupStep, setBackupStep] = useState<"closed" | "auth" | "reveal">(
    "closed",
  );
  const [backupPassword, setBackupPassword] = useState("");
  const [backupSeed, setBackupSeed] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupShown, setBackupShown] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  useEffect(() => {
    setAccounts(getAccounts());
    setWatchList(getWatchList());
  }, []);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  async function switchToAccount(index: number) {
    if (!handle || index === handle.accountIndex) return;
    setSwitching(true);
    try {
      clearBalances();
      const next = await setAccountIndex(handle, index);
      setHandle(next);
      const entry = accounts.find((a) => a.index === index);
      toast.success(`Switched to ${entry?.name ?? `Account ${index + 1}`}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to switch account.",
      );
    } finally {
      setSwitching(false);
    }
  }

  function startRename(entry: AccountEntry) {
    setRenaming(entry.index);
    setRenameValue(entry.name);
  }

  function saveRename(index: number) {
    const name = renameValue.trim();
    if (!name) {
      setRenaming(null);
      return;
    }
    renameAccount(index, name);
    setAccounts(getAccounts());
    setRenaming(null);
    toast.success("Renamed.");
  }

  async function deleteAccount(entry: AccountEntry) {
    if (entry.index === handle?.accountIndex) {
      toast.error("Switch to a different account before deleting this one.");
      return;
    }
    if (
      !window.confirm(
        `Remove ${entry.name} from the list? Your seed phrase still derives this index — you can re-add it any time.`,
      )
    ) {
      return;
    }
    removeAccount(entry.index);
    setAccounts(getAccounts());
    toast.info(`${entry.name} removed.`);
  }

  function openBackup() {
    setBackupStep("auth");
    setBackupPassword("");
    setBackupSeed(null);
    setBackupError(null);
    setBackupShown(false);
  }

  function closeBackup() {
    setBackupStep("closed");
    setBackupPassword("");
    setBackupSeed(null);
    setBackupError(null);
    setBackupShown(false);
  }

  async function revealSeed(e: React.FormEvent) {
    e.preventDefault();
    setBackupError(null);
    setBackupBusy(true);
    try {
      const seed = await unlockVault(backupPassword);
      setBackupSeed(seed);
      setBackupStep("reveal");
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : "Wrong password.",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  async function copySeed() {
    if (!backupSeed) return;
    try {
      await navigator.clipboard.writeText(backupSeed);
      toast.success("Recovery phrase copied.");
    } catch {
      toast.error("Clipboard access denied.");
    }
  }

  function handleWipe() {
    reset();
    clearVault();
    resetAccounts();
    resetWatchList();
    setShowWipeConfirm(false);
    toast.info("Wallet wiped from this device.");
    router.replace("/");
  }

  function removeWatched(entry: WatchEntry) {
    if (
      !window.confirm(
        `Stop watching ${entry.label}? You can add it again any time.`,
      )
    ) {
      return;
    }
    removeWatchEntry(entry.id);
    setWatchList(getWatchList());
    toast.info(`Stopped watching ${entry.label}.`);
  }

  const themes: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "system", label: "System", Icon: Monitor },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/wallet")}
          className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} /> Back
        </button>

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Accounts</CardTitle>
              <CardDescription className="mt-1">
                Each account is a separate BIP-44 derivation of your seed.
              </CardDescription>
            </div>
            <Link
              href="/settings/add-account"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-foreground hover:opacity-90"
            >
              <Plus size={14} /> Add
            </Link>
          </div>

          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {accounts.map((entry) => {
              const isActive = entry.index === handle.accountIndex;
              const solAddr = isActive && handle.accounts.solana?.address;
              const isEditing = renaming === entry.index;
              return (
                <li
                  key={entry.index}
                  className="group flex items-center justify-between gap-3 py-3"
                >
                  <button
                    type="button"
                    onClick={() => void switchToAccount(entry.index)}
                    disabled={switching || isActive}
                    className="flex flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isActive
                          ? "bg-brand text-brand-foreground"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                      )}
                    >
                      {entry.index + 1}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => saveRename(entry.index)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(entry.index);
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="h-7 px-2 py-0 text-sm"
                          maxLength={32}
                        />
                      ) : (
                        <p className="text-sm font-medium">{entry.name}</p>
                      )}
                      {solAddr && !isEditing && (
                        <p className="font-mono text-xs text-zinc-500">
                          {truncate(solAddr, 6, 6)} · Solana
                        </p>
                      )}
                      {!isActive && !isEditing && (
                        <p className="text-xs text-zinc-500">Switch to activate</p>
                      )}
                    </div>
                    {isActive && (
                      <span className="text-xs font-medium text-brand">Active</span>
                    )}
                  </button>
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startRename(entry)}
                        aria-label={`Rename ${entry.name}`}
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAccount(entry)}
                        aria-label={`Remove ${entry.name}`}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Watched addresses (read-only) */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Watched addresses</CardTitle>
              <CardDescription className="mt-1">
                Read-only. Balances refresh from the public RPC; no keys are
                ever held for these.
              </CardDescription>
            </div>
            <Link
              href="/settings/add-watch"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus size={14} /> Watch
            </Link>
          </div>

          {watchList.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              You aren&apos;t watching any addresses yet. Use{" "}
              <strong>Watch</strong> to track any address without holding its
              keys.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {watchList.map((entry) => {
                const c = CHAIN_CONFIGS[entry.chain];
                return (
                  <li
                    key={entry.id}
                    className="group flex items-center justify-between gap-3 py-3"
                  >
                    <Link
                      href={`/watch/${entry.id}`}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.logo}
                          alt={c.label}
                          className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800"
                          loading="lazy"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-zinc-100 text-zinc-600 dark:border-zinc-950 dark:bg-zinc-900 dark:text-zinc-300">
                          <Eye size={9} />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {entry.label}
                        </p>
                        <p className="font-mono text-xs text-zinc-500">
                          {truncate(entry.address, 6, 6)} · {c.label}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeWatched(entry)}
                      aria-label={`Stop watching ${entry.label}`}
                      className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Backup recovery phrase */}
        <Card>
          <CardTitle>Recovery phrase</CardTitle>
          <CardDescription className="mt-1 mb-4">
            Reveal the 12-word phrase that controls every account in this
            wallet. Anyone with this phrase has full access.
          </CardDescription>
          {backupStep === "closed" && (
            <Button type="button" variant="secondary" onClick={openBackup}>
              <KeyRound size={14} /> Show recovery phrase
            </Button>
          )}
          {backupStep === "auth" && (
            <form onSubmit={revealSeed} className="space-y-3">
              <p className="text-xs text-zinc-500">
                Enter your wallet password to confirm.
              </p>
              <Input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Wallet password"
                autoComplete="current-password"
                autoFocus
                required
              />
              {backupError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {backupError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeBackup}
                  className="flex-1"
                  disabled={backupBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={backupBusy}
                  disabled={backupBusy}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </form>
          )}
          {backupStep === "reveal" && backupSeed && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                  Never type this phrase into a website or share it via chat.
                  Anyone with these 12 words can drain every chain.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBackupShown((v) => !v)}
                className={cn(
                  "w-full rounded-lg border border-zinc-200 p-4 text-left transition-colors dark:border-zinc-800",
                  !backupShown && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                )}
              >
                {backupShown ? (
                  <div className="grid grid-cols-3 gap-2">
                    {backupSeed.split(" ").map((word, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md bg-zinc-50 px-2.5 py-1.5 text-sm dark:bg-zinc-900"
                      >
                        <span className="text-xs text-zinc-400">{i + 1}.</span>
                        <span className="font-mono">{word}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500">
                    <Eye size={14} /> Tap to reveal
                  </div>
                )}
              </button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copySeed}
                  className="flex-1"
                  disabled={!backupShown}
                >
                  <Copy size={14} /> Copy phrase
                </Button>
                <Button type="button" onClick={closeBackup} className="flex-1">
                  <Check size={14} /> Done
                </Button>
              </div>
            </div>
          )}
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
                <p className="text-xs text-zinc-500">
                  Saved recipients across every chain
                </p>
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
                      hasAcc
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-400",
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
          <CardTitle className="text-red-700 dark:text-red-400">
            Danger zone
          </CardTitle>
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
