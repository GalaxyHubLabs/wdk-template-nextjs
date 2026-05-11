/**
 * Single source of truth for every chain this template supports.
 *
 * This template defaults to **testnets** so the wallet can be exercised end
 * to end without spending real funds. Set the matching `NEXT_PUBLIC_*` env
 * vars to swap to mainnet RPCs, and flip `isTestnet` accordingly when forking
 * for production.
 *
 * Why a single `chains.ts` instead of separate `networks.ts` + `tokens.ts`?
 * Because every UI surface needs the chain-level facts together: address +
 * symbol + decimals + explorer + native token + USDT contract. Splitting them
 * forced page components to look up two different files for one rendering.
 */

export type ChainId = "solana" | "tron" | "ton" | "evm";

export interface UsdtConfig {
  /** SPL mint (Solana) / TRC-20 contract (TRON) / Jetton master (TON) /
   *  ERC-20 contract (EVM). */
  address: string;
  /** Token decimals (USDT is always 6 across chains today). */
  decimals: number;
  /** Optional URL of a logo asset. */
  logo?: string;
}

export interface ChainConfig {
  id: ChainId;
  /** Display name in the UI (e.g. "Solana"). */
  label: string;
  /** Short abbreviation (e.g. "SOL"). */
  shortLabel: string;
  /** Ticker of the chain's native asset (e.g. "SOL", "TRX"). */
  nativeSymbol: string;
  /** Full name of the native asset. */
  nativeName: string;
  /** Decimals of the native asset. */
  nativeDecimals: number;
  /** Network the template is currently targeting (testnet by default). */
  isTestnet: boolean;
  /** RPC / API endpoint for this chain. */
  rpcUrl: string;
  /** Build an explorer URL for a transaction signature/hash. */
  txExplorer: (id: string) => string;
  /** Build an explorer URL for an address. */
  addressExplorer: (id: string) => string;
  /** USDT contract on this chain, if available on the active network. */
  usdt: UsdtConfig | null;
}

const USDT_LOGO =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg";

function envOr(key: string, fallback: string): string {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return fallback;
}

export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  solana: {
    id: "solana",
    label: "Solana",
    shortLabel: "SOL",
    nativeSymbol: "SOL",
    nativeName: "Solana",
    nativeDecimals: 9,
    isTestnet: true,
    rpcUrl: envOr(
      "NEXT_PUBLIC_SOLANA_RPC",
      "https://api.devnet.solana.com",
    ),
    txExplorer: (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`,
    addressExplorer: (addr) => `https://solscan.io/account/${addr}?cluster=devnet`,
    // Tether does not maintain an official USDT mint on Solana devnet —
    // leave null here. Set NEXT_PUBLIC_SOLANA_USDT_MINT to preview the row
    // against your own devnet deployment.
    usdt: process.env.NEXT_PUBLIC_SOLANA_USDT_MINT
      ? {
          address: process.env.NEXT_PUBLIC_SOLANA_USDT_MINT,
          decimals: 6,
          logo: USDT_LOGO,
        }
      : null,
  },
  tron: {
    id: "tron",
    label: "TRON",
    shortLabel: "TRX",
    nativeSymbol: "TRX",
    nativeName: "Tronix",
    nativeDecimals: 6,
    isTestnet: true,
    rpcUrl: envOr("NEXT_PUBLIC_TRON_RPC", "https://api.shasta.trongrid.io"),
    txExplorer: (sig) => `https://shasta.tronscan.org/#/transaction/${sig}`,
    addressExplorer: (addr) => `https://shasta.tronscan.org/#/address/${addr}`,
    // Shasta does not have an official USDT — set NEXT_PUBLIC_TRON_USDT_CONTRACT
    // to preview. Mainnet USDT-TRC20 is TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t.
    usdt: process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT
      ? {
          address: process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT,
          decimals: 6,
          logo: USDT_LOGO,
        }
      : null,
  },
  ton: {
    id: "ton",
    label: "TON",
    shortLabel: "TON",
    nativeSymbol: "TON",
    nativeName: "Toncoin",
    nativeDecimals: 9,
    isTestnet: true,
    rpcUrl: envOr(
      "NEXT_PUBLIC_TON_RPC",
      "https://testnet.toncenter.com/api/v2/jsonRPC",
    ),
    txExplorer: (sig) => `https://testnet.tonviewer.com/transaction/${sig}`,
    addressExplorer: (addr) => `https://testnet.tonviewer.com/${addr}`,
    // Mainnet USDT jetton master is EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs.
    usdt: process.env.NEXT_PUBLIC_TON_USDT_JETTON
      ? {
          address: process.env.NEXT_PUBLIC_TON_USDT_JETTON,
          decimals: 6,
          logo: USDT_LOGO,
        }
      : null,
  },
  evm: {
    id: "evm",
    label: "Ethereum",
    shortLabel: "ETH",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    isTestnet: true,
    rpcUrl: envOr("NEXT_PUBLIC_EVM_RPC", "https://sepolia.drpc.org"),
    txExplorer: (sig) => `https://sepolia.etherscan.io/tx/${sig}`,
    addressExplorer: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
    // Mainnet USDT-ERC20 is 0xdAC17F958D2ee523a2206206994597C13D831ec7.
    usdt: process.env.NEXT_PUBLIC_EVM_USDT_CONTRACT
      ? {
          address: process.env.NEXT_PUBLIC_EVM_USDT_CONTRACT,
          decimals: 6,
          logo: USDT_LOGO,
        }
      : null,
  },
};

export const CHAIN_IDS: readonly ChainId[] = ["solana", "tron", "ton", "evm"];

export const DEFAULT_CHAIN: ChainId = "solana";
