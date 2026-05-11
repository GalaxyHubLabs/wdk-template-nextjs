/**
 * Thin wrappers around `@tetherto/wdk` and `@tetherto/wdk-wallet-solana`.
 *
 * Architecture note: WDK is a self-custodial wallet kit. The seed phrase is
 * the master secret. This module is the ONLY place that touches the seed in
 * cleartext form — everything else operates through derived account handles.
 *
 * Browser context: WDK's Solana module uses `@solana/*` v3 (browser-safe),
 * `bip39`, and `sodium-universal`. The sodium pivot to `sodium-javascript`
 * for the browser is wired in `next.config.ts`. WDK is dynamically imported
 * inside functions so the module never loads during server-side rendering.
 */

import type {
  default as WalletManagerSolanaT,
  WalletAccountSolana,
} from "@tetherto/wdk-wallet-solana";

import { NETWORKS, type NetworkId } from "./networks";

export interface WalletHandle {
  manager: InstanceType<typeof WalletManagerSolanaT>;
  account: WalletAccountSolana;
  /** Public Solana address (base58). */
  address: string;
  /** Which network this handle is bound to. */
  network: NetworkId;
}

/**
 * Initialize a Solana wallet from a BIP-39 seed phrase.
 *
 * NEVER pass the seed phrase to anything that logs, serializes to disk, or
 * crosses a network boundary. Callers should pass the seed in, get the
 * `WalletHandle`, and immediately let the cleartext seed go out of scope.
 *
 * Lazy-imports WDK so the module is excluded from SSR bundles.
 */
export async function openWallet(
  seedPhrase: string,
  networkId: NetworkId,
  accountIndex = 0,
): Promise<WalletHandle> {
  const net = NETWORKS[networkId];
  if (!net) throw new Error(`Unknown network: ${networkId}`);

  const { default: WalletManagerSolana } = await import(
    "@tetherto/wdk-wallet-solana"
  );

  const manager = new WalletManagerSolana(seedPhrase, {
    provider: net.rpcUrl,
    commitment: "confirmed",
  });

  const account = await manager.getAccount(accountIndex);
  const address = await account.getAddress();

  return { manager, account, address, network: networkId };
}

/** Release the wallet's in-memory keys. Always call when "logging out". */
export function closeWallet(handle: WalletHandle | null | undefined) {
  try {
    handle?.manager?.dispose?.();
  } catch {
    // dispose should never throw; swallow defensively
  }
}

/** Fetch native SOL balance (in lamports, as bigint). */
export async function getNativeBalance(handle: WalletHandle): Promise<bigint> {
  const raw = await handle.account.getBalance();
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(Math.floor(raw));
  if (typeof raw === "string") return BigInt(raw);
  if (raw && typeof raw === "object" && "value" in raw) {
    const v = (raw as { value: unknown }).value;
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.floor(v));
    if (typeof v === "string") return BigInt(v);
  }
  return 0n;
}
