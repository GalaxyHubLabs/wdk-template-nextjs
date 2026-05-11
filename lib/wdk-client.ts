/**
 * Multi-chain wallet adapter for the Tether WDK.
 *
 * Architecture note: WDK is a self-custodial wallet kit. The seed phrase is
 * the master secret. This module is the ONLY place that touches the seed in
 * cleartext form — every other module operates on a `WalletHandle` (which
 * carries one derived account per chain) and never sees the raw secret.
 *
 * Browser context: every chain module is dynamically imported inside
 * `openWallet()` so heavyweight crypto stays out of the SSR bundle. The
 * `next.config.ts` aliases swap the Solana module's `sodium-native` dep for
 * the pure-JS `sodium-javascript` build at bundle time.
 */

import type WdkManager from "@tetherto/wdk";

import { CHAIN_CONFIGS, CHAIN_IDS, type ChainId } from "./chains";

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
  /** WDK orchestrator — keep alive until logout, then `dispose()`. */
  wdk: WdkManager;
  /** Derived account #0 per chain. */
  accounts: Record<ChainId, AccountHandle>;
}

/**
 * Initialize a multi-chain wallet from a BIP-39 seed phrase.
 *
 * Registers every supported chain on the WDK orchestrator and derives the
 * default account on each. The caller should let the cleartext seed go out
 * of scope immediately after this returns.
 */
export async function openWallet(seedPhrase: string): Promise<WalletHandle> {
  // Lazy-import everything so the SSR bundle stays slim. We do them in
  // parallel because they have no shared mutable state at import time.
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
  // TypeScript can't reconcile their private-field declarations across packages,
  // so we cast at the registration boundary. Safe at runtime — these are all
  // genuine WalletManager subclasses, and the orchestrator only invokes the
  // shared public surface.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const wdk = new WdkManager(seedPhrase)
    .registerWallet("solana", WalletManagerSolana as any, {
      provider: CHAIN_CONFIGS.solana.rpcUrl,
      commitment: "confirmed",
    })
    .registerWallet("tron", WalletManagerTron as any, {
      provider: CHAIN_CONFIGS.tron.rpcUrl,
    })
    .registerWallet("ton", WalletManagerTon as any, {
      tonClient: { url: CHAIN_CONFIGS.ton.rpcUrl },
    })
    .registerWallet("evm", WalletManagerEvm as any, {
      provider: CHAIN_CONFIGS.evm.rpcUrl,
    });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Derive account #0 on every chain in parallel. If one chain's RPC is
  // momentarily flaky we still want addresses for the others — fail-soft.
  const accounts = {} as Record<ChainId, AccountHandle>;
  await Promise.all(
    CHAIN_IDS.map(async (chain) => {
      try {
        const account = (await wdk.getAccount(chain, 0)) as unknown as ChainAccount;
        const addrResult = await account.getAddress();
        const address = typeof addrResult === "string" ? addrResult : String(addrResult);
        accounts[chain] = { chain, address, account };
      } catch (err) {
        // Surface the failure but don't tear the whole wallet down — the
        // user can still operate on the chains that succeeded.
        console.warn(`Failed to derive account for ${chain}:`, err);
      }
    }),
  );

  return { wdk, accounts };
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

/** Fetch the USDT balance for a chain (returns 0n if no USDT config on this network). */
export async function getUsdtBalance(
  handle: WalletHandle,
  chain: ChainId,
): Promise<bigint> {
  const cfg = CHAIN_CONFIGS[chain];
  if (!cfg.usdt) return 0n;
  const account = handle.accounts[chain]?.account;
  if (!account?.getTokenBalance) return 0n;
  try {
    return coerceBigInt(await account.getTokenBalance(cfg.usdt.address));
  } catch {
    return 0n;
  }
}

export interface SendQuote {
  /** Native fee in the chain's smallest unit. */
  fee: bigint;
}

export interface SendResult {
  signature: string;
  fee: bigint;
}

/**
 * Estimate the fee for sending the chain's native asset to `recipient`.
 * Only Solana exposes a stable `quoteSendTransaction` in WDK beta today;
 * other chains return a 0 quote and we let the user proceed.
 */
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
    // Quote endpoints can be flaky on testnets — fall through to a zero
    // estimate rather than blocking the send flow.
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
      // base58, 32-44 chars
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
    case "tron":
      // base58, always starts with T, 34 chars
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
    case "ton":
      // Either user-friendly (48 chars base64url-ish) or raw (0:hex...)
      return /^[A-Za-z0-9_-]{48}$/.test(v) || /^-?\d+:[0-9a-fA-F]{64}$/.test(v);
    case "evm":
      // 0x-prefixed 20-byte hex
      return /^0x[0-9a-fA-F]{40}$/.test(v);
    default:
      return false;
  }
}
