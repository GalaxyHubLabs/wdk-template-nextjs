/**
 * Human-readable name resolution.
 *
 * Wallet users routinely think in names ("vitalik.eth") rather than
 * hex addresses. We resolve a handful of public name systems so the
 * send form and the address book can accept names directly without
 * the user pre-resolving them by hand.
 *
 * Supported today:
 *  - ENS (.eth) — resolved against Ethereum mainnet via the same
 *    `ethers` package that the `@tetherto/wdk-wallet-evm` module
 *    already brings in transitively. Because ENS is L1-anchored,
 *    resolution is done against Ethereum mainnet RPC regardless of
 *    which EVM chain the user is currently sending on, and the
 *    resolved hex address is then used as-is on the target chain
 *    (EVM addresses are portable across the family).
 *  - SNS (.sol) — resolved against Bonfida's public HTTPS resolver.
 *    Avoids embedding the SNS SDK so the dependency tree stays focused
 *    on Tether WDK.
 *
 * Results are cached in-memory per session so repeatedly looking up
 * the same name (e.g. switching between send and address book) does
 * not re-hit the network.
 */

import { ethers } from "ethers";

import { CHAIN_CONFIGS, type ChainId, type NetworkKey } from "./chains";

const cache = new Map<string, { at: number; address: string | null }>();
const CACHE_TTL_MS = 5 * 60_000;

export function looksLikeName(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  return trimmed.endsWith(".eth") || trimmed.endsWith(".sol");
}

/** Attempt to resolve `name` to a concrete address for the given chain.
 *  Returns null when the name isn't recognised, doesn't resolve, or
 *  the public RPC throttles us. Never throws. */
export async function resolveName(
  chain: ChainId,
  name: string,
  network: NetworkKey,
): Promise<string | null> {
  const trimmed = name.trim().toLowerCase();
  const cacheKey = `${chain}:${network}:${trimmed}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.address;

  let resolved: string | null = null;
  try {
    if (trimmed.endsWith(".eth")) {
      // ENS is L1-only. The resolved address is portable across every
      // EVM chain since the same keypair owns it on all of them.
      if (chain === "solana" || chain === "tron" || chain === "ton") {
        resolved = null;
      } else {
        resolved = await resolveEns(trimmed);
      }
    } else if (trimmed.endsWith(".sol") && chain === "solana") {
      resolved = await resolveSns(trimmed, network);
    }
  } catch {
    resolved = null;
  }
  cache.set(cacheKey, { at: Date.now(), address: resolved });
  return resolved;
}

// ─── ENS via ethers v6 ────────────────────────────────────────────────────

async function resolveEns(name: string): Promise<string | null> {
  // Always query Ethereum mainnet — ENS isn't deployed on the L2s we
  // support, and `ethers.resolveName` handles the registry → resolver
  // → addr chain for us.
  const rpcUrl = CHAIN_CONFIGS.evm.mainnet.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    const addr = await provider.resolveName(name);
    return addr ?? null;
  } finally {
    // ethers v6 providers hold a websocket-like reference; explicit
    // destroy keeps the GC honest in a long-lived SPA session.
    provider.destroy?.();
  }
}

// ─── SNS via Bonfida's public API ─────────────────────────────────────────

async function resolveSns(
  name: string,
  network: NetworkKey,
): Promise<string | null> {
  // SNS lives on Solana mainnet — there is no devnet equivalent.
  if (network !== "mainnet") return null;
  const url = `https://sns-api.bonfida.com/v2/domains/${encodeURIComponent(name)}/resolve`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string };
  return data.result ?? null;
}
