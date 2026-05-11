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
  /** Signs an arbitrary message. Uniform across every chain — Solana
   *  signs a 32-byte Ed25519 sig hex-encoded, EVM emits an EIP-191
   *  signature, TRON its TIP-712 personal signature, TON its
   *  Ed25519 over the message bytes. WDK abstracts the differences. */
  sign?(message: string): Promise<string>;
  /** EVM-only: set an ERC-20 allowance. WDK throws if you try to
   *  modify a non-zero USDT-on-Ethereum allowance without zeroing
   *  first, which matches the well-known on-chain quirk. */
  approve?(options: {
    token: string;
    spender: string;
    amount: number | bigint;
  }): Promise<unknown>;
};

export interface AccountHandle {
  chain: ChainId;
  address: string;
  account: ChainAccount;
}

export interface WalletHandle {
  /** Master secret. Kept in-memory so network/account switches don't
   *  force a password re-entry. Wiped by closeWallet(). */
  seedPhrase: string;
  /** WDK orchestrator — keep alive until logout, then `dispose()`. */
  wdk: WdkManager;
  /** Currently active account per chain (derived from `accountIndex`). */
  accounts: Record<ChainId, AccountHandle>;
  /** Network the whole wallet is currently bound to. */
  network: NetworkKey;
  /** BIP-44 account index used to derive the current accounts. Same index
   *  applies to every registered chain — matches how Phantom / MetaMask
   *  treat "Account 1 / Account 2" across networks. */
  accountIndex: number;
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
  accountIndex: number = 0,
): Promise<WalletHandle> {
  // Lazy-import everything in parallel so the SSR bundle stays slim.
  const [
    { default: WdkManager },
    { default: WalletManagerSolana },
    { default: WalletManagerTron },
    { default: WalletManagerTon },
    { default: WalletManagerEvm },
    { default: WalletManagerBtc },
  ] = await Promise.all([
    import("@tetherto/wdk"),
    import("@tetherto/wdk-wallet-solana"),
    import("@tetherto/wdk-wallet-tron"),
    import("@tetherto/wdk-wallet-ton"),
    import("@tetherto/wdk-wallet-evm"),
    import("@tetherto/wdk-wallet-btc"),
  ]);

  // Each chain manager is a concrete subclass of WDK's abstract WalletManager.
  // TypeScript can't reconcile their private-field declarations across
  // packages, so we cast at the registration boundary. Safe at runtime — the
  // orchestrator only invokes the shared public surface.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  // WalletManagerEvm is reused for every EVM-compatible chain — we register
  // it once per chain id with the corresponding RPC. The orchestrator keeps
  // them as independent wallets so balances and signing stay scoped.
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
    })
    .registerWallet("bsc", WalletManagerEvm as any, {
      provider: networkSpec("bsc", network).rpcUrl,
    })
    // L2 EVM-compatible chains. WDK's EVM module is intentionally chain-id
    // agnostic — every entry below reuses the same WalletManagerEvm with
    // its own RPC, demonstrating the WDK pattern of one module powering
    // many networks. Tether's canonical USDT deployment is configured per
    // chain in `lib/chains.ts`.
    .registerWallet("polygon", WalletManagerEvm as any, {
      provider: networkSpec("polygon", network).rpcUrl,
    })
    .registerWallet("arbitrum", WalletManagerEvm as any, {
      provider: networkSpec("arbitrum", network).rpcUrl,
    })
    .registerWallet("base", WalletManagerEvm as any, {
      provider: networkSpec("base", network).rpcUrl,
    })
    .registerWallet("optimism", WalletManagerEvm as any, {
      provider: networkSpec("optimism", network).rpcUrl,
    })
    // Bitcoin — different transport layer (Blockbook REST over HTTPS,
    // CORS-friendly out of the box from Trezor's public nodes) and
    // different account model (UTXO, no smart contracts, no token
    // surface). The WDK module abstracts both behind the same
    // `account.transfer` / `getBalance` contract, so the rest of the
    // wallet treats it like any other chain.
    .registerWallet("btc", WalletManagerBtc as any, {
      network: network === "mainnet" ? "bitcoin" : "testnet",
      // BIP-84 P2WPKH (native SegWit) — modern default, smaller fees
      // than legacy P2PKH. Users importing pre-SegWit keys can flip
      // this to 44 if needed.
      bip: 84,
      client: {
        type: "blockbook",
        clientConfig: { url: networkSpec("btc", network).rpcUrl },
      },
    });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const accounts = await deriveAllChains(wdk, accountIndex);
  return { seedPhrase, wdk, accounts, network, accountIndex };
}

async function deriveAllChains(
  wdk: WdkManager,
  accountIndex: number,
): Promise<Record<ChainId, AccountHandle>> {
  const accounts = {} as Record<ChainId, AccountHandle>;
  await Promise.all(
    CHAIN_IDS.map(async (chain) => {
      try {
        const account = (await wdk.getAccount(
          chain,
          accountIndex,
        )) as unknown as ChainAccount;
        const addrResult = await account.getAddress();
        const address = typeof addrResult === "string" ? addrResult : String(addrResult);
        accounts[chain] = { chain, address, account };
      } catch (err) {
        console.warn(`Failed to derive account for ${chain}:`, err);
      }
    }),
  );
  return accounts;
}

/**
 * Re-derive every chain's account at a new BIP-44 index, leaving the WDK
 * orchestrator (and therefore the registered RPCs) intact. Cheaper than a
 * full openWallet because we don't spin up a new WDK instance.
 */
export async function setAccountIndex(
  handle: WalletHandle,
  accountIndex: number,
): Promise<WalletHandle> {
  if (accountIndex === handle.accountIndex) return handle;
  const accounts = await deriveAllChains(handle.wdk, accountIndex);
  return { ...handle, accounts, accountIndex };
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

/** Fetch every canonical Tether token balance for a chain on the active
 *  network. Returns an empty object when no tokens are configured. */
export async function getTetherTokenBalances(
  handle: WalletHandle,
  chain: ChainId,
): Promise<Record<string, bigint>> {
  const spec = networkSpec(chain, handle.network);
  if (spec.tetherTokens.length === 0) return {};
  const entries = await Promise.all(
    spec.tetherTokens.map(async (t) => {
      const bal = await getTokenBalance(handle, chain, t.address).catch(
        () => 0n,
      );
      return [t.address, bal] as const;
    }),
  );
  return Object.fromEntries(entries);
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

/**
 * Estimate the fee for transferring an arbitrary token (USDT, XAUt, or
 * any token whose contract address the caller provides). All chains
 * expose the same `quoteTransfer({ token, recipient, amount })` surface
 * via WDK's IWalletAccountReadOnly contract — this helper unifies the
 * call so the send UI doesn't need to branch per chain.
 */
export async function quoteTokenSend(
  handle: WalletHandle,
  chain: ChainId,
  tokenAddress: string,
  recipient: string,
  amount: bigint,
): Promise<SendQuote> {
  const account = handle.accounts[chain]?.account;
  if (!account?.quoteTransfer) return { fee: 0n };
  try {
    const result = (await account.quoteTransfer({
      token: tokenAddress,
      recipient,
      amount,
    })) as { fee?: unknown };
    return { fee: coerceBigInt(result?.fee) };
  } catch {
    return { fee: 0n };
  }
}

/**
 * Transfer an arbitrary token. The WDK token-transfer surface is
 * uniform across every chain we support (SPL on Solana, TRC-20 on
 * TRON, jettons on TON, ERC-20 on every EVM): each WalletAccount
 * exposes a `transfer({ token, recipient, amount })` method that
 * returns a hash. Failures are wrapped in a descriptive Error so the
 * send UI can surface them verbatim.
 */
export async function sendToken(
  handle: WalletHandle,
  chain: ChainId,
  tokenAddress: string,
  recipient: string,
  amount: bigint,
): Promise<SendResult> {
  const account = handle.accounts[chain]?.account;
  if (!account?.transfer) {
    throw new Error(`Token transfers are not supported for ${chain} yet.`);
  }
  const result = (await account.transfer({
    token: tokenAddress,
    recipient,
    amount,
  })) as { hash?: string; fee?: unknown };
  const signature = String(result?.hash ?? "");
  if (!signature) {
    throw new Error("Transfer succeeded but no signature returned.");
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
    case "bsc":
    case "polygon":
    case "arbitrum":
    case "base":
    case "optimism":
      return /^0x[0-9a-fA-F]{40}$/.test(v);
    case "btc":
      // Cover the three address families: P2PKH (legacy, starts with
      // 1 / m / n), P2SH (3 / 2), and bech32 P2WPKH/P2WSH/Taproot
      // (bc1 / tb1). The regex is permissive on length within each
      // family — the WDK module's address parser is the final word.
      return (
        /^[13mn2][a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(v) ||
        /^(bc1|tb1)[02-9ac-hj-np-z]{8,87}$/i.test(v)
      );
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

/**
 * EVM transaction summary — shared shape across Ethereum, BSC, Polygon,
 * Arbitrum, Base, and Optimism. Etherscan-family APIs return identical
 * payloads on each chain, so one parser handles them all.
 */
export interface EvmTxSummary {
  hash: string;
  blockNumber: number;
  blockTime: number | null;
  /** Hex address. Lower-cased for display consistency. */
  from: string;
  to: string;
  /** Native value in chain-smallest units (wei). */
  value: bigint;
  /** True when the receipt status was 0. */
  failed: boolean;
}

/**
 * Recent native transactions for an EVM-family account.
 *
 * Uses each chain's Etherscan-family API. The free endpoint without
 * an API key tops out around 5 requests/second per IP, which is
 * plenty for a wallet's "Activity" page. Returns an empty array on
 * any network error rather than throwing — the UI surfaces "View on
 * explorer" as a recovery path.
 */
export async function getEvmRecentTransactions(
  handle: WalletHandle,
  chain: ChainId,
  limit: number = 15,
): Promise<EvmTxSummary[]> {
  const account = handle.accounts[chain];
  if (!account) return [];
  const endpoint = etherscanEndpoint(chain, handle.network);
  if (!endpoint) return [];
  const url = `${endpoint}?module=account&action=txlist&address=${account.address}&page=1&offset=${limit}&sort=desc`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status?: string;
      result?: Array<{
        hash: string;
        blockNumber: string;
        timeStamp: string;
        from: string;
        to: string;
        value: string;
        isError: string;
        txreceipt_status?: string;
      }>;
    };
    // Etherscan returns status "0" with result === "No transactions found"
    // for empty accounts — return [] in that case.
    if (data.status !== "1" || !Array.isArray(data.result)) return [];
    return data.result.map((tx) => ({
      hash: tx.hash,
      blockNumber: Number(tx.blockNumber),
      blockTime: tx.timeStamp ? Number(tx.timeStamp) : null,
      from: tx.from.toLowerCase(),
      to: (tx.to ?? "").toLowerCase(),
      value: safeBigInt(tx.value),
      failed: tx.isError === "1" || tx.txreceipt_status === "0",
    }));
  } catch {
    return [];
  }
}

/** Map a chain × network pair to its Etherscan-family v2 base URL.
 *  Returns null for chains where no public scanner API is configured. */
function etherscanEndpoint(chain: ChainId, network: NetworkKey): string | null {
  if (network === "mainnet") {
    switch (chain) {
      case "evm":
        return "https://api.etherscan.io/api";
      case "bsc":
        return "https://api.bscscan.com/api";
      case "polygon":
        return "https://api.polygonscan.com/api";
      case "arbitrum":
        return "https://api.arbiscan.io/api";
      case "base":
        return "https://api.basescan.org/api";
      case "optimism":
        return "https://api-optimistic.etherscan.io/api";
      default:
        return null;
    }
  }
  switch (chain) {
    case "evm":
      return "https://api-sepolia.etherscan.io/api";
    case "bsc":
      return "https://api-testnet.bscscan.com/api";
    case "polygon":
      return "https://api-amoy.polygonscan.com/api";
    case "arbitrum":
      return "https://api-sepolia.arbiscan.io/api";
    case "base":
      return "https://api-sepolia.basescan.org/api";
    case "optimism":
      return "https://api-sepolia-optimistic.etherscan.io/api";
    default:
      return null;
  }
}

/**
 * Sign an arbitrary UTF-8 message with the active account on a chain.
 *
 * Every WDK wallet module exposes a uniform `sign(message: string)`
 * method, so a single dispatcher handles Solana, TRON, TON, and every
 * EVM chain. The signature format depends on the chain — callers
 * should treat the return value as opaque and pass it to whichever
 * verifier they're talking to.
 *
 * Typical use cases:
 *   - "Sign in with Ethereum" dApp authentication flows.
 *   - Proving address ownership to a backend (e.g. claiming an
 *     account on an off-chain service).
 *   - Lightweight attestations from an AI agent driving the wallet.
 */
/**
 * Set an ERC-20 token's allowance for a spender. The wallet UI uses
 * this with `amount: 0n` to revoke standing approvals from the
 * Approvals page. Setting a non-zero allowance is also valid for the
 * usual "approve a DEX router" flow, but the template doesn't yet
 * expose a UI for that — agents driving the wallet may use it
 * directly via `lib/wdk-client.ts` though.
 *
 * Only EVM-family chains support this. Throws on every other chain
 * so the caller can surface a clear error.
 */
export async function setApproval(
  handle: WalletHandle,
  chain: ChainId,
  options: { token: string; spender: string; amount: bigint },
): Promise<SendResult> {
  const account = handle.accounts[chain]?.account;
  if (!account?.approve) {
    throw new Error(`Token approvals are not supported for ${chain}.`);
  }
  const result = (await account.approve({
    token: options.token,
    spender: options.spender,
    amount: options.amount,
  })) as { hash?: string; fee?: unknown };
  const signature = String(result?.hash ?? "");
  if (!signature) {
    throw new Error("Approval succeeded but no signature returned.");
  }
  return { signature, fee: coerceBigInt(result?.fee) };
}

// ─── Velora swap (EVM family) ─────────────────────────────────────────

export type SwapDirection = "sell" | "buy";

export interface SwapQuote {
  /** Amount sold in tokenIn-smallest units. Identical to the input
   *  when the user picked a "sell exactly" trade, derived when they
   *  picked a "buy exactly" trade. */
  tokenInAmount: bigint;
  /** Amount received in tokenOut-smallest units. */
  tokenOutAmount: bigint;
  /** Native-asset gas cost for the swap. */
  fee: bigint;
}

export interface SwapResult extends SwapQuote {
  /** Transaction hash on the underlying chain. */
  signature: string;
}

/** Chains the Velora swap protocol can target through this template.
 *  Mirrors the EVM-family check in `chainSupportsApprovals`. */
function chainSupportsSwap(chain: ChainId): boolean {
  return (
    chain === "evm" ||
    chain === "bsc" ||
    chain === "polygon" ||
    chain === "arbitrum" ||
    chain === "base" ||
    chain === "optimism"
  );
}

export function isSwapSupported(chain: ChainId): boolean {
  return chainSupportsSwap(chain);
}

/**
 * Quote the cost of swapping `tokenInAmount` of `tokenIn` for `tokenOut`
 * (sell mode), or the cost of acquiring `tokenOutAmount` of `tokenOut`
 * paying `tokenIn` (buy mode). Uses Tether's WDK Velora protocol
 * module — the same SDK that drives the wallet's transfer surface,
 * just configured for swap.
 */
export async function quoteSwap(
  handle: WalletHandle,
  chain: ChainId,
  options: {
    tokenIn: string;
    tokenOut: string;
    amount: bigint;
    direction: SwapDirection;
  },
): Promise<SwapQuote> {
  if (!chainSupportsSwap(chain)) {
    throw new Error(`Swap is only available on EVM chains in this template.`);
  }
  const account = handle.accounts[chain]?.account;
  if (!account) throw new Error(`No ${chain} account derived.`);
  const { default: VeloraProtocolEvm } = await import(
    "@tetherto/wdk-protocol-swap-velora-evm"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const protocol = new (VeloraProtocolEvm as any)(account);
  const opts =
    options.direction === "sell"
      ? {
          tokenIn: options.tokenIn,
          tokenOut: options.tokenOut,
          tokenInAmount: options.amount,
        }
      : {
          tokenIn: options.tokenIn,
          tokenOut: options.tokenOut,
          tokenOutAmount: options.amount,
        };
  const result = (await protocol.quoteSwap(opts)) as {
    fee?: unknown;
    tokenInAmount?: unknown;
    tokenOutAmount?: unknown;
  };
  return {
    fee: coerceBigInt(result?.fee),
    tokenInAmount: coerceBigInt(result?.tokenInAmount),
    tokenOutAmount: coerceBigInt(result?.tokenOutAmount),
  };
}

/**
 * Execute the swap. The caller is expected to have already approved
 * the input token's allowance to the Velora router via the existing
 * `setApproval(...)` helper — Velora rejects unapproved tokenIn at
 * the protocol level, and we don't try to bundle the approval into
 * the swap call here because gas estimation is cleaner when they
 * stay separate.
 */
export async function executeSwap(
  handle: WalletHandle,
  chain: ChainId,
  options: {
    tokenIn: string;
    tokenOut: string;
    amount: bigint;
    direction: SwapDirection;
  },
): Promise<SwapResult> {
  if (!chainSupportsSwap(chain)) {
    throw new Error(`Swap is only available on EVM chains in this template.`);
  }
  const account = handle.accounts[chain]?.account;
  if (!account) throw new Error(`No ${chain} account derived.`);
  const { default: VeloraProtocolEvm } = await import(
    "@tetherto/wdk-protocol-swap-velora-evm"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const protocol = new (VeloraProtocolEvm as any)(account);
  const opts =
    options.direction === "sell"
      ? {
          tokenIn: options.tokenIn,
          tokenOut: options.tokenOut,
          tokenInAmount: options.amount,
        }
      : {
          tokenIn: options.tokenIn,
          tokenOut: options.tokenOut,
          tokenOutAmount: options.amount,
        };
  const result = (await protocol.swap(opts)) as {
    hash?: string;
    fee?: unknown;
    tokenInAmount?: unknown;
    tokenOutAmount?: unknown;
  };
  const signature = String(result?.hash ?? "");
  if (!signature) {
    throw new Error("Swap succeeded but no transaction hash returned.");
  }
  return {
    signature,
    fee: coerceBigInt(result?.fee),
    tokenInAmount: coerceBigInt(result?.tokenInAmount),
    tokenOutAmount: coerceBigInt(result?.tokenOutAmount),
  };
}

export async function signMessage(
  handle: WalletHandle,
  chain: ChainId,
  message: string,
): Promise<string> {
  const account = handle.accounts[chain]?.account;
  if (!account?.sign) {
    throw new Error(`Message signing is not supported for ${chain}.`);
  }
  return await account.sign(message);
}

function safeBigInt(v: string): bigint {
  try {
    return BigInt(v || "0");
  } catch {
    return 0n;
  }
}
