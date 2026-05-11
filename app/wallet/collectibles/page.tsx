"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, ImageOff, Sparkles } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAIN_CONFIGS, NETWORK_LABEL, networkSpec } from "@/lib/chains";
import { fetchSolanaNfts, type NftAsset } from "@/lib/nfts";
import { hasVault } from "@/lib/storage";
import { useWalletStore } from "@/store/wallet";

/**
 * Solana collectibles page.
 *
 * Reads the configured Solana RPC (env default, or whatever the user
 * pasted into Settings → Networks → Solana) and asks it for the
 * `getAssetsByOwner` DAS method. If the RPC supports it (Helius,
 * Triton, QuickNode, Alchemy, Extrnode), we render the result as a
 * tidy grid. Otherwise we surface a clear call-to-action telling the
 * user how to enable rich NFT data with a one-line settings change.
 *
 * Multi-chain coverage is intentionally Solana-first: EVM NFT
 * standards (ERC-721/1155) have a separate metadata pipeline that
 * deserves its own pass — currently surfaced as a "coming soon"
 * footer on the page.
 */
export default function CollectiblesPage() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);

  const [assets, setAssets] = useState<NftAsset[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!handle) {
      router.replace(hasVault() ? "/unlock" : "/");
    }
  }, [handle, router]);

  useEffect(() => {
    if (!handle) return;
    const solana = handle.accounts.solana;
    if (!solana) {
      setAssets([]);
      return;
    }
    setLoading(true);
    void fetchSolanaNfts(solana.address, handle.network)
      .then((result) => {
        setAssets(result.assets);
        setMessage(result.message ?? null);
      })
      .finally(() => setLoading(false));
  }, [handle]);

  if (!handle) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Redirecting…</p>
      </main>
    );
  }

  const solana = handle.accounts.solana;
  const config = CHAIN_CONFIGS.solana;
  const spec = solana ? networkSpec("solana", handle.network) : null;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/wallet")}
          className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Collectibles</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Solana NFTs held by your active account, fetched via Metaplex DAS.
          </p>
        </header>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        )}

        {/* DAS unsupported — informative CTA, not a dead end */}
        {!loading && assets === null && (
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Sparkles size={18} />
              </div>
              <div className="space-y-2">
                <CardTitle>Rich NFT data needs a DAS-capable RPC</CardTitle>
                <CardDescription>
                  {message ??
                    "Your current Solana RPC doesn't support the Digital Asset Standard."}{" "}
                  Plug a free{" "}
                  <a
                    href="https://www.helius.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
                  >
                    Helius
                  </a>
                  ,{" "}
                  <a
                    href="https://www.quicknode.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
                  >
                    QuickNode
                  </a>
                  , or{" "}
                  <a
                    href="https://triton.one"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
                  >
                    Triton
                  </a>{" "}
                  URL into{" "}
                  <Link
                    href="/settings"
                    className="font-medium text-brand underline underline-offset-4"
                  >
                    Settings → Networks → Solana
                  </Link>{" "}
                  to light up collectibles without code changes.
                </CardDescription>
              </div>
            </div>
          </Card>
        )}

        {/* Empty Solana account */}
        {!loading && assets !== null && assets.length === 0 && solana && (
          <Card className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
              <ImageOff size={20} />
            </div>
            <CardTitle className="mt-3">No collectibles yet</CardTitle>
            <CardDescription className="mt-1">
              When you receive an NFT on {NETWORK_LABEL[handle.network]} Solana,
              it&apos;ll show up here.
            </CardDescription>
          </Card>
        )}

        {/* Populated grid */}
        {!loading && assets && assets.length > 0 && spec && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((nft) => (
              <a
                key={nft.mintAddress}
                href={spec.addressExplorer(nft.mintAddress)}
                target="_blank"
                rel="noreferrer"
                className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
                  {nft.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <ImageOff size={28} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{nft.name}</p>
                  {nft.collection && (
                    <p className="truncate text-[11px] text-zinc-500">
                      {truncate(nft.collection, 12, 4)}
                    </p>
                  )}
                </div>
                <ExternalLink
                  size={12}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-950/90"
                />
              </a>
            ))}
          </div>
        )}

        {/* Footer note about other chains */}
        <Card className="border-dashed">
          <CardTitle className="text-sm">EVM collectibles?</CardTitle>
          <CardDescription className="mt-1 text-xs">
            ERC-721 and ERC-1155 listing across Ethereum, Polygon, Arbitrum,
            Base, and Optimism ships in a follow-up. The architecture (per-RPC
            JSON-RPC + a metadata cache) is already prepared in{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
              lib/nfts.ts
            </code>
            .
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

function truncate(s: string, head: number, tail: number): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
