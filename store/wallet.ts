/**
 * Wallet state — kept in-memory only. The seed phrase NEVER lives here; it's
 * decrypted on demand from `lib/storage.ts` when an authenticated action runs.
 */

"use client";

import { create } from "zustand";

import { closeWallet, type WalletHandle } from "@/lib/wdk-client";
import { DEFAULT_NETWORK, type NetworkId } from "@/lib/networks";

export interface WalletState {
  handle: WalletHandle | null;
  network: NetworkId;
  /** Native (SOL) balance in lamports. */
  balance: bigint | null;
  /** UI preference — hide every balance number from screen. */
  balanceHidden: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  setHandle: (handle: WalletHandle | null) => void;
  setNetwork: (network: NetworkId) => void;
  setBalance: (balance: bigint | null) => void;
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

export const useWalletStore = create<WalletState>((set, get) => ({
  handle: null,
  network: DEFAULT_NETWORK,
  balance: null,
  balanceHidden: loadBalanceHidden(),
  status: "idle",
  error: null,
  setHandle: (handle) => set({ handle }),
  setNetwork: (network) => set({ network }),
  setBalance: (balance) => set({ balance }),
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
      balance: null,
      status: "idle",
      error: null,
    });
  },
}));
