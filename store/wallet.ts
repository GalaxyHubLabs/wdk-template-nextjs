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

import { CHAIN_IDS, DEFAULT_CHAIN, type ChainId } from "@/lib/chains";
import { closeWallet, type WalletHandle } from "@/lib/wdk-client";

type ChainBigint = Partial<Record<ChainId, bigint | null>>;

export interface WalletState {
  handle: WalletHandle | null;
  /** Which chain the UI is currently focused on. */
  activeChain: ChainId;
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
  setNativeBalance: (chain: ChainId, balance: bigint | null) => void;
  setUsdtBalance: (chain: ChainId, balance: bigint | null) => void;
  setAllBalances: (
    natives: Partial<Record<ChainId, bigint>>,
    usdts: Partial<Record<ChainId, bigint>>,
  ) => void;
  setBalanceHidden: (hidden: boolean) => void;
  toggleBalanceHidden: () => void;
  setStatus: (status: WalletState["status"], error?: string | null) => void;
  reset: () => void;
}

const BALANCE_HIDDEN_KEY = "wdk-template:balance-hidden";

function loadBalanceHidden(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BALANCE_HIDDEN_KEY) === "1";
}

function persistBalanceHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  if (hidden) localStorage.setItem(BALANCE_HIDDEN_KEY, "1");
  else localStorage.removeItem(BALANCE_HIDDEN_KEY);
}

function emptyChainMap(): ChainBigint {
  return Object.fromEntries(CHAIN_IDS.map((id) => [id, null])) as ChainBigint;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  handle: null,
  activeChain: DEFAULT_CHAIN,
  nativeBalances: emptyChainMap(),
  usdtBalances: emptyChainMap(),
  balanceHidden: loadBalanceHidden(),
  status: "idle",
  error: null,

  setHandle: (handle) => set({ handle }),
  setActiveChain: (activeChain) => set({ activeChain }),
  setNativeBalance: (chain, balance) =>
    set((s) => ({ nativeBalances: { ...s.nativeBalances, [chain]: balance } })),
  setUsdtBalance: (chain, balance) =>
    set((s) => ({ usdtBalances: { ...s.usdtBalances, [chain]: balance } })),
  setAllBalances: (natives, usdts) =>
    set((s) => ({
      nativeBalances: { ...s.nativeBalances, ...natives },
      usdtBalances: { ...s.usdtBalances, ...usdts },
    })),
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
