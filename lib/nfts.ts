/**
 * Solana NFT (collectible) listing.
 *
 * The Solana NFT ecosystem standardises around Metaplex tokens, which
 * the Helius / QuickNode / Triton enhanced RPCs expose through a single
 * `getAssetsByOwner` method (the Digital Asset Standard — DAS). Rather
 * than ship a metadata-fetching pipeline ourselves, we hit the user's
 * configured Solana RPC with that method and render whatever it
 * returns.
 *
 * If the RPC is the default public endpoint (`api.mainnet-beta.solana
 * .com`, `api.devnet.solana.com`), `getAssetsByOwner` is not supported
 * and the request fails. We surface that as a friendly call-to-action
 * in the UI — the user just needs to plug a Helius (or Triton /
 * QuickNode) RPC into Settings → Networks → Solana to light up NFTs
 * without changing any code.
 */

import { networkSpec, type NetworkKey } from "./chains";

export interface NftAsset {
  /** Solana mint address. Stable identity for the asset. */
  mintAddress: string;
  /** Display name, when available. Falls back to the truncated mint. */
  name: string;
  /** Collection name, when the asset belongs to a verified collection. */
  collection: string | null;
  /** Direct image URL. Empty string when we couldn't resolve one. */
  image: string;
}

export interface NftFetchResult {
  /** Either a populated NFT array or null when the RPC doesn't speak DAS. */
  assets: NftAsset[] | null;
  /** Human-readable hint about what to do next. */
  message?: string;
}

/** Detect whether the configured RPC URL is likely to support DAS. We
 *  whitelist the major DAS-capable providers so we don't ping public
 *  endpoints that we know will return an error. */
function rpcSupportsDas(rpcUrl: string): boolean {
  return /helius|quicknode|triton|alchemy|solanapro|extrnode/i.test(rpcUrl);
}

export async function fetchSolanaNfts(
  address: string,
  network: NetworkKey,
  limit: number = 24,
): Promise<NftFetchResult> {
  if (network !== "mainnet") {
    return {
      assets: null,
      message: "NFT listing is only wired for Solana mainnet in this template.",
    };
  }
  const rpcUrl = networkSpec("solana", network).rpcUrl;

  if (!rpcSupportsDas(rpcUrl)) {
    return {
      assets: null,
      message:
        "Plug a DAS-capable RPC (Helius, QuickNode, Triton) into Settings → Networks → Solana to enable NFT listing.",
    };
  }

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "wdk-template",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: address,
          page: 1,
          limit,
          displayOptions: { showFungible: false },
        },
      }),
    });
    if (!res.ok) {
      return { assets: null, message: `RPC error: HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      result?: { items?: RawAsset[] };
      error?: { message?: string };
    };
    if (json.error) {
      return {
        assets: null,
        message:
          "This RPC returned an error. Try a DAS-capable provider in Settings.",
      };
    }
    const items = json.result?.items ?? [];
    return { assets: items.map(normalise).filter((a) => a.mintAddress) };
  } catch (err) {
    return {
      assets: null,
      message:
        err instanceof Error
          ? err.message
          : "Failed to fetch NFTs from the configured RPC.",
    };
  }
}

// ─── DAS response normalisation ───────────────────────────────────────

interface RawAsset {
  id?: string;
  content?: {
    metadata?: { name?: string };
    files?: Array<{ uri?: string; cdn_uri?: string }>;
    links?: { image?: string };
  };
  grouping?: Array<{ group_key?: string; group_value?: string }>;
}

function normalise(item: RawAsset): NftAsset {
  const mintAddress = item?.id ?? "";
  const name = item?.content?.metadata?.name?.trim() || truncateMint(mintAddress);
  const image =
    item?.content?.links?.image ||
    item?.content?.files?.[0]?.cdn_uri ||
    item?.content?.files?.[0]?.uri ||
    "";
  const collectionEntry = item?.grouping?.find(
    (g) => g.group_key === "collection",
  );
  const collection = collectionEntry?.group_value ?? null;
  return { mintAddress, name, image, collection };
}

function truncateMint(mint: string): string {
  if (mint.length <= 12) return mint;
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}
