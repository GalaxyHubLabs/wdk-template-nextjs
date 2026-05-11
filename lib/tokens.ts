/**
 * Curated list of SPL tokens shown in the wallet's token balances section.
 *
 * Mints are different per cluster — the same logical asset (e.g. USDC) has
 * a different mint address on mainnet vs devnet. Forkers should swap this
 * list for whatever assets matter to their product.
 */

import type { NetworkId } from "./networks";

export interface SplToken {
  /** SPL mint address (base58). */
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

const MAINNET_TOKENS: SplToken[] = [
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
];

const DEVNET_TOKENS: SplToken[] = [
  // Circle's official USDC devnet mint
  {
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    symbol: "USDC",
    name: "USD Coin (devnet)",
    decimals: 6,
  },
];

export function getKnownTokens(network: NetworkId): SplToken[] {
  switch (network) {
    case "mainnet":
      return MAINNET_TOKENS;
    case "devnet":
      return DEVNET_TOKENS;
    default:
      return [];
  }
}
