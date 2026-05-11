/**
 * Curated list of SPL tokens shown in the wallet's token balances section.
 *
 * Mints are different per cluster — the same logical asset (e.g. USDT) has
 * a different mint address on mainnet vs devnet. Forkers should swap this
 * list for whatever assets matter to their product.
 *
 * Default ordering matters for the UI — the first entry shows up first.
 * USDT comes first to match this template's Tether WDK heritage.
 */

import type { NetworkId } from "./networks";

export interface SplToken {
  /** SPL mint address (base58). */
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Optional logo URL — Jupiter token list URLs work great here. */
  logo?: string;
}

const MAINNET_TOKENS: SplToken[] = [
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
];

const DEVNET_TOKENS: SplToken[] = [
  // Tether does not maintain an official USDT mint on Solana devnet. To
  // preview the USDT row against your own devnet deployment, set
  // `NEXT_PUBLIC_DEVNET_USDT_MINT=<your-mint>` and reload.
  ...(process.env.NEXT_PUBLIC_DEVNET_USDT_MINT
    ? [
        {
          mint: process.env.NEXT_PUBLIC_DEVNET_USDT_MINT,
          symbol: "USDT",
          name: "Tether USD (devnet)",
          decimals: 6,
        },
      ]
    : []),
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
