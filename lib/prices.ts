/**
 * USD price feed backed by Tether's WDK pricing provider.
 *
 * Powered by two official WDK packages:
 *   - `@tetherto/wdk-pricing-provider` — the cache + multi-pair
 *     orchestrator.
 *   - `@tetherto/wdk-pricing-bitfinex-http` — the underlying client
 *     that fetches from Bitfinex's public ticker API. Bitfinex shares
 *     ownership with Tether, so this is the canonical price source
 *     for a WDK-first wallet template.
 *
 * The external surface (`getPrices`, `getPriceChanges`, `toUsd`,
 * `formatUsd`, `formatChange`) is unchanged from the previous
 * CoinGecko-backed implementation so the rest of the app — wallet
 * dashboard, watch view, send form — stays untouched. The keys we
 * return are the same CoinGecko-style asset ids (`solana`, `tron`,
 * `tether`, `tether-gold`, …) that the wallet store and the chain
 * configs already use; this module maps those to Bitfinex symbols
 * internally.
 */

import { PricingProvider } from "@tetherto/wdk-pricing-provider";
import { BitfinexPricingClient } from "@tetherto/wdk-pricing-bitfinex-http";

/** CoinGecko-style asset IDs the rest of the wallet code uses. We
 *  preserve them as the public key set so every existing call site
 *  (chain configs, wallet store, dashboard, watch view) keeps working
 *  without a per-callsite change. */
const ASSET_IDS = [
  "solana",
  "tron",
  "the-open-network",
  "ethereum",
  "binancecoin",
  "matic-network",
  "tether",
  "tether-gold",
  "bitcoin",
] as const;

type AssetId = (typeof ASSET_IDS)[number];

/** Map our external (CoinGecko-style) ids to Bitfinex base symbols.
 *  Bitfinex symbols are quote-pair: `tBTCUSD`, `tETHUSD`, …; the
 *  pricing client appends the `t` prefix and the quote currency on
 *  its own, so we only need the base ticker here. */
const BITFINEX_SYMBOL: Record<AssetId, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  tron: "TRX",
  "the-open-network": "TON",
  binancecoin: "BNB",
  "matic-network": "POL",
  // Bitfinex's USDT-USD pair (`tUSTUSD`) tracks USDT against USD via
  // the UST symbol. PricingClient handles the symbol normalisation
  // internally — we pass the plain "USDT" base and the client emits
  // the right ticker on the wire.
  tether: "USDT",
  "tether-gold": "XAUT",
} as const;

/** Quote currency. The wallet shows everything in USD. */
const QUOTE = "USD";

const CACHE_TTL_MS = 60_000;

/** 24-hour price change percentage. Positive = up, negative = down. */
export type PriceChanges = Partial<Record<AssetId, number>>;

interface CacheEntry {
  prices: Partial<Record<AssetId, number>>;
  changes: PriceChanges;
  at: number;
}

let cache: CacheEntry = { prices: {}, changes: {}, at: 0 };

// Lazy-initialised provider — Bitfinex client constructs an axios
// instance, which pulls in axios at module load. We hold it back
// until the first request so SSR bundles aren't paying that cost.
let provider: PricingProvider | null = null;
function getProvider(): PricingProvider {
  if (provider) return provider;
  provider = new PricingProvider({
    client: new BitfinexPricingClient(),
    priceCacheDurationMs: CACHE_TTL_MS,
  });
  return provider;
}

async function fetchAllPrices(): Promise<{
  prices: Partial<Record<AssetId, number>>;
  changes: PriceChanges;
}> {
  try {
    const p = getProvider();
    const pairs = ASSET_IDS.map((id) => ({
      from: BITFINEX_SYMBOL[id],
      to: QUOTE,
    }));
    const data = await p.getMultiLastPriceData(pairs);
    const prices: Partial<Record<AssetId, number>> = {};
    const changes: PriceChanges = {};
    for (let i = 0; i < ASSET_IDS.length; i++) {
      const id = ASSET_IDS[i];
      const row = data[i];
      if (row?.lastPrice && Number.isFinite(row.lastPrice)) {
        prices[id] = row.lastPrice;
      }
      if (
        typeof row?.dailyChangeRelative === "number" &&
        Number.isFinite(row.dailyChangeRelative)
      ) {
        // Bitfinex returns the relative change as a ratio (0.05 = +5%).
        // Multiply by 100 to match the percentage format the previous
        // CoinGecko-backed feed emitted, which is what the UI's
        // `PriceChangeBadge` already expects.
        changes[id] = row.dailyChangeRelative * 100;
      }
    }
    cache = { prices, changes, at: Date.now() };
    return { prices, changes };
  } catch {
    // Fall back to last-good values on any pricing error so the UI
    // never flips to all-null mid-session.
    return { prices: cache.prices, changes: cache.changes };
  }
}

/** Fetch (or read from cache) USD prices for every supported asset. */
export async function getPrices(): Promise<Partial<Record<AssetId, number>>> {
  if (
    Date.now() - cache.at < CACHE_TTL_MS &&
    Object.keys(cache.prices).length > 0
  ) {
    return cache.prices;
  }
  const { prices } = await fetchAllPrices();
  return prices;
}

/** Fetch (or read from cache) the 24-hour price-change percentages
 *  keyed by the same asset ids as `getPrices()`. Cached jointly with
 *  prices since they come from the same provider call. */
export async function getPriceChanges(): Promise<PriceChanges> {
  if (
    Date.now() - cache.at < CACHE_TTL_MS &&
    Object.keys(cache.prices).length > 0
  ) {
    return cache.changes;
  }
  const { changes } = await fetchAllPrices();
  return changes;
}

/** Format a 24h change as a signed percentage with one decimal place. */
export function formatChange(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
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

/** Map our internal chain native symbol to a CoinGecko-style asset id.
 *  Kept for backward compatibility — every callsite already uses the
 *  asset id directly off the chain config, this map isn't on a hot path. */
export const NATIVE_PRICE_ID: Record<string, AssetId> = {
  SOL: "solana",
  TRX: "tron",
  TON: "the-open-network",
  ETH: "ethereum",
  BNB: "binancecoin",
  MATIC: "matic-network",
  BTC: "bitcoin",
};

export const TETHER_PRICE_ID = {
  USDT: "tether" as AssetId,
  XAUT: "tether-gold" as AssetId,
};
