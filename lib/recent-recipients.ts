/**
 * Recently-used recipients, per chain.
 *
 * Keeps the last N addresses the user has sent to on each chain in
 * `localStorage`, with timestamps. Two callers consume this:
 *
 *   - The send form, which surfaces recents as one-click chips so the
 *     user doesn't have to paste the same exchange deposit address
 *     ten times in a row.
 *   - The "first time sending to this address" warning, which checks
 *     whether the typed recipient appears anywhere in the per-chain
 *     recents or the address book before letting the user advance to
 *     review. Sending to a brand-new address is one of the most
 *     common phishing failure modes — surfacing the fact explicitly
 *     costs nothing and prevents real losses.
 *
 * The list is purely local UI state — no addresses ever leave the
 * device.
 */

import type { ChainId } from "./chains";

const STORAGE_KEY = "wdk-template:recent-recipients";
const MAX_PER_CHAIN = 8;

export interface RecentRecipient {
  chain: ChainId;
  address: string;
  /** Display label (resolved name or user-friendly identifier). Empty
   *  when the user sent to a raw address with no context. */
  label: string;
  /** Last time this recipient received a send from this device. */
  lastUsedAt: number;
}

type Store = Record<ChainId, RecentRecipient[]>;

function read(): Store {
  if (typeof window === "undefined") return {} as Store;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Store;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Store;
  } catch {
    // fallthrough
  }
  return {} as Store;
}

function write(store: Store): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** All recents on a single chain, newest first. */
export function getRecentRecipients(chain: ChainId): RecentRecipient[] {
  const list = read()[chain] ?? [];
  return list.slice().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** Record a send. De-duplicates on (chain, address) — re-sending to
 *  an existing entry just bumps its timestamp, doesn't fragment the
 *  list. Truncates per-chain to MAX_PER_CHAIN entries. */
export function rememberRecipient(input: {
  chain: ChainId;
  address: string;
  label?: string;
}): void {
  const store = read();
  const list = store[input.chain] ?? [];
  const filtered = list.filter(
    (e) => e.address.toLowerCase() !== input.address.toLowerCase(),
  );
  filtered.unshift({
    chain: input.chain,
    address: input.address,
    label: input.label?.trim() ?? "",
    lastUsedAt: Date.now(),
  });
  store[input.chain] = filtered.slice(0, MAX_PER_CHAIN);
  write(store);
}

/** Lookup: has this exact address been used on this chain before? */
export function isKnownRecipient(chain: ChainId, address: string): boolean {
  if (!address) return false;
  const list = read()[chain] ?? [];
  const lc = address.toLowerCase();
  return list.some((e) => e.address.toLowerCase() === lc);
}

/** Drop every entry. Used on wallet wipe. */
export function resetRecentRecipients(): void {
  write({} as Store);
}
