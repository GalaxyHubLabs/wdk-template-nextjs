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
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  setHandle: (handle: WalletHandle | null) => void;
  setNetwork: (network: NetworkId) => void;
  setBalance: (balance: bigint | null) => void;
  setStatus: (status: WalletState["status"], error?: string | null) => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  handle: null,
  network: DEFAULT_NETWORK,
  balance: null,
  status: "idle",
  error: null,
  setHandle: (handle) => set({ handle }),
  setNetwork: (network) => set({ network }),
  setBalance: (balance) => set({ balance }),
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
