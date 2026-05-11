/**
 * Address book — saved recipient addresses keyed by chain. Persisted in
 * localStorage. Used by the send flow to autocomplete recipients and by a
 * dedicated /wallet/addresses page for management.
 */

import type { ChainId } from "./chains";

const STORAGE_KEY = "wdk-template:address-book";

export interface AddressEntry {
  /** Stable id (generated on insert). */
  id: string;
  chain: ChainId;
  name: string;
  address: string;
  note?: string;
  createdAt: number;
}

type Stored = Partial<Record<ChainId, AddressEntry[]>>;

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

function newId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.floor(Math.random() * 1_000_000).toString(36)
  );
}

export function getAddressBook(chain: ChainId): AddressEntry[] {
  return (read()[chain] ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllAddressBookEntries(): AddressEntry[] {
  return Object.values(read())
    .flat()
    .filter((entry): entry is AddressEntry => Boolean(entry))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function addAddressBookEntry(
  chain: ChainId,
  name: string,
  address: string,
  note?: string,
): AddressEntry {
  const state = read();
  const entry: AddressEntry = {
    id: newId(),
    chain,
    name: name.trim(),
    address: address.trim(),
    note: note?.trim() || undefined,
    createdAt: Date.now(),
  };
  state[chain] = [...(state[chain] ?? []), entry];
  write(state);
  return entry;
}

export function removeAddressBookEntry(chain: ChainId, id: string): void {
  const state = read();
  state[chain] = (state[chain] ?? []).filter((e) => e.id !== id);
  write(state);
}

export function findAddressBookEntry(
  chain: ChainId,
  address: string,
): AddressEntry | undefined {
  const normalized =
    chain === "evm" || chain === "bsc" ? address.trim().toLowerCase() : address.trim();
  return getAddressBook(chain).find((e) =>
    chain === "evm" || chain === "bsc"
      ? e.address.toLowerCase() === normalized
      : e.address === normalized,
  );
}
