/**
 * User-defined SPL / TRC-20 / Jetton / ERC-20 tokens.
 *
 * Persisted in `localStorage` per chain. The shape mirrors `UsdtConfig`
 * in chains.ts so the wallet can render canonical and custom tokens
 * with the same component.
 *
 * Auto-fetch is supported for Solana via the public Jupiter token API,
 * which is the de facto SPL token registry. For the other three chains
 * the user fills in symbol / name / decimals manually; the wallet
 * doesn't ship a multi-chain price/metadata indexer (that'd duplicate
 * what Helius / CoinGecko / Moralis already provide better than we
 * could in a template).
 */

import type { ChainId } from "./chains";

const STORAGE_KEY = "wdk-template:custom-tokens";

export interface CustomToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

type Stored = Partial<Record<ChainId, CustomToken[]>>;

function read(): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function write(state: Stored): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getCustomTokens(chain: ChainId): CustomToken[] {
  return read()[chain] ?? [];
}

export function addCustomToken(chain: ChainId, token: CustomToken): void {
  const state = read();
  const list = state[chain] ?? [];
  // Dedup by address (case-insensitive for EVM, exact for the rest).
  const normalized = chain === "evm" ? token.address.toLowerCase() : token.address;
  const filtered = list.filter((t) =>
    chain === "evm"
      ? t.address.toLowerCase() !== normalized
      : t.address !== normalized,
  );
  state[chain] = [...filtered, token];
  write(state);
}

export function removeCustomToken(chain: ChainId, address: string): void {
  const state = read();
  const list = state[chain] ?? [];
  state[chain] = list.filter((t) =>
    chain === "evm"
      ? t.address.toLowerCase() !== address.toLowerCase()
      : t.address !== address,
  );
  write(state);
}

/**
 * Look up SPL token metadata via the Jupiter token API. Free, fast, and
 * widely used as the canonical registry for Solana token metadata.
 *
 * Returns `null` when the mint is unknown to Jupiter — the user can
 * still add it manually with the form fields.
 */
export async function fetchSolanaTokenMetadata(
  mint: string,
): Promise<Pick<CustomToken, "symbol" | "name" | "decimals" | "logo"> | null> {
  try {
    const res = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      id?: string;
      address?: string;
      symbol?: string;
      name?: string;
      decimals?: number;
      icon?: string;
      logoURI?: string;
    }>;
    if (!Array.isArray(data)) return null;
    const match = data.find((t) => t.id === mint || t.address === mint);
    if (!match) return null;
    return {
      symbol: String(match.symbol ?? "").slice(0, 16),
      name: String(match.name ?? "").slice(0, 64),
      decimals: typeof match.decimals === "number" ? match.decimals : 0,
      logo: match.icon || match.logoURI,
    };
  } catch {
    return null;
  }
}
