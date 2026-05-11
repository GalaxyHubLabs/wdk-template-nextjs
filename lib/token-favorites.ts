/**
 * Pinned (favorite) tokens.
 *
 * The wallet's token list grows fast — USDT plus XAUt plus whatever
 * custom contracts the user has imported plus eventually every
 * canonical Tether deployment on every chain. Pinning lets a heavy
 * user keep their two or three most-used tokens at the top of every
 * chain's view, the same way Phantom and Trust let you reorder tokens.
 *
 * Pins are local-only and keyed by `<chain>:<tokenAddress>` so the
 * same token on different chains can be pinned independently.
 * "Native" is a reserved address for the chain's gas token.
 */

import type { ChainId } from "./chains";

const STORAGE_KEY = "wdk-template:token-favorites";

type FavoriteKey = `${ChainId}:${string}`;

function read(): Set<FavoriteKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed as FavoriteKey[]);
  } catch {
    // fall through
  }
  return new Set();
}

function write(set: Set<FavoriteKey>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
}

export function isFavoriteToken(
  chain: ChainId,
  tokenAddress: string,
): boolean {
  return read().has(`${chain}:${tokenAddress}`);
}

export function toggleFavoriteToken(
  chain: ChainId,
  tokenAddress: string,
): boolean {
  const set = read();
  const key: FavoriteKey = `${chain}:${tokenAddress}`;
  if (set.has(key)) {
    set.delete(key);
    write(set);
    return false;
  }
  set.add(key);
  write(set);
  return true;
}

/** Snapshot of every favorite for a chain. */
export function getFavoritesForChain(chain: ChainId): string[] {
  const prefix = `${chain}:` as const;
  return Array.from(read())
    .filter((k): k is FavoriteKey => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}

/** Reset all favorites. Called on wallet wipe. */
export function resetTokenFavorites(): void {
  write(new Set());
}
