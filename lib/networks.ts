/**
 * Solana network configurations.
 *
 * The default Solana public RPC endpoints have aggressive rate limits. For
 * production usage, swap these with your own provider (Helius, Triton,
 * QuickNode, etc.) via the `NEXT_PUBLIC_SOLANA_RPC_*` env vars.
 */

export type NetworkId = "mainnet" | "devnet" | "testnet";

export interface Network {
  id: NetworkId;
  label: string;
  rpcUrl: string;
  explorerUrl: (signatureOrAddress: string, kind: "tx" | "address") => string;
}

function rpc(envKey: string, fallback: string) {
  // NEXT_PUBLIC_* vars are inlined at build time and safe for client use.
  if (typeof process !== "undefined" && process.env?.[envKey]) {
    return process.env[envKey] as string;
  }
  return fallback;
}

export const NETWORKS: Record<NetworkId, Network> = {
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    rpcUrl: rpc("NEXT_PUBLIC_SOLANA_RPC_MAINNET", "https://api.mainnet-beta.solana.com"),
    explorerUrl: (id, kind) =>
      `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${id}`,
  },
  devnet: {
    id: "devnet",
    label: "Devnet",
    rpcUrl: rpc("NEXT_PUBLIC_SOLANA_RPC_DEVNET", "https://api.devnet.solana.com"),
    explorerUrl: (id, kind) =>
      `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${id}?cluster=devnet`,
  },
  testnet: {
    id: "testnet",
    label: "Testnet",
    rpcUrl: rpc("NEXT_PUBLIC_SOLANA_RPC_TESTNET", "https://api.testnet.solana.com"),
    explorerUrl: (id, kind) =>
      `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${id}?cluster=testnet`,
  },
};

export const DEFAULT_NETWORK: NetworkId = "devnet";
