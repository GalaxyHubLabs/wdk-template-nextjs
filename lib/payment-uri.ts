/**
 * Payment-request URI encoder.
 *
 * When a user wants to be paid, the bare address QR is fine but
 * leaves the sender to type the amount manually. Every major chain
 * has a URI scheme that bundles the address + amount + (optional)
 * token reference so a wallet on the other side can pre-fill the
 * send form on scan.
 *
 * We support:
 *   - Solana Pay (`solana:`) — the canonical spec, accepts native
 *     SOL and SPL tokens via the `spl-token` query param.
 *   - EIP-681 (`ethereum:`) — used by every EVM chain. We embed the
 *     chain id with `@<chainId>` and either set `value` for native
 *     transfers or use the `transfer(...)` function-call form for
 *     ERC-20s.
 *   - TRON tron:// scheme — informal but widely accepted.
 *   - TON ton:// scheme — Tonkeeper's `ton://transfer/<addr>` form.
 *
 * When the amount is zero we fall back to the bare address since
 * scanners interpret an amount-less URI inconsistently.
 */

import type { ChainId } from "./chains";

export interface PaymentRequest {
  chain: ChainId;
  /** Always the recipient's address on the active chain. */
  address: string;
  /** Smallest-units amount. 0n means "no amount fixed". */
  amount: bigint;
  /** Optional token contract/mint. null = native asset. */
  tokenAddress: string | null;
  /** Token decimals — needed for EVM `value` encoding when sending native. */
  decimals: number;
}

/** Build a wallet-scannable payment URI. Returns the bare address if
 *  the request has no amount and no token. */
export function buildPaymentUri(req: PaymentRequest): string {
  if (req.amount === 0n && !req.tokenAddress) return req.address;
  switch (req.chain) {
    case "solana":
      return buildSolanaPay(req);
    case "evm":
    case "bsc":
    case "polygon":
    case "arbitrum":
    case "base":
    case "optimism":
      return buildEip681(req);
    case "tron":
      return buildTron(req);
    case "ton":
      return buildTon(req);
    default:
      return req.address;
  }
}

// ─── Solana Pay ───────────────────────────────────────────────────────

function buildSolanaPay(req: PaymentRequest): string {
  const params = new URLSearchParams();
  if (req.amount > 0n) {
    // Solana Pay wants amount in DECIMAL with the token's natural
    // decimals applied. We render up to `decimals` digits without
    // trailing zeros for readability.
    params.set("amount", bigintToDecimal(req.amount, req.decimals));
  }
  if (req.tokenAddress) {
    params.set("spl-token", req.tokenAddress);
  }
  const qs = params.toString();
  return qs ? `solana:${req.address}?${qs}` : `solana:${req.address}`;
}

// ─── EIP-681 (EVM family) ─────────────────────────────────────────────

const EVM_CHAIN_IDS: Partial<Record<ChainId, number>> = {
  evm: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
};

function buildEip681(req: PaymentRequest): string {
  const chainId = EVM_CHAIN_IDS[req.chain];
  const suffix = chainId ? `@${chainId}` : "";
  if (req.tokenAddress) {
    // ERC-20 transfer:
    //   ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<amount>
    const params = new URLSearchParams();
    params.set("address", req.address);
    params.set("uint256", req.amount.toString());
    return `ethereum:${req.tokenAddress}${suffix}/transfer?${params.toString()}`;
  }
  // Native transfer:
  //   ethereum:<to>@<chainId>?value=<wei>
  if (req.amount === 0n) return `ethereum:${req.address}${suffix}`;
  return `ethereum:${req.address}${suffix}?value=${req.amount.toString()}`;
}

// ─── TRON ─────────────────────────────────────────────────────────────

function buildTron(req: PaymentRequest): string {
  // Informal scheme used by TronLink / TronWallet apps. TRC-20 token
  // links use `?contract=<addr>`.
  const params = new URLSearchParams();
  if (req.amount > 0n) params.set("amount", req.amount.toString());
  if (req.tokenAddress) params.set("contract", req.tokenAddress);
  const qs = params.toString();
  return qs ? `tron:${req.address}?${qs}` : `tron:${req.address}`;
}

// ─── TON ──────────────────────────────────────────────────────────────

function buildTon(req: PaymentRequest): string {
  // Tonkeeper's transfer scheme. Jetton transfers carry `jetton=<address>`
  // and the amount stays in jetton-base units.
  const params = new URLSearchParams();
  if (req.amount > 0n) params.set("amount", req.amount.toString());
  if (req.tokenAddress) params.set("jetton", req.tokenAddress);
  const qs = params.toString();
  return qs
    ? `ton://transfer/${req.address}?${qs}`
    : `ton://transfer/${req.address}`;
}

// ─── Shared helpers ───────────────────────────────────────────────────

function bigintToDecimal(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : whole;
}

/** Parse a human "1.234" string into chain-smallest units using a known
 *  decimals count. Returns null when the input is malformed. Mirrors
 *  the existing parser in app/wallet/send/page.tsx so the receive form
 *  validates exactly the same shapes. */
export function parseDecimalAmount(
  input: string,
  decimals: number,
): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return 0n;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return null;
  }
}
