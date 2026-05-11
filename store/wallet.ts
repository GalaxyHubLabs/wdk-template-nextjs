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

export interface WalletState {
  handle: WalletHandle | null;
  /** Which chain the UI is currently focused on. */
  activeChain: ChainId;
  /** Which network the wallet is bound to (applies to all chains). The
   *  handle.network and this should stay in sync — when they diverge the
   *  UI should treat the handle's network as the truth and re-derive. */
  activeNetwork: NetworkKey;
  /** Native balance per chain (chain-native smallest units). */
  nativeBalances: ChainBigint;
  /** USDT balance per chain (in 6-decimal smallest units when USDT is configured). */
  usdtBalances: ChainBigint;
  /** Hide every balance numeric value from screen — persisted preference. */
  balanceHidden: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  setHandle: (handle: WalletHandle | null) => void;
  setActiveChain: (chain: ChainId) => void;
  setActiveNetwork: (network: NetworkKey) => void;
  setNativeBalance: (chain: ChainId, balance: bigint | null) => void;
  setUsdtBalance: (chain: ChainId, balance: bigint | null) => void;
  setAllBalances: (
    natives: Partial<Record<ChainId, bigint>>,
    usdts: Partial<Record<ChainId, bigint>>,
  ) => void;
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
  usdtBalances: emptyChainMap(),
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
  setUsdtBalance: (chain, balance) =>
    set((s) => ({ usdtBalances: { ...s.usdtBalances, [chain]: balance } })),
  setAllBalances: (natives, usdts) =>
    set((s) => ({
      nativeBalances: { ...s.nativeBalances, ...natives },
      usdtBalances: { ...s.usdtBalances, ...usdts },
    })),
  clearBalances: () =>
    set({
      nativeBalances: emptyChainMap(),
      usdtBalances: emptyChainMap(),
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
      usdtBalances: emptyChainMap(),
      status: "idle",
      error: null,
    });
  },
}));
