"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BookUser, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addAddressBookEntry,
  getAllAddressBookEntries,
  removeAddressBookEntry,
  type AddressEntry,
} from "@/lib/address-book";
import { CHAIN_CONFIGS, CHAIN_IDS, type ChainId } from "@/lib/chains";
import { looksLikeName, resolveName } from "@/lib/name-resolution";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { truncate } from "@/lib/utils";
import { isLikelyAddressFor } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

export default function AddressesPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [entries, setEntries] = useState<AddressEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formChain, setFormChain] = useState<ChainId>(activeChain);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  /** ENS / SNS resolution state for the Address field. */
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);

  // Resolve `.eth` / `.sol` names as the user types so the form can
  // store the hex address while the user keeps thinking in names.
  useEffect(() => {
    if (!handle) return;
    const trimmed = address.trim();
    if (!looksLikeName(trimmed)) {
      setResolvedAddress(null);
      setResolving(false);
      setResolveFailed(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveFailed(false);
    const timer = setTimeout(async () => {
      try {
        const addr = await resolveName(formChain, trimmed, handle.network);
        if (cancelled) return;
        setResolvedAddress(addr);
        setResolveFailed(addr == null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, formChain, handle]);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  useEffect(() => {
    setEntries(getAllAddressBookEntries());
  }, []);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  function reset() {
    setName("");
    setAddress("");
    setNote("");
    setResolvedAddress(null);
    setResolveFailed(false);
    setShowForm(false);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (resolving) {
      toast.info("Still resolving name…");
      return;
    }
    // Prefer the resolved hex when the user typed a name. Otherwise fall
    // back to whatever they typed and let the chain-specific format
    // check decide.
    const finalAddress = resolvedAddress ?? address.trim();
    if (!isLikelyAddressFor(formChain, finalAddress)) {
      toast.error(
        looksLikeName(address)
          ? `Couldn't resolve that name on ${CHAIN_CONFIGS[formChain].label}.`
          : `Address doesn't look valid for ${CHAIN_CONFIGS[formChain].label}.`,
      );
      return;
    }
    // The note carries the original name so the entry retains the
    // "vitalik.eth" pedigree even after we store the hex.
    const composedNote = looksLikeName(address)
      ? note.trim()
        ? `${address.trim()} · ${note.trim()}`
        : address.trim()
      : note.trim() || undefined;
    const entry = addAddressBookEntry(
      formChain,
      name.trim(),
      finalAddress,
      composedNote || undefined,
    );
    toast.success(`${entry.name} added to address book.`);
    setEntries(getAllAddressBookEntries());
    reset();
  }

  function handleDelete(entry: AddressEntry) {
    removeAddressBookEntry(entry.chain, entry.id);
    setEntries(getAllAddressBookEntries());
    toast.info(`${entry.name} removed.`);
  }

  // Group entries by chain so the list reads as a directory.
  const grouped = Object.fromEntries(
    CHAIN_IDS.map((c) => [c, [] as AddressEntry[]]),
  ) as Record<ChainId, AddressEntry[]>;
  for (const e of entries) grouped[e.chain]?.push(e);

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

        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Address book</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Save recipients you send to often.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            size="sm"
          >
            <Plus size={14} /> Add
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardTitle>New entry</CardTitle>
            <CardDescription className="mt-1 mb-4">
              Pick the chain and paste the recipient's address.
            </CardDescription>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Chain</label>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {CHAIN_IDS.map((chain) => {
                    const c = CHAIN_CONFIGS[chain];
                    const active = chain === formChain;
                    return (
                      <button
                        key={chain}
                        type="button"
                        onClick={() => setFormChain(chain)}
                        className={
                          active
                            ? "rounded-md bg-foreground px-2 py-1.5 text-xs font-medium text-background"
                            : "rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        }
                      >
                        {c.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">
                  Name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="address">
                  Address
                </label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={
                    formChain === "solana"
                      ? `${CHAIN_CONFIGS[formChain].label} address or .sol name`
                      : isEvmChain(formChain)
                        ? `${CHAIN_CONFIGS[formChain].label} address or .eth name`
                        : `${CHAIN_CONFIGS[formChain].label} address`
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  required
                />
                {resolving && (
                  <p className="text-xs text-zinc-500">Resolving name…</p>
                )}
                {!resolving && resolvedAddress && (
                  <p className="break-all text-xs text-emerald-600 dark:text-emerald-400">
                    → {truncate(resolvedAddress, 8, 8)}
                  </p>
                )}
                {!resolving && resolveFailed && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Couldn&apos;t resolve that name on{" "}
                    {CHAIN_CONFIGS[formChain].label}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="note">
                  Note (optional)
                </label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Personal cold wallet, exchange deposit…"
                  maxLength={80}
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={reset} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Save
                </Button>
              </div>
            </form>
          </Card>
        )}

        {entries.length === 0 && !showForm ? (
          <Card className="text-center">
            <div className="flex justify-center text-zinc-400">
              <BookUser size={32} />
            </div>
            <CardTitle className="mt-3 text-base">No saved addresses yet</CardTitle>
            <CardDescription className="mt-1">
              Add recipients here so you don't have to paste long addresses every
              time you send.
            </CardDescription>
            <Button type="button" onClick={() => setShowForm(true)} className="mt-4">
              <Plus size={14} /> Add your first
            </Button>
          </Card>
        ) : (
          CHAIN_IDS.map((chain) => {
            const list = grouped[chain];
            if (!list || list.length === 0) return null;
            const c = CHAIN_CONFIGS[chain];
            return (
              <Card key={chain} className="!p-0">
                <div className="flex items-center gap-2 px-4 pt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    alt={c.label}
                    className="h-5 w-5 rounded-full bg-zinc-100 dark:bg-zinc-800"
                  />
                  <p className="text-sm font-semibold">{c.label}</p>
                  <span className="text-xs text-zinc-500">· {list.length}</span>
                </div>
                <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {list.map((entry) => (
                    <li
                      key={entry.id}
                      className="group flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 leading-tight">
                        <p className="text-sm font-medium">{entry.name}</p>
                        <p className="font-mono text-xs text-zinc-500">
                          {truncate(entry.address, 8, 8)}
                        </p>
                        {entry.note && (
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                            {entry.note}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        aria-label={`Remove ${entry.name}`}
                        className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}

function isEvmChain(chain: ChainId): boolean {
  return (
    chain === "evm" ||
    chain === "bsc" ||
    chain === "polygon" ||
    chain === "arbitrum" ||
    chain === "base" ||
    chain === "optimism"
  );
}
