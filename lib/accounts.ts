/**
 * User-facing account list.
 *
 * WDK can derive infinitely many accounts from a single BIP-39 seed using
 * BIP-44 indices (0, 1, 2, …). This module tracks which indices the user
 * has explicitly "created" (and what they named them). The active account
 * — i.e. which index the wallet is currently derived at — lives on the
 * `WalletHandle` in `lib/wdk-client.ts`.
 *
 * Persisted in `localStorage` so account names survive reloads. Wiping
 * the vault also resets the list back to a single Account 1.
 */

const STORAGE_KEY = "wdk-template:accounts";

export interface AccountEntry {
  index: number;
  name: string;
  createdAt: number;
}

const DEFAULT_ENTRY: AccountEntry = {
  index: 0,
  name: "Account 1",
  createdAt: 0,
};

function read(): AccountEntry[] {
  if (typeof window === "undefined") return [DEFAULT_ENTRY];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_ENTRY];
    const parsed = JSON.parse(raw) as AccountEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_ENTRY];
    return parsed;
  } catch {
    return [DEFAULT_ENTRY];
  }
}

function write(list: AccountEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** All accounts the user has created, sorted by index. */
export function getAccounts(): AccountEntry[] {
  return read().slice().sort((a, b) => a.index - b.index);
}

/** Derive the next available index (last + 1, or 0 if list is empty). */
function nextIndex(list: AccountEntry[]): number {
  if (list.length === 0) return 0;
  return Math.max(...list.map((a) => a.index)) + 1;
}

/** Create a new account at the next index. Returns the new entry. */
export function createAccount(name?: string): AccountEntry {
  const list = read();
  const index = nextIndex(list);
  const entry: AccountEntry = {
    index,
    name: name?.trim() || `Account ${index + 1}`,
    createdAt: Date.now(),
  };
  write([...list, entry]);
  return entry;
}

/** Rename an existing account. */
export function renameAccount(index: number, newName: string): void {
  const list = read().map((a) =>
    a.index === index ? { ...a, name: newName.trim() || a.name } : a,
  );
  write(list);
}

/** Remove an account from the list (the underlying seed math is unchanged,
 *  the account simply disappears from the UI). Always keeps at least one
 *  account so the wallet has something to derive against. */
export function removeAccount(index: number): void {
  const list = read().filter((a) => a.index !== index);
  if (list.length === 0) {
    write([DEFAULT_ENTRY]);
  } else {
    write(list);
  }
}

/** Reset the account list to a single default account. Use on wallet wipe. */
export function resetAccounts(): void {
  write([DEFAULT_ENTRY]);
}
