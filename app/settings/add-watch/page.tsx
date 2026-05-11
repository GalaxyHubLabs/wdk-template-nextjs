"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  type ChainId,
} from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { addWatchEntry } from "@/lib/watch-list";
import { isLikelyAddressFor } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";

export default function AddWatchPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  // Pre-select whatever chain the dashboard is currently on, so the most
  // common case (user is looking at Solana, wants to watch a Solana address)
  // requires zero extra clicks.
  const [chain, setChain] = useState<ChainId>(activeChain);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = address.trim();
    if (!trimmed) {
      setError("Enter an address to watch.");
      return;
    }
    if (!isLikelyAddressFor(chain, trimmed)) {
      setError(`That doesn't look like a valid ${CHAIN_CONFIGS[chain].label} address.`);
      return;
    }

    const entry = addWatchEntry({
      chain,
      address: trimmed,
      label: label.trim() || undefined,
    });
    toast.success(`Now watching ${entry.label}.`);
    router.push(`/watch/${entry.id}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-5">
        <button
          type="button"
          onClick={() => router.push("/settings/add-account")}
          className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Watch an address</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Track balances and activity for any address — without holding its
            keys. Read-only, no signing.
          </p>
        </header>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chain</label>
              <Dropdown
                ariaLabel="Select chain to watch"
                value={chain}
                onChange={(v) => setChain(v as ChainId)}
                items={CHAIN_IDS.map((id) => {
                  const c = CHAIN_CONFIGS[id];
                  return {
                    value: id,
                    label: c.label,
                    sublabel: c.nativeSymbol,
                    leading: (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.logo}
                        alt={c.label}
                        className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800"
                        loading="lazy"
                      />
                    ),
                  };
                })}
                triggerLeading={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={CHAIN_CONFIGS[chain].logo}
                    alt={CHAIN_CONFIGS[chain].label}
                    className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800"
                    loading="lazy"
                  />
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="watch-address">
                Address
              </label>
              <Input
                id="watch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={placeholderFor(chain)}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                className="font-mono"
                required
              />
              <p className="text-xs text-zinc-500">
                Paste any {CHAIN_CONFIGS[chain].label} address. Validation is
                local — the explorer is the source of truth.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="watch-label">
                Label <span className="text-zinc-400">(optional)</span>
              </label>
              <Input
                id="watch-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Cold storage, Friend's wallet…"
                maxLength={32}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full">
              <Eye size={16} /> Watch address
            </Button>
          </form>
        </Card>

        <CardDescription className="text-center">
          Watched addresses live alongside your own accounts in Settings →
          Watched addresses. Remove them any time.
        </CardDescription>
      </div>
    </main>
  );
}

function placeholderFor(chain: ChainId): string {
  switch (chain) {
    case "solana":
      return "9wFFx…HghQR";
    case "tron":
      return "TR7NH…gjLj6t";
    case "ton":
      return "EQDr…AAGE";
    case "evm":
    case "bsc":
    case "polygon":
    case "arbitrum":
    case "base":
    case "optimism":
      return "0xdAC1…831ec7";
    default:
      return "Address";
  }
}
