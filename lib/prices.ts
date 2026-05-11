/**
 * Lightweight price feed against CoinGecko's free public API.
 *
 * - One batched request fetches USD prices for every asset the wallet
 *   knows about (native tokens + canonical Tether tokens).
 * - Results are cached in-memory for 60 seconds so the wallet UI can read
 *   prices synchronously after the first fetch resolves.
 * - On rate-limit or transient errors the cache is returned unchanged.
 *
 * For production deployments swap CoinGecko for an authenticated provider
 * (CoinGecko Pro, CoinMarketCap, or DefiLlama) — the public API tops out
 * around 30 calls/minute and rate-limits aggressively.
 */

/** CoinGecko asset IDs we care about. */
const ASSET_IDS = [
  "solana",
  "tron",
  "the-open-network",
  "ethereum",
  "binancecoin",
  "tether",
  "tether-gold",
] as const;

type AssetId = (typeof ASSET_IDS)[number];

const CACHE_TTL_MS = 60_000;

let cache: { at: number; prices: Partial<Record<AssetId, number>> } = {
  at: 0,
  prices: {},
};

async function fetchAllPrices(): Promise<Partial<Record<AssetId, number>>> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ASSET_IDS.join(",")}&vs_currencies=usd`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return cache.prices;
    const data = (await res.json()) as Record<string, { usd?: number }>;
    const next: Partial<Record<AssetId, number>> = {};
    for (const id of ASSET_IDS) {
      const v = data[id]?.usd;
      if (typeof v === "number") next[id] = v;
    }
    cache = { at: Date.now(), prices: next };
    return next;
  } catch {
    return cache.prices;
  }
}

/** Fetch (or read from cache) USD prices for every supported asset. */
export async function getPrices(): Promise<Partial<Record<AssetId, number>>> {
  if (Date.now() - cache.at < CACHE_TTL_MS && Object.keys(cache.prices).length > 0) {
    return cache.prices;
  }
  return fetchAllPrices();
}

/** Convert a raw balance (in chain-smallest units) to a USD number. */
export function toUsd(
  balance: bigint | null | undefined,
  decimals: number,
  pricePerUnit: number | undefined,
): number | null {
  if (balance == null || pricePerUnit == null) return null;
  // Convert bigint balance to a float carefully — we don't need cent-level
  // precision, just human-readable totals.
  const denom = 10 ** decimals;
  const human = Number(balance) / denom;
  return human * pricePerUnit;
}

/** Format a USD value for display: $1,234.56 / $0.42 / $0 . */
export function formatUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "$0";
  // Below $0.01 round up so we don't show "$0" for tiny but non-zero balances.
  if (value > 0 && value < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Map our internal chain native symbol to a CoinGecko asset id. */
export const NATIVE_PRICE_ID: Record<string, AssetId> = {
  SOL: "solana",
  TRX: "tron",
  TON: "the-open-network",
  ETH: "ethereum",
  BNB: "binancecoin",
};

export const TETHER_PRICE_ID = {
  USDT: "tether" as AssetId,
  XAUT: "tether-gold" as AssetId,
};
