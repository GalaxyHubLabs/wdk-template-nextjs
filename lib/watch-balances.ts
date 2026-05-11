/**
 * Read-only balance fetchers for arbitrary (chain, address) pairs.
 *
 * Used by watch-only address views, where we have no WalletHandle / WDK
 * account — only an address string. Each fetcher hits the chain's public
 * RPC directly and returns the native balance in smallest units.
 *
 * Why not reuse WDK's wallet manager helpers? Those require a registered
 * wallet (i.e. a seed-derived account). Watch entries by design never go
 * through derivation, so we talk to the RPC at a lower level here.
 *
 * Token balances are fetched per chain when the contract / mint is known.
 * Where the lookup pattern is non-trivial (TRON TRC-20, TON Jettons) we
 * surface a `null` to let the UI show "—" rather than break.
 */

import {
  CHAIN_CONFIGS,
  networkSpec,
  type ChainId,
  type NetworkKey,
  type TetherToken,
} from "./chains";

/** Fetch the chain's native asset balance for any address. */
export async function fetchNativeBalance(
  chain: ChainId,
  network: NetworkKey,
  address: string,
): Promise<bigint> {
  const rpcUrl = networkSpec(chain, network).rpcUrl;
  try {
    switch (chain) {
      case "solana":
        return await fetchSolanaNative(rpcUrl, address);
      case "evm":
      case "bsc":
      case "polygon":
      case "arbitrum":
      case "base":
      case "optimism":
        return await fetchEvmNative(rpcUrl, address);
      case "tron":
        return await fetchTronNative(rpcUrl, address);
      case "ton":
        return await fetchTonNative(rpcUrl, address);
      case "btc":
        return await fetchBtcNative(rpcUrl, address);
      default:
        return 0n;
    }
  } catch {
    return 0n;
  }
}

/** Fetch every canonical Tether token balance for a (chain, network, address).
 *  Returns a map keyed by token contract address. Missing or unsupported
 *  lookups produce `null` rather than 0 so the UI can distinguish "no data"
 *  from "confirmed zero". */
export async function fetchTetherBalances(
  chain: ChainId,
  network: NetworkKey,
  address: string,
): Promise<Record<string, bigint | null>> {
  const tokens = networkSpec(chain, network).tetherTokens;
  if (tokens.length === 0) return {};
  const rpcUrl = networkSpec(chain, network).rpcUrl;
  const entries = await Promise.all(
    tokens.map(async (token) => {
      const bal = await fetchTokenBalance(chain, rpcUrl, address, token).catch(
        () => null,
      );
      return [token.address, bal] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// ─── Per-chain implementations ────────────────────────────────────────────

async function fetchSolanaNative(rpcUrl: string, address: string): Promise<bigint> {
  const res = await jsonRpc(rpcUrl, "getBalance", [address]);
  const lamports = (res as { value?: number })?.value;
  return typeof lamports === "number" ? BigInt(lamports) : 0n;
}

async function fetchEvmNative(rpcUrl: string, address: string): Promise<bigint> {
  const res = await jsonRpc(rpcUrl, "eth_getBalance", [address, "latest"]);
  if (typeof res !== "string") return 0n;
  // res is hex-encoded wei (e.g. "0x1bc16d674ec80000")
  return BigInt(res);
}

async function fetchTronNative(rpcUrl: string, address: string): Promise<bigint> {
  // TronGrid: POST /wallet/getaccount with {address, visible:true}
  const res = await fetch(`${rpcUrl}/wallet/getaccount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, visible: true }),
  });
  if (!res.ok) return 0n;
  const data = (await res.json()) as { balance?: number };
  return typeof data?.balance === "number" ? BigInt(data.balance) : 0n;
}

async function fetchBtcNative(rpcUrl: string, address: string): Promise<bigint> {
  // Blockbook v2 exposes /api/v2/address/<addr> with a balance field
  // (confirmed sats, base-10 string). The configured rpcUrl already
  // includes the /api segment, so we just append the v2/address path.
  const base = rpcUrl.replace(/\/?$/, "");
  const url = `${base}/v2/address/${encodeURIComponent(address)}?details=basic`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return 0n;
  const data = (await res.json()) as { balance?: string };
  if (typeof data?.balance !== "string") return 0n;
  try {
    return BigInt(data.balance);
  } catch {
    return 0n;
  }
}

async function fetchTonNative(rpcUrl: string, address: string): Promise<bigint> {
  // Toncenter exposes getAddressBalance under the same JSON-RPC endpoint.
  const res = await jsonRpc(rpcUrl, "getAddressBalance", { address });
  // Toncenter returns the result as a decimal string of nanotons.
  if (typeof res === "string") {
    try {
      return BigInt(res);
    } catch {
      return 0n;
    }
  }
  if (typeof res === "number") return BigInt(Math.floor(res));
  return 0n;
}

/** Token balance dispatcher. Returns null when the chain doesn't have a
 *  trivial read path here — the watch view treats null as "—". */
async function fetchTokenBalance(
  chain: ChainId,
  rpcUrl: string,
  address: string,
  token: TetherToken,
): Promise<bigint | null> {
  switch (chain) {
    case "evm":
    case "bsc":
    case "polygon":
    case "arbitrum":
    case "base":
    case "optimism":
      return fetchErc20Balance(rpcUrl, address, token.address);
    case "solana":
      return fetchSplBalance(rpcUrl, address, token.address);
    case "tron":
    case "ton":
      // TRC-20 read via /wallet/triggerconstantcontract and Jetton wallet
      // resolution both add nontrivial code paths. Out of scope for this
      // pass — view-on-explorer link covers the gap from the UI.
      return null;
    default:
      return null;
  }
}

async function fetchErc20Balance(
  rpcUrl: string,
  holder: string,
  contract: string,
): Promise<bigint> {
  // ERC-20 `balanceOf(address)` selector: 0x70a08231
  // followed by 32-byte left-padded address.
  const stripped = holder.toLowerCase().replace(/^0x/, "");
  const data = `0x70a08231${"0".repeat(24)}${stripped}`;
  const res = await jsonRpc(rpcUrl, "eth_call", [
    { to: contract, data },
    "latest",
  ]);
  if (typeof res !== "string" || !res.startsWith("0x")) return 0n;
  try {
    return BigInt(res);
  } catch {
    return 0n;
  }
}

async function fetchSplBalance(
  rpcUrl: string,
  owner: string,
  mint: string,
): Promise<bigint> {
  // getTokenAccountsByOwner returns every SPL token account; we sum the ones
  // for this mint. Most addresses have at most one, but multiple is legal.
  const res = await jsonRpc(rpcUrl, "getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed" },
  ]);
  const accounts =
    (res as { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: string } } } } } }> })?.value ?? [];
  let total = 0n;
  for (const acc of accounts) {
    const raw = acc?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (typeof raw === "string") {
      try {
        total += BigInt(raw);
      } catch {
        // ignore malformed entries
      }
    }
  }
  return total;
}

// ─── Tiny JSON-RPC helper ─────────────────────────────────────────────────

async function jsonRpc(
  url: string,
  method: string,
  params: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC ${method} failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (data.error) {
    throw new Error(data.error.message ?? `RPC ${method} returned an error`);
  }
  return data.result;
}

/** Re-export so the watch view can resolve labels and decimals without
 *  importing chains.ts directly for the same data. */
export function tokensForChain(chain: ChainId, network: NetworkKey): TetherToken[] {
  return networkSpec(chain, network).tetherTokens;
}

export function nativeDecimals(chain: ChainId): number {
  return CHAIN_CONFIGS[chain].nativeDecimals;
}
