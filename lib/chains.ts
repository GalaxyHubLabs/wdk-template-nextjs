/**
 * Single source of truth for every chain × network this template supports.
 *
 * Architecture: each chain has both a mainnet and a testnet spec. The active
 * network is a single global selection that applies to every registered chain
 * (so flipping the toggle re-binds Solana, TRON, TON, and Ethereum all at
 * once). This mirrors how production wallets like Phantom and MetaMask treat
 * "Mainnet / Testnet" — a session-level mode, not a per-chain knob.
 *
 * USDT contracts live in the network spec and are nullable. On mainnet every
 * chain has a canonical USDT deployment; on testnets we leave it null unless
 * the operator points an env var at their own test mint. This is why "No USDT
 * contract for this testnet" is the correct (intentional) state by default.
 */

export type ChainId = "solana" | "tron" | "ton" | "evm";
export type NetworkKey = "mainnet" | "testnet";

export interface UsdtConfig {
  /** SPL mint (Solana) / TRC-20 contract (TRON) / Jetton master (TON) /
   *  ERC-20 contract (EVM). */
  address: string;
  /** Token decimals (USDT is always 6 across chains today). */
  decimals: number;
  /** Optional URL of a logo asset. */
  logo?: string;
}

export interface NetworkSpec {
  /** RPC / API endpoint for this chain on this network. */
  rpcUrl: string;
  /** Build an explorer URL for a transaction signature/hash. */
  txExplorer: (id: string) => string;
  /** Build an explorer URL for an address. */
  addressExplorer: (id: string) => string;
  /** USDT contract on this network, if any. */
  usdt: UsdtConfig | null;
}

export interface ChainConfig {
  id: ChainId;
  /** Display name (e.g. "Solana"). */
  label: string;
  /** Short abbreviation (e.g. "SOL"). */
  shortLabel: string;
  /** Ticker of the chain's native asset. */
  nativeSymbol: string;
  /** Full name of the native asset. */
  nativeName: string;
  /** Decimals of the native asset. */
  nativeDecimals: number;
  /** Per-network configuration. */
  mainnet: NetworkSpec;
  testnet: NetworkSpec;
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
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_SOLANA_RPC_MAINNET",
        "https://api.mainnet-beta.solana.com",
      ),
      txExplorer: (sig) => `https://solscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://solscan.io/account/${addr}`,
      usdt: {
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        decimals: 6,
        logo: USDT_LOGO,
      },
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_SOLANA_RPC_DEVNET",
        "https://api.devnet.solana.com",
      ),
      txExplorer: (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`,
      addressExplorer: (addr) =>
        `https://solscan.io/account/${addr}?cluster=devnet`,
      // No official USDT on Solana devnet. Operators can drop a custom mint
      // via NEXT_PUBLIC_SOLANA_USDT_TESTNET.
      usdt: process.env.NEXT_PUBLIC_SOLANA_USDT_TESTNET
        ? {
            address: process.env.NEXT_PUBLIC_SOLANA_USDT_TESTNET,
            decimals: 6,
            logo: USDT_LOGO,
          }
        : null,
    },
  },
  tron: {
    id: "tron",
    label: "TRON",
    shortLabel: "TRX",
    nativeSymbol: "TRX",
    nativeName: "Tronix",
    nativeDecimals: 6,
    mainnet: {
      rpcUrl: envOr("NEXT_PUBLIC_TRON_RPC_MAINNET", "https://api.trongrid.io"),
      txExplorer: (sig) => `https://tronscan.org/#/transaction/${sig}`,
      addressExplorer: (addr) => `https://tronscan.org/#/address/${addr}`,
      usdt: {
        address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        decimals: 6,
        logo: USDT_LOGO,
      },
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_TRON_RPC_TESTNET",
        "https://api.shasta.trongrid.io",
      ),
      txExplorer: (sig) =>
        `https://shasta.tronscan.org/#/transaction/${sig}`,
      addressExplorer: (addr) =>
        `https://shasta.tronscan.org/#/address/${addr}`,
      usdt: process.env.NEXT_PUBLIC_TRON_USDT_TESTNET
        ? {
            address: process.env.NEXT_PUBLIC_TRON_USDT_TESTNET,
            decimals: 6,
            logo: USDT_LOGO,
          }
        : null,
    },
  },
  ton: {
    id: "ton",
    label: "TON",
    shortLabel: "TON",
    nativeSymbol: "TON",
    nativeName: "Toncoin",
    nativeDecimals: 9,
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_TON_RPC_MAINNET",
        "https://toncenter.com/api/v2/jsonRPC",
      ),
      txExplorer: (sig) => `https://tonviewer.com/transaction/${sig}`,
      addressExplorer: (addr) => `https://tonviewer.com/${addr}`,
      usdt: {
        address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        decimals: 6,
        logo: USDT_LOGO,
      },
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_TON_RPC_TESTNET",
        "https://testnet.toncenter.com/api/v2/jsonRPC",
      ),
      txExplorer: (sig) => `https://testnet.tonviewer.com/transaction/${sig}`,
      addressExplorer: (addr) => `https://testnet.tonviewer.com/${addr}`,
      usdt: process.env.NEXT_PUBLIC_TON_USDT_TESTNET
        ? {
            address: process.env.NEXT_PUBLIC_TON_USDT_TESTNET,
            decimals: 6,
            logo: USDT_LOGO,
          }
        : null,
    },
  },
  evm: {
    id: "evm",
    label: "Ethereum",
    shortLabel: "ETH",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    mainnet: {
      rpcUrl: envOr("NEXT_PUBLIC_EVM_RPC_MAINNET", "https://eth.llamarpc.com"),
      txExplorer: (sig) => `https://etherscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://etherscan.io/address/${addr}`,
      usdt: {
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
        logo: USDT_LOGO,
      },
    },
    testnet: {
      rpcUrl: envOr("NEXT_PUBLIC_EVM_RPC_TESTNET", "https://sepolia.drpc.org"),
      txExplorer: (sig) => `https://sepolia.etherscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
      usdt: process.env.NEXT_PUBLIC_EVM_USDT_TESTNET
        ? {
            address: process.env.NEXT_PUBLIC_EVM_USDT_TESTNET,
            decimals: 6,
            logo: USDT_LOGO,
          }
        : null,
    },
  },
};

export const CHAIN_IDS: readonly ChainId[] = ["solana", "tron", "ton", "evm"];

export const DEFAULT_CHAIN: ChainId = "solana";

/** Default session network. Testnet is safer for the out-of-the-box demo
 *  (faucets, no real money). Production forks should flip this to mainnet
 *  via env var. */
export const DEFAULT_NETWORK: NetworkKey =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as NetworkKey) || "testnet";

/** Display label for a network. */
export const NETWORK_LABEL: Record<NetworkKey, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
};

/** Shortcut to the active spec for a chain on a given network. */
export function networkSpec(chain: ChainId, network: NetworkKey): NetworkSpec {
  return CHAIN_CONFIGS[chain][network];
}
