"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CHAIN_CONFIGS } from "@/lib/chains";
import { hasVault } from "@/lib/storage";
import {
  addCustomToken,
  fetchSolanaTokenMetadata,
  type CustomToken,
} from "@/lib/custom-tokens";
import { useWalletStore } from "@/store/wallet";

export default function AddTokenPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const activeChain = useWalletStore((s) => s.activeChain);

  const [address, setAddress] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState<string>("");
  const [logo, setLogo] = useState("");
  const [autoFetching, setAutoFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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

  const config = CHAIN_CONFIGS[activeChain];
  const supportsAutoFetch = activeChain === "solana";

  async function handleAutoFetch() {
    setError(null);
    setInfo(null);
    if (!address.trim()) {
      setError("Paste a contract / mint address first.");
      return;
    }
    setAutoFetching(true);
    try {
      // Auto-fetch path is Solana-specific today (Jupiter registry).
      const meta = await fetchSolanaTokenMetadata(address.trim());
      if (!meta) {
        setError(
          "Couldn't find metadata for this mint on Jupiter. Fill the fields manually.",
        );
        return;
      }
      setSymbol(meta.symbol);
      setName(meta.name);
      setDecimals(String(meta.decimals));
      if (meta.logo) setLogo(meta.logo);
      setInfo(`Loaded ${meta.symbol} (${meta.name}) from Jupiter.`);
    } finally {
      setAutoFetching(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const addr = address.trim();
    if (!addr) {
      setError("Contract / mint address is required.");
      return;
    }
    if (!symbol.trim()) {
      setError("Symbol is required.");
      return;
    }
    const dec = Number(decimals);
    if (!Number.isInteger(dec) || dec < 0 || dec > 30) {
      setError("Decimals must be an integer between 0 and 30.");
      return;
    }

    const token: CustomToken = {
      address: addr,
      symbol: symbol.trim(),
      name: name.trim() || symbol.trim(),
      decimals: dec,
      logo: logo.trim() || undefined,
    };
    addCustomToken(activeChain, token);
    router.push("/wallet");
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-md space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/wallet")}
          className="-ml-2"
        >
          <ArrowLeft size={14} /> Back
        </Button>

        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Add token</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            On{" "}
            <span className="font-medium text-foreground">{config.label}</span>
            {" · "}
            {activeChain === "solana"
              ? "SPL mint"
              : activeChain === "tron"
                ? "TRC-20 contract"
                : activeChain === "ton"
                  ? "Jetton master"
                  : "ERC-20 contract"}{" "}
            address
          </p>
        </header>

        <Card>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="address">
                Contract address
              </label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste address…"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 font-mono"
                />
                {supportsAutoFetch && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAutoFetch}
                    loading={autoFetching}
                    disabled={autoFetching}
                    className="shrink-0"
                  >
                    <Search size={14} /> Auto
                  </Button>
                )}
              </div>
              {supportsAutoFetch ? (
                <p className="text-[11px] text-zinc-500">
                  Click <strong>Auto</strong> to look the mint up on Jupiter
                  and pre-fill the rest of the form.
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Manual entry only for {config.label} right now — auto-fetch
                  ships in a follow-up.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="symbol">
                  Symbol
                </label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="USDT"
                  autoComplete="off"
                  maxLength={16}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="decimals">
                  Decimals
                </label>
                <Input
                  id="decimals"
                  inputMode="numeric"
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  placeholder="6"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Name (optional)
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tether USD"
                autoComplete="off"
                maxLength={64}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="logo">
                Logo URL (optional)
              </label>
              <Input
                id="logo"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://…"
                autoComplete="off"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {info}
              </p>
            )}

            <Button type="submit" className="w-full">
              <Plus size={16} /> Add to wallet
            </Button>
          </form>
        </Card>

        <CardDescription className="text-center">
          Custom tokens are stored in <code className="text-foreground">localStorage</code>{" "}
          for this browser only. No registry calls.
        </CardDescription>
      </div>
    </main>
  );
}
