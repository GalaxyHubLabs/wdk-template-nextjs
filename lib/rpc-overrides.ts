/**
 * Per-chain RPC override registry.
 *
 * The defaults baked into `lib/chains.ts` work fine for casual use, but
 * production deployments invariably need to point each chain at a paid
 * provider (Helius, Alchemy, QuickNode, Triton, …) so the wallet
 * doesn't get rate-limited. Editing `.env.local` is fine for the
 * developer running the template, but a *user* of the deployed site
 * has no way to do that — hence this localStorage-backed override
 * surface.
 *
 * Reads are synchronous and SSR-safe: outside the browser we always
 * return `null` so the static config wins. Writes are immediate and
 * never block on network.
 *
 * `chains.ts::networkSpec()` consults this module so every existing
 * callsite — WDK registration in `openWallet`, watch-only balance
 * fetcher, Solana history feed, etc. — picks up the override without
 * any per-callsite change.
 */

import type { ChainId, NetworkKey } from "./chains";

const STORAGE_KEY = "wdk-template:rpc-overrides";

export type OverrideMap = Partial<Record<`${ChainId}:${NetworkKey}`, string>>;

function read(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as OverrideMap;
    return {};
  } catch {
    return {};
  }
}

function write(map: OverrideMap): void {
  if (typeof window === "undefined") return;
  if (Object.keys(map).length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }
}

/** Return the user-provided RPC URL for this chain × network, or null
 *  when none is set. Safe to call during SSR. */
export function getRpcOverride(
  chain: ChainId,
  network: NetworkKey,
): string | null {
  const map = read();
  const v = map[`${chain}:${network}`];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Persist an override. Trimmed; empty strings clear the override. */
export function setRpcOverride(
  chain: ChainId,
  network: NetworkKey,
  url: string,
): void {
  const trimmed = url.trim();
  const map = read();
  if (!trimmed) {
    delete map[`${chain}:${network}`];
  } else {
    map[`${chain}:${network}`] = trimmed;
  }
  write(map);
}

/** Remove the override for a single chain × network. */
export function clearRpcOverride(chain: ChainId, network: NetworkKey): void {
  const map = read();
  delete map[`${chain}:${network}`];
  write(map);
}

/** Snapshot of every override the user has set. Used by the settings
 *  UI to show which slots have customised values. */
export function getAllOverrides(): OverrideMap {
  return read();
}

/** Drop every override. Called on wallet wipe. */
export function clearAllOverrides(): void {
  write({});
}
