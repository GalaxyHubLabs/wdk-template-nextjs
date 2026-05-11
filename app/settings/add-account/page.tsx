"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Plus,
  Sparkles,
  Usb,
} from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createAccount } from "@/lib/accounts";
import { hasVault } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { setAccountIndex } from "@/lib/wdk-client";
import { useWalletStore } from "@/store/wallet";
import { useEffect } from "react";

interface Option {
  id: string;
  label: string;
  description: string;
  Icon: typeof Sparkles;
  status: "ready" | "soon";
  /** Called when the option is selected (only for ready options). */
  onSelect?: () => void;
}

export default function AddAccountPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const setHandle = useWalletStore((s) => s.setHandle);
  const clearBalances = useWalletStore((s) => s.clearBalances);

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

  async function createNew() {
    if (!handle) return;
    const entry = createAccount();
    try {
      clearBalances();
      const next = await setAccountIndex(handle, entry.index);
      setHandle(next);
      toast.success(`Created ${entry.name}.`);
      router.push("/settings");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create account.",
      );
    }
  }

  function importRecovery() {
    // Warn before nuking the current wallet
    if (
      window.confirm(
        "Importing a new recovery phrase will replace the wallet stored on this device. Continue?",
      )
    ) {
      router.push("/onboarding/import");
    }
  }

  const options: Option[] = [
    {
      id: "create",
      label: "Create new account",
      description:
        "Derive the next BIP-44 account from your existing seed. Same recovery phrase, new address on every chain.",
      Icon: Plus,
      status: "ready",
      onSelect: createNew,
    },
    {
      id: "seed",
      label: "Import recovery phrase",
      description:
        "Restore an existing wallet from its 12 or 24 word BIP-39 phrase. This replaces the wallet currently on this device.",
      Icon: FileText,
      status: "ready",
      onSelect: importRecovery,
    },
    {
      id: "watch",
      label: "Watch any address",
      description:
        "Track balances and history for an address without holding its keys. Read-only.",
      Icon: Eye,
      status: "soon",
    },
    {
      id: "ledger",
      label: "Connect hardware wallet",
      description:
        "Sign with a Ledger device kept offline. Plug-and-play via WebHID.",
      Icon: Usb,
      status: "soon",
    },
    {
      id: "pk",
      label: "Import private key",
      description:
        "Bring in a single chain's account from its raw private key. Best for migrating from a non-HD wallet.",
      Icon: Download,
      status: "soon",
    },
  ];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-xl space-y-5">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Add account</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pick how you want to bring a new account into the wallet.
          </p>
        </header>

        <ul className="space-y-2">
          {options.map((opt) => {
            const isReady = opt.status === "ready";
            const Inner = (
              <Card
                className={
                  isReady
                    ? "flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
                    : "flex items-center gap-4 p-4 opacity-50 cursor-not-allowed"
                }
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  <opt.Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{opt.label}</CardTitle>
                    {!isReady && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        Soon
                      </span>
                    )}
                  </div>
                  <CardDescription className="mt-0.5">
                    {opt.description}
                  </CardDescription>
                </div>
              </Card>
            );
            return (
              <li key={opt.id}>
                {isReady ? (
                  <button
                    type="button"
                    onClick={opt.onSelect}
                    className="w-full text-left"
                  >
                    {Inner}
                  </button>
                ) : (
                  Inner
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-center text-xs text-zinc-500">
          Hardware wallets, private-key import, and watch-only addresses ship in
          a follow-up. The architecture is already prepared — see{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
            app/settings/add-account
          </code>
          .
        </p>
      </div>
    </main>
  );
}
