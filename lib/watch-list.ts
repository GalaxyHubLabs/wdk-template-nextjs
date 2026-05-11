/**
 * Watch-only address registry.
 *
 * Watch entries are completely separate from BIP-44 accounts: they are an
 * address + chain pair we can fetch balances against without ever holding
 * any private key material. Stored in localStorage so they survive reloads,
 * and wiped on full wallet wipe.
 *
 * One entry, one chain. Watching the "same" address across multiple chains
 * is intentionally modelled as multiple entries — that's what users mean
 * when they ask to watch "0xabc on Ethereum and BSC" anyway.
 */

import type { ChainId } from "./chains";

const STORAGE_KEY = "wdk-template:watch-list";

export interface WatchEntry {
  /** Stable client-side id (random, not derived from the address). */
  id: string;
  /** User-given nickname. Defaults to a truncated address. */
  label: string;
  /** Chain this entry is bound to — balance fetching follows this. */
  chain: ChainId;
  /** The watched address. Stored as-is; validation happens at add time. */
  address: string;
  /** Unix-ms timestamp of when the entry was created. */
  addedAt: number;
}

function read(): WatchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function write(list: WatchEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function randomId(): string {
  // crypto.randomUUID is the right primitive; fall back to a timestamp +
  // random suffix for very old browsers (this template targets modern ones,
  // so the fallback should effectively never fire).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Every watch entry, newest first. */
export function getWatchList(): WatchEntry[] {
  return read().slice().sort((a, b) => b.addedAt - a.addedAt);
}

/** Look up a single entry by id. Returns null if not found. */
export function getWatchEntry(id: string): WatchEntry | null {
  return read().find((e) => e.id === id) ?? null;
}

/** Add a new watch entry. The caller is expected to have already validated
 *  the address shape for the given chain. Returns the created entry. */
export function addWatchEntry(input: {
  chain: ChainId;
  address: string;
  label?: string;
}): WatchEntry {
  const list = read();
  const trimmedAddress = input.address.trim();
  // De-dupe: if the same (chain, address) pair already exists, return that
  // entry instead of inserting a duplicate.
  const existing = list.find(
    (e) => e.chain === input.chain && e.address === trimmedAddress,
  );
  if (existing) return existing;

  const entry: WatchEntry = {
    id: randomId(),
    chain: input.chain,
    address: trimmedAddress,
    label: input.label?.trim() || defaultLabel(trimmedAddress),
    addedAt: Date.now(),
  };
  write([...list, entry]);
  return entry;
}

/** Rename a watch entry. No-op if the entry isn't found or the name is empty. */
export function renameWatchEntry(id: string, newLabel: string): void {
  const next = newLabel.trim();
  if (!next) return;
  write(read().map((e) => (e.id === id ? { ...e, label: next } : e)));
}

/** Remove a single entry. */
export function removeWatchEntry(id: string): void {
  write(read().filter((e) => e.id !== id));
}

/** Drop the entire watch list. Called on wallet wipe. */
export function resetWatchList(): void {
  write([]);
}

function defaultLabel(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
