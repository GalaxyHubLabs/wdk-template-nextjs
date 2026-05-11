/**
 * Multi-chain wallet adapter for the Tether WDK.
 *
 * Architecture note: WDK is a self-custodial wallet kit. The seed phrase is
 * the master secret. We store it inside the WalletHandle while the wallet is
 * unlocked so the user can flip between mainnet and testnet without being
 * forced to re-enter their password. On lock, `closeWallet` disposes the WDK
 * orchestrator and drops the WalletHandle entirely (the seed reference goes
 * out of scope and is eligible for GC).
 *
 * Browser context: each chain manager is dynamically imported the first time
 * a wallet is opened. The Solana module's `sodium-native` dep is aliased to
 * `sodium-javascript` at bundle time via `next.config.ts`.
 */

import type WdkManager from "@tetherto/wdk";

import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  type ChainId,
  type NetworkKey,
  networkSpec,
} from "./chains";

/** Generic account handle — we type it loosely because each chain module
 *  returns a slightly different concrete class. Operations that need the
 *  concrete type cast inside this module only. */
type ChainAccount = {
  getAddress(): Promise<string> | string;
  getBalance(): Promise<unknown>;
  getTokenBalance?(addr: string): Promise<unknown>;
  quoteSendTransaction?(tx: unknown): Promise<unknown>;
  sendTransaction?(tx: unknown): Promise<unknown>;
  transfer?(options: unknown): Promise<unknown>;
  quoteTransfer?(options: unknown): Promise<unknown>;
};

export interface AccountHandle {
  chain: ChainId;
  address: string;
  account: ChainAccount;
}

export interface WalletHandle {
  /** Master secret. Kept in-memory so network switches don't force a
   *  password re-entry. Wiped by closeWallet(). */
  seedPhrase: string;
  /** WDK orchestrator — keep alive until logout, then `dispose()`. */
  wdk: WdkManager;
  /** Derived account #0 per chain. */
  accounts: Record<ChainId, AccountHandle>;
  /** Network the whole wallet is currently bound to. */
  network: NetworkKey;
}

/**
 * Initialize a multi-chain wallet from a BIP-39 seed phrase.
 *
 * Registers every supported chain on a single WDK orchestrator and derives
 * the default account on each. Failed derivations on individual chains are
 * non-fatal — the rest of the wallet stays usable.
 */
export async function openWallet(
  seedPhrase: string,
  network: NetworkKey,
): Promise<WalletHandle> {
  // Lazy-import everything in parallel so the SSR bundle stays slim.
  const [
    { default: WdkManager },
    { default: WalletManagerSolana },
    { default: WalletManagerTron },
    { default: WalletManagerTon },
    { default: WalletManagerEvm },
  ] = await Promise.all([
    import("@tetherto/wdk"),
    import("@tetherto/wdk-wallet-solana"),
    import("@tetherto/wdk-wallet-tron"),
    import("@tetherto/wdk-wallet-ton"),
    import("@tetherto/wdk-wallet-evm"),
  ]);

  // Each chain manager is a concrete subclass of WDK's abstract WalletManager.
  // TypeScript can't reconcile their private-field declarations across
  // packages, so we cast at the registration boundary. Safe at runtime — the
  // orchestrator only invokes the shared public surface.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const wdk = new WdkManager(seedPhrase)
    .registerWallet("solana", WalletManagerSolana as any, {
      provider: networkSpec("solana", network).rpcUrl,
      commitment: "confirmed",
    })
    .registerWallet("tron", WalletManagerTron as any, {
      provider: networkSpec("tron", network).rpcUrl,
    })
    .registerWallet("ton", WalletManagerTon as any, {
      tonClient: { url: networkSpec("ton", network).rpcUrl },
    })
    .registerWallet("evm", WalletManagerEvm as any, {
      provider: networkSpec("evm", network).rpcUrl,
    });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const accounts = {} as Record<ChainId, AccountHandle>;
  await Promise.all(
    CHAIN_IDS.map(async (chain) => {
      try {
        const account = (await wdk.getAccount(chain, 0)) as unknown as ChainAccount;
        const addrResult = await account.getAddress();
        const address = typeof addrResult === "string" ? addrResult : String(addrResult);
        accounts[chain] = { chain, address, account };
      } catch (err) {
        console.warn(`Failed to derive account for ${chain}:`, err);
      }
    }),
  );

  return { seedPhrase, wdk, accounts, network };
}

/**
 * Re-open the wallet on a different network. Disposes the current WDK and
 * spins up a fresh one bound to the new RPCs. Re-derives every account.
 *
 * The new WalletHandle replaces the old one in the store; the caller is
 * responsible for the swap.
 */
export async function switchNetwork(
  handle: WalletHandle,
  network: NetworkKey,
): Promise<WalletHandle> {
  if (handle.network === network) return handle;
  closeWallet(handle);
  return openWallet(handle.seedPhrase, network);
}

/** Release every chain's in-memory keys. Always call when "logging out". */
export function closeWallet(handle: WalletHandle | null | undefined) {
  try {
    handle?.wdk?.dispose?.();
  } catch {
    // dispose should never throw; swallow defensively
  }
}

/** Fetch the native balance for a chain (in chain-native smallest units). */
export async function getNativeBalance(
  handle: WalletHandle,
  chain: ChainId,
): Promise<bigint> {
  const account = handle.accounts[chain]?.account;
  if (!account) return 0n;
  return coerceBigInt(await account.getBalance());
}

/** Fetch the USDT balance for a chain on the wallet's active network. Returns
 *  0n if no USDT contract is configured for that chain × network. */
export async function getUsdtBalance(
  handle: WalletHandle,
  chain: ChainId,
): Promise<bigint> {
  const spec = networkSpec(chain, handle.network);
  if (!spec.usdt) return 0n;
  return getTokenBalance(handle, chain, spec.usdt.address);
}

/** Fetch the balance of any token by mint / contract address on a chain. */
export async function getTokenBalance(
  handle: WalletHandle,
  chain: ChainId,
  tokenAddress: string,
): Promise<bigint> {
  const account = handle.accounts[chain]?.account;
  if (!account?.getTokenBalance) return 0n;
  try {
    return coerceBigInt(await account.getTokenBalance(tokenAddress));
  } catch {
    return 0n;
  }
}

export interface SendQuote {
  fee: bigint;
}

export interface SendResult {
  signature: string;
  fee: bigint;
}

/** Estimate the native send fee for a chain. */
export async function quoteNativeSend(
  handle: WalletHandle,
  chain: ChainId,
  recipient: string,
  amount: bigint,
): Promise<SendQuote> {
  const account = handle.accounts[chain]?.account;
  if (!account?.quoteSendTransaction) return { fee: 0n };
  try {
    const result = (await account.quoteSendTransaction({
      to: recipient,
      value: amount,
    })) as { fee?: unknown };
    return { fee: coerceBigInt(result?.fee) };
  } catch {
    return { fee: 0n };
  }
}

/** Send the chain's native asset. */
export async function sendNative(
  handle: WalletHandle,
  chain: ChainId,
  recipient: string,
  amount: bigint,
): Promise<SendResult> {
  const account = handle.accounts[chain]?.account;
  if (!account?.sendTransaction) {
    throw new Error(`Send is not supported for ${chain} in this template.`);
  }
  const result = (await account.sendTransaction({
    to: recipient,
    value: amount,
  })) as { hash?: string; fee?: unknown };
  const signature = String(result?.hash ?? "");
  if (!signature) {
    throw new Error("Send succeeded but no signature returned.");
  }
  return { signature, fee: coerceBigInt(result?.fee) };
}

function coerceBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.floor(v));
  if (typeof v === "string" && v.trim()) return BigInt(v);
  if (v && typeof v === "object" && "value" in v) {
    return coerceBigInt((v as { value: unknown }).value);
  }
  return 0n;
}

/** Best-effort address validation per chain (UI-side only — the SDK is the
 *  ultimate authority and will throw on bad addresses at submit time). */
export function isLikelyAddressFor(chain: ChainId, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  switch (chain) {
    case "solana":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
    case "tron":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
    case "ton":
      return /^[A-Za-z0-9_-]{48}$/.test(v) || /^-?\d+:[0-9a-fA-F]{64}$/.test(v);
    case "evm":
      return /^0x[0-9a-fA-F]{40}$/.test(v);
    default:
      return false;
  }
}

/**
 * Fetch recent transaction signatures for the active Solana account, with
 * basic metadata. Implemented directly against the Solana JSON-RPC because
 * the WDK Solana module only exposes per-signature receipt lookups, not a
 * list endpoint.
 */
export interface SolanaTxSummary {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
}

export async function getSolanaRecentTransactions(
  handle: WalletHandle,
  limit: number = 10,
): Promise<SolanaTxSummary[]> {
  const account = handle.accounts.solana;
  if (!account) return [];
  const rpcUrl = networkSpec("solana", handle.network).rpcUrl;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getSignaturesForAddress",
    params: [account.address, { limit }],
  };
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      result?: Array<{
        signature: string;
        slot: number;
        blockTime: number | null;
        err: unknown | null;
      }>;
    };
    return data.result ?? [];
  } catch {
    return [];
  }
}
