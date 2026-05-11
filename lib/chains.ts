/**
 * Single source of truth for every chain × network this template supports.
 *
 * Each chain ships both a mainnet and a testnet spec. The active network is
 * a single global selection that applies to every registered chain (so
 * flipping the toggle re-binds Solana, TRON, TON, Ethereum, and BSC all at
 * once). This mirrors how production wallets like Phantom and MetaMask treat
 * "Mainnet / Testnet" — a session-level mode, not a per-chain knob.
 *
 * Tether tokens (USDT, XAUt) live in `tetherTokens[]` per network spec. On
 * chains where Tether has no canonical deployment for a given network the
 * list is empty unless the operator points the matching env var at their
 * own deployment.
 */

export type ChainId = "solana" | "tron" | "ton" | "evm" | "bsc";
export type NetworkKey = "mainnet" | "testnet";

export interface TetherToken {
  /** Token symbol displayed in the UI. */
  symbol: "USDT" | "XAUt";
  /** SPL mint (Solana) / TRC-20 contract (TRON) / Jetton master (TON) /
   *  ERC-20 / BEP-20 contract (EVM, BSC). */
  address: string;
  /** Token decimals. */
  decimals: number;
  /** Full name. */
  name: string;
  /** Optional logo URL. */
  logo?: string;
  /** CoinGecko asset id for USD price lookup. */
  priceId: "tether" | "tether-gold";
}

export interface NetworkSpec {
  rpcUrl: string;
  txExplorer: (id: string) => string;
  addressExplorer: (id: string) => string;
  tetherTokens: TetherToken[];
}

export interface ChainConfig {
  id: ChainId;
  label: string;
  shortLabel: string;
  nativeSymbol: string;
  nativeName: string;
  nativeDecimals: number;
  /** Trustwallet-hosted logo for the chain. */
  logo: string;
  /** CoinGecko asset id for the chain's native asset (used to fetch USD price). */
  nativePriceId:
    | "solana"
    | "tron"
    | "the-open-network"
    | "ethereum"
    | "binancecoin";
  mainnet: NetworkSpec;
  testnet: NetworkSpec;
}

const TRUSTWALLET =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

const USDT_LOGO = `${TRUSTWALLET}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`;
const XAUT_LOGO = `${TRUSTWALLET}/ethereum/assets/0x68749665FF8D2d112Fa859AA293F07A622782F38/logo.png`;

function envOr(key: string, fallback: string): string {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return fallback;
}

/** Helper to optionally include a Tether token from an env-configured address. */
function envToken(
  envKey: string,
  base: Omit<TetherToken, "address">,
): TetherToken[] {
  const addr = process.env[envKey];
  return addr ? [{ ...base, address: addr }] : [];
}

export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  solana: {
    id: "solana",
    label: "Solana",
    shortLabel: "SOL",
    nativeSymbol: "SOL",
    nativeName: "Solana",
    nativeDecimals: 9,
    logo: `${TRUSTWALLET}/solana/info/logo.png`,
    nativePriceId: "solana",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_SOLANA_RPC_MAINNET",
        "https://api.mainnet-beta.solana.com",
      ),
      txExplorer: (sig) => `https://solscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://solscan.io/account/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
        // No official XAUt deployment on Solana yet.
      ],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_SOLANA_RPC_DEVNET",
        "https://api.devnet.solana.com",
      ),
      txExplorer: (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`,
      addressExplorer: (addr) =>
        `https://solscan.io/account/${addr}?cluster=devnet`,
      tetherTokens: envToken("NEXT_PUBLIC_SOLANA_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (devnet)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  tron: {
    id: "tron",
    label: "TRON",
    shortLabel: "TRX",
    nativeSymbol: "TRX",
    nativeName: "Tronix",
    nativeDecimals: 6,
    logo: `${TRUSTWALLET}/tron/info/logo.png`,
    nativePriceId: "tron",
    mainnet: {
      rpcUrl: envOr("NEXT_PUBLIC_TRON_RPC_MAINNET", "https://api.trongrid.io"),
      txExplorer: (sig) => `https://tronscan.org/#/transaction/${sig}`,
      addressExplorer: (addr) => `https://tronscan.org/#/address/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
        {
          symbol: "XAUt",
          address: "TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4",
          decimals: 6,
          name: "Tether Gold",
          logo: XAUT_LOGO,
          priceId: "tether-gold",
        },
      ],
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
      tetherTokens: envToken("NEXT_PUBLIC_TRON_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (shasta)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  ton: {
    id: "ton",
    label: "TON",
    shortLabel: "TON",
    nativeSymbol: "TON",
    nativeName: "Toncoin",
    nativeDecimals: 9,
    logo: `${TRUSTWALLET}/ton/info/logo.png`,
    nativePriceId: "the-open-network",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_TON_RPC_MAINNET",
        "https://toncenter.com/api/v2/jsonRPC",
      ),
      txExplorer: (sig) => `https://tonviewer.com/transaction/${sig}`,
      addressExplorer: (addr) => `https://tonviewer.com/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
      ],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_TON_RPC_TESTNET",
        "https://testnet.toncenter.com/api/v2/jsonRPC",
      ),
      txExplorer: (sig) => `https://testnet.tonviewer.com/transaction/${sig}`,
      addressExplorer: (addr) => `https://testnet.tonviewer.com/${addr}`,
      tetherTokens: envToken("NEXT_PUBLIC_TON_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (testnet)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  evm: {
    id: "evm",
    label: "Ethereum",
    shortLabel: "ETH",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    logo: `${TRUSTWALLET}/ethereum/info/logo.png`,
    nativePriceId: "ethereum",
    mainnet: {
      rpcUrl: envOr("NEXT_PUBLIC_EVM_RPC_MAINNET", "https://eth.llamarpc.com"),
      txExplorer: (sig) => `https://etherscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://etherscan.io/address/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
        {
          symbol: "XAUt",
          address: "0x68749665FF8D2d112Fa859AA293F07A622782F38",
          decimals: 6,
          name: "Tether Gold",
          logo: XAUT_LOGO,
          priceId: "tether-gold",
        },
      ],
    },
    testnet: {
      rpcUrl: envOr("NEXT_PUBLIC_EVM_RPC_TESTNET", "https://sepolia.drpc.org"),
      txExplorer: (sig) => `https://sepolia.etherscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
      tetherTokens: envToken("NEXT_PUBLIC_EVM_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (Sepolia)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  bsc: {
    id: "bsc",
    label: "BNB Smart Chain",
    shortLabel: "BSC",
    nativeSymbol: "BNB",
    nativeName: "BNB",
    nativeDecimals: 18,
    logo: `${TRUSTWALLET}/smartchain/info/logo.png`,
    nativePriceId: "binancecoin",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_BSC_RPC_MAINNET",
        "https://bsc-dataseed.binance.org",
      ),
      txExplorer: (sig) => `https://bscscan.com/tx/${sig}`,
      addressExplorer: (addr) => `https://bscscan.com/address/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          address: "0x55d398326f99059fF775485246999027B3197955",
          decimals: 18,
          name: "Tether USD (BEP-20)",
          logo: USDT_LOGO,
          priceId: "tether",
        },
      ],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_BSC_RPC_TESTNET",
        "https://data-seed-prebsc-1-s1.binance.org:8545",
      ),
      txExplorer: (sig) => `https://testnet.bscscan.com/tx/${sig}`,
      addressExplorer: (addr) => `https://testnet.bscscan.com/address/${addr}`,
      tetherTokens: envToken("NEXT_PUBLIC_BSC_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 18,
        name: "Tether USD (BSC testnet)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
};

export const CHAIN_IDS: readonly ChainId[] = [
  "solana",
  "tron",
  "ton",
  "evm",
  "bsc",
];

export const DEFAULT_CHAIN: ChainId = "solana";

export const DEFAULT_NETWORK: NetworkKey =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as NetworkKey) || "testnet";

export const NETWORK_LABEL: Record<NetworkKey, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
};

export function networkSpec(chain: ChainId, network: NetworkKey): NetworkSpec {
  return CHAIN_CONFIGS[chain][network];
}

/** Placeholder for chains we plan to add when the corresponding WDK
 *  wallet modules land on npm. Surfaced in the chain selector as a
 *  disabled "Coming soon" entry. */
export const COMING_SOON_CHAINS: Array<{
  label: string;
  shortLabel: string;
  logo: string;
  note: string;
}> = [
  {
    label: "Bitcoin",
    shortLabel: "BTC",
    logo: `${TRUSTWALLET}/bitcoin/info/logo.png`,
    note: "Awaiting @tetherto/wdk-wallet-bitcoin",
  },
  {
    label: "Polygon",
    shortLabel: "MATIC",
    logo: `${TRUSTWALLET}/polygon/info/logo.png`,
    note: "EVM module ready — RPC config pending",
  },
];
