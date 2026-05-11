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

export type ChainId =
  | "solana"
  | "tron"
  | "ton"
  | "evm"
  | "bsc"
  | "polygon"
  | "arbitrum"
  | "base"
  | "optimism"
  | "btc";
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
  /** Public faucet URL for this network (testnets only — null on mainnet). */
  faucetUrl?: string;
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
    | "binancecoin"
    | "matic-network"
    | "bitcoin";
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
      faucetUrl: "https://faucet.solana.com/",
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
      faucetUrl: "https://shasta.tronex.io/",
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
      faucetUrl: "https://t.me/testgiver_ton_bot",
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
      faucetUrl: "https://www.alchemy.com/faucets/ethereum-sepolia",
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
      faucetUrl: "https://testnet.bnbchain.org/faucet-smart",
      tetherTokens: envToken("NEXT_PUBLIC_BSC_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 18,
        name: "Tether USD (BSC testnet)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  polygon: {
    id: "polygon",
    label: "Polygon",
    shortLabel: "MATIC",
    nativeSymbol: "MATIC",
    nativeName: "Polygon",
    nativeDecimals: 18,
    logo: `${TRUSTWALLET}/polygon/info/logo.png`,
    nativePriceId: "matic-network",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_POLYGON_RPC_MAINNET",
        "https://polygon-rpc.com",
      ),
      txExplorer: (sig) => `https://polygonscan.com/tx/${sig}`,
      addressExplorer: (addr) => `https://polygonscan.com/address/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          // Native Tether deployment on Polygon (PoS). Source: Tether docs.
          address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
      ],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_POLYGON_RPC_TESTNET",
        "https://rpc-amoy.polygon.technology",
      ),
      txExplorer: (sig) => `https://amoy.polygonscan.com/tx/${sig}`,
      addressExplorer: (addr) => `https://amoy.polygonscan.com/address/${addr}`,
      faucetUrl: "https://www.alchemy.com/faucets/polygon-amoy",
      tetherTokens: envToken("NEXT_PUBLIC_POLYGON_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (Amoy)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  arbitrum: {
    id: "arbitrum",
    label: "Arbitrum",
    shortLabel: "ARB",
    nativeSymbol: "ETH",
    nativeName: "Ether on Arbitrum",
    nativeDecimals: 18,
    logo: `${TRUSTWALLET}/arbitrum/info/logo.png`,
    nativePriceId: "ethereum",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_ARBITRUM_RPC_MAINNET",
        "https://arb1.arbitrum.io/rpc",
      ),
      txExplorer: (sig) => `https://arbiscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://arbiscan.io/address/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          // Native Tether deployment on Arbitrum One.
          address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
      ],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_ARBITRUM_RPC_TESTNET",
        "https://sepolia-rollup.arbitrum.io/rpc",
      ),
      txExplorer: (sig) => `https://sepolia.arbiscan.io/tx/${sig}`,
      addressExplorer: (addr) => `https://sepolia.arbiscan.io/address/${addr}`,
      faucetUrl: "https://www.alchemy.com/faucets/arbitrum-sepolia",
      tetherTokens: envToken("NEXT_PUBLIC_ARBITRUM_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (Arb Sepolia)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  base: {
    id: "base",
    label: "Base",
    shortLabel: "BASE",
    nativeSymbol: "ETH",
    nativeName: "Ether on Base",
    nativeDecimals: 18,
    logo: `${TRUSTWALLET}/base/info/logo.png`,
    nativePriceId: "ethereum",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_BASE_RPC_MAINNET",
        "https://mainnet.base.org",
      ),
      txExplorer: (sig) => `https://basescan.org/tx/${sig}`,
      addressExplorer: (addr) => `https://basescan.org/address/${addr}`,
      // Tether has not officially deployed USDT to Base at the time of
      // this template's release. Plug in your own address via the env
      // override below if you need it before the canonical deployment
      // ships.
      tetherTokens: envToken("NEXT_PUBLIC_BASE_USDT_MAINNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_BASE_RPC_TESTNET",
        "https://sepolia.base.org",
      ),
      txExplorer: (sig) => `https://sepolia.basescan.org/tx/${sig}`,
      addressExplorer: (addr) => `https://sepolia.basescan.org/address/${addr}`,
      faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
      tetherTokens: envToken("NEXT_PUBLIC_BASE_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (Base Sepolia)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  optimism: {
    id: "optimism",
    label: "Optimism",
    shortLabel: "OP",
    nativeSymbol: "ETH",
    nativeName: "Ether on Optimism",
    nativeDecimals: 18,
    logo: `${TRUSTWALLET}/optimism/info/logo.png`,
    nativePriceId: "ethereum",
    mainnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_OPTIMISM_RPC_MAINNET",
        "https://mainnet.optimism.io",
      ),
      txExplorer: (sig) => `https://optimistic.etherscan.io/tx/${sig}`,
      addressExplorer: (addr) =>
        `https://optimistic.etherscan.io/address/${addr}`,
      tetherTokens: [
        {
          symbol: "USDT",
          // Native Tether deployment on OP mainnet.
          address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
          decimals: 6,
          name: "Tether USD",
          logo: USDT_LOGO,
          priceId: "tether",
        },
      ],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_OPTIMISM_RPC_TESTNET",
        "https://sepolia.optimism.io",
      ),
      txExplorer: (sig) => `https://sepolia-optimism.etherscan.io/tx/${sig}`,
      addressExplorer: (addr) =>
        `https://sepolia-optimism.etherscan.io/address/${addr}`,
      faucetUrl: "https://www.alchemy.com/faucets/optimism-sepolia",
      tetherTokens: envToken("NEXT_PUBLIC_OPTIMISM_USDT_TESTNET", {
        symbol: "USDT",
        decimals: 6,
        name: "Tether USD (OP Sepolia)",
        logo: USDT_LOGO,
        priceId: "tether",
      }),
    },
  },
  btc: {
    id: "btc",
    label: "Bitcoin",
    shortLabel: "BTC",
    nativeSymbol: "BTC",
    nativeName: "Bitcoin",
    // BTC base unit is the satoshi (1 BTC = 1e8 sats).
    nativeDecimals: 8,
    logo: `${TRUSTWALLET}/bitcoin/info/logo.png`,
    nativePriceId: "bitcoin",
    mainnet: {
      // Bitcoin doesn't have a JSON-RPC standard like EVM — we point at
      // a Blockbook REST endpoint (Trezor runs free public nodes) which
      // the @tetherto/wdk-wallet-btc module consumes via its Blockbook
      // client transport. The URL is configurable like every other
      // chain so users can plug in their own indexer in production.
      rpcUrl: envOr(
        "NEXT_PUBLIC_BTC_RPC_MAINNET",
        "https://btc1.trezor.io/api",
      ),
      txExplorer: (sig) => `https://mempool.space/tx/${sig}`,
      addressExplorer: (addr) => `https://mempool.space/address/${addr}`,
      // Bitcoin has no smart-contract tokens — USDT-on-Bitcoin via
      // Omni Layer is being deprecated and isn't worth surfacing in a
      // template. BTC stays native-only here.
      tetherTokens: [],
    },
    testnet: {
      rpcUrl: envOr(
        "NEXT_PUBLIC_BTC_RPC_TESTNET",
        "https://btc-tn1.trezor.io/api",
      ),
      txExplorer: (sig) => `https://mempool.space/testnet/tx/${sig}`,
      addressExplorer: (addr) =>
        `https://mempool.space/testnet/address/${addr}`,
      faucetUrl: "https://coinfaucet.eu/en/btc-testnet/",
      tetherTokens: [],
    },
  },
};

export const CHAIN_IDS: readonly ChainId[] = [
  "solana",
  "tron",
  "ton",
  "evm",
  "bsc",
  "polygon",
  "arbitrum",
  "base",
  "optimism",
  "btc",
];

// Ethereum is the default landing chain — broadest feature coverage
// (every DeFi protocol module ships here first), most recognisable
// asset symbols, and the deepest tooling story for first-time
// reviewers. Users can flip to any other chain with one tap from
// the dashboard picker.
export const DEFAULT_CHAIN: ChainId = "evm";

export const DEFAULT_NETWORK: NetworkKey =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as NetworkKey) || "testnet";

export const NETWORK_LABEL: Record<NetworkKey, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
};

export function networkSpec(chain: ChainId, network: NetworkKey): NetworkSpec {
  const base = CHAIN_CONFIGS[chain][network];
  // Consult the user-set override layer. Defined inline rather than via
  // top-level import to avoid a hard cycle if `rpc-overrides.ts` is ever
  // expanded with logic that imports from this module.
  const override = readRpcOverride(chain, network);
  return override ? { ...base, rpcUrl: override } : base;
}

/** Locally inlined to avoid a circular import. Mirrors
 *  `lib/rpc-overrides.ts::getRpcOverride` exactly. */
function readRpcOverride(chain: ChainId, network: NetworkKey): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("wdk-template:rpc-overrides");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    const v = parsed?.[`${chain}:${network}`];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Placeholder for chains we plan to add when the corresponding WDK
 *  wallet modules land on npm. Surfaced in the chain selector as a
 *  disabled "Coming soon" entry. */
export const COMING_SOON_CHAINS: Array<{
  label: string;
  shortLabel: string;
  logo: string;
  note: string;
}> = [];
