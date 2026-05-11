/**
 * Wallet state — kept in-memory only. The seed phrase NEVER lives here; it's
 * decrypted on demand from `lib/storage.ts` when an authenticated action runs.
 *
 * The store is multi-chain — the `handle` carries one derived account per
 * registered chain, and per-chain balances are cached so the UI can render
 * immediately when the user toggles between chains.
 */

"use client";

import { create } from "zustand";

import {
  CHAIN_IDS,
  DEFAULT_CHAIN,
  DEFAULT_NETWORK,
  type ChainId,
  type NetworkKey,
} from "@/lib/chains";
import { closeWallet, type WalletHandle } from "@/lib/wdk-client";

type ChainBigint = Partial<Record<ChainId, bigint | null>>;
type ChainTokens = Partial<Record<ChainId, Record<string, bigint>>>;

export interface WalletState {
  handle: WalletHandle | null;
  /** Which chain the UI is currently focused on. */
  activeChain: ChainId;
  /** Which network the wallet is bound to (applies to all chains). */
  activeNetwork: NetworkKey;
  /** Native balance per chain (chain-native smallest units). */
  nativeBalances: ChainBigint;
  /** Tether token balances per chain, keyed by token contract/mint address. */
  tetherBalances: ChainTokens;
  /** USD prices keyed by CoinGecko asset id. */
  prices: Record<string, number>;
  /** Hide every balance numeric value from screen — persisted preference. */
  balanceHidden: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  setHandle: (handle: WalletHandle | null) => void;
  setActiveChain: (chain: ChainId) => void;
  setActiveNetwork: (network: NetworkKey) => void;
  setNativeBalance: (chain: ChainId, balance: bigint | null) => void;
  setAllBalances: (
    natives: Partial<Record<ChainId, bigint>>,
    tethers: Partial<Record<ChainId, Record<string, bigint>>>,
  ) => void;
  setPrices: (prices: Record<string, number>) => void;
  clearBalances: () => void;
  setBalanceHidden: (hidden: boolean) => void;
  toggleBalanceHidden: () => void;
  setStatus: (status: WalletState["status"], error?: string | null) => void;
  reset: () => void;
}

const BALANCE_HIDDEN_KEY = "wdk-template:balance-hidden";
const NETWORK_KEY = "wdk-template:network";

function loadBalanceHidden(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BALANCE_HIDDEN_KEY) === "1";
}

function persistBalanceHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  if (hidden) localStorage.setItem(BALANCE_HIDDEN_KEY, "1");
  else localStorage.removeItem(BALANCE_HIDDEN_KEY);
}

function loadNetwork(): NetworkKey {
  if (typeof window === "undefined") return DEFAULT_NETWORK;
  const v = localStorage.getItem(NETWORK_KEY);
  return v === "mainnet" || v === "testnet" ? v : DEFAULT_NETWORK;
}

function persistNetwork(network: NetworkKey): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NETWORK_KEY, network);
}

function emptyChainMap(): ChainBigint {
  return Object.fromEntries(CHAIN_IDS.map((id) => [id, null])) as ChainBigint;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  handle: null,
  activeChain: DEFAULT_CHAIN,
  activeNetwork: loadNetwork(),
  nativeBalances: emptyChainMap(),
  tetherBalances: {},
  prices: {},
  balanceHidden: loadBalanceHidden(),
  status: "idle",
  error: null,

  setHandle: (handle) => set({ handle }),
  setActiveChain: (activeChain) => set({ activeChain }),
  setActiveNetwork: (network) => {
    persistNetwork(network);
    set({ activeNetwork: network });
  },
  setNativeBalance: (chain, balance) =>
    set((s) => ({ nativeBalances: { ...s.nativeBalances, [chain]: balance } })),
  setAllBalances: (natives, tethers) =>
    set((s) => ({
      nativeBalances: { ...s.nativeBalances, ...natives },
      tetherBalances: { ...s.tetherBalances, ...tethers },
    })),
  setPrices: (prices) => set({ prices }),
  clearBalances: () =>
    set({
      nativeBalances: emptyChainMap(),
      tetherBalances: {},
    }),
  setBalanceHidden: (hidden) => {
    persistBalanceHidden(hidden);
    set({ balanceHidden: hidden });
  },
  toggleBalanceHidden: () => {
    const next = !get().balanceHidden;
    persistBalanceHidden(next);
    set({ balanceHidden: next });
  },
  setStatus: (status, error = null) => set({ status, error }),
  reset: () => {
    closeWallet(get().handle);
    set({
      handle: null,
      nativeBalances: emptyChainMap(),
      tetherBalances: {},
      status: "idle",
      error: null,
    });
  },
}));
