/**
 * Example: an autonomous agent sending USDT on Solana.
 *
 * Demonstrates the headline AI-agent claim of this template — that an
 * autonomous program can drive the wallet without touching any React
 * or DOM code, using only `lib/wdk-client.ts` as a programmatic API.
 *
 * The same pattern works on any of the nine chains the template
 * supports: change the `CHAIN` constant and the USDT contract /
 * mint address resolves automatically from `lib/chains.ts`.
 *
 * Usage:
 *   1. Copy this file out of the template (or run it from within if
 *      you have ts-node configured).
 *   2. Set the SEED_PHRASE environment variable to a BIP-39 mnemonic
 *      of a wallet that holds some testnet SOL and USDT. NEVER run
 *      this with a mainnet seed unless you've audited every line.
 *   3. Set RECIPIENT and AMOUNT_USDT to the destination and amount.
 *   4. `npx tsx examples/agent-send-usdt.ts`
 *
 * What it does:
 *   - Opens a WDK wallet from the seed (no UI, no password prompt).
 *   - Reads the current USDT balance via the same helpers the UI uses.
 *   - Quotes the transfer fee.
 *   - Sends, awaits the signature, and prints the explorer link.
 *
 * Notes for agent builders:
 *   - This script is self-contained: every WDK call is hidden behind
 *     a typed function in `lib/wdk-client.ts`. An agent only needs to
 *     know that surface — it never sees the raw Solana / EVM / etc.
 *     SDKs underneath.
 *   - Seed material lives only in memory for the lifetime of the
 *     `WalletHandle`. Call `closeWallet(handle)` on exit to dispose.
 *   - All amounts are bigints in chain-smallest units. USDT has 6
 *     decimals on every supported chain, so 1.00 USDT = 1_000_000n.
 */

import {
  closeWallet,
  getTokenBalance,
  openWallet,
  quoteTokenSend,
  sendToken,
} from "../lib/wdk-client";
import { networkSpec, type ChainId, type NetworkKey } from "../lib/chains";

// ─── Configuration ────────────────────────────────────────────────────

/** Which chain to operate on. Try "evm", "polygon", "arbitrum", … */
const CHAIN: ChainId = "solana";
/** Which network. Default to testnet so a stray run can't burn real funds. */
const NETWORK: NetworkKey = "testnet";
/** The address to send USDT to. */
const RECIPIENT = process.env.RECIPIENT ?? "";
/** Amount in whole USDT (e.g. 1.5 → 1.5 USDT). Will be scaled by
 *  the token's decimals at runtime. */
const AMOUNT_USDT = Number(process.env.AMOUNT_USDT ?? "0");

// ─── Helpers ──────────────────────────────────────────────────────────

function readSeedFromEnv(): string {
  const seed = process.env.SEED_PHRASE;
  if (!seed) {
    throw new Error(
      "SEED_PHRASE environment variable is required. Use a testnet seed.",
    );
  }
  return seed.trim();
}

function usdtTokenForChain(chain: ChainId, network: NetworkKey) {
  const tokens = networkSpec(chain, network).tetherTokens;
  const usdt = tokens.find((t) => t.symbol === "USDT");
  if (!usdt) {
    throw new Error(
      `USDT is not configured for ${chain} on ${network}. ` +
        `Check lib/chains.ts or set NEXT_PUBLIC_${chain.toUpperCase()}_USDT_TESTNET.`,
    );
  }
  return usdt;
}

function toUsdtUnits(amount: number, decimals: number): bigint {
  // Keep it pragmatic: multiply by 10^decimals and floor. For a wallet
  // template's example this is fine; for real money use a decimal lib.
  return BigInt(Math.floor(amount * 10 ** decimals));
}

// ─── Main flow ────────────────────────────────────────────────────────

async function main() {
  if (!RECIPIENT) {
    throw new Error("RECIPIENT environment variable is required.");
  }
  if (AMOUNT_USDT <= 0) {
    throw new Error("AMOUNT_USDT must be a positive number.");
  }

  const seed = readSeedFromEnv();
  const usdt = usdtTokenForChain(CHAIN, NETWORK);
  const amount = toUsdtUnits(AMOUNT_USDT, usdt.decimals);

  console.log(
    `Opening wallet on ${CHAIN} ${NETWORK} for a ${AMOUNT_USDT} USDT transfer…`,
  );
  const handle = await openWallet(seed, NETWORK);
  try {
    const account = handle.accounts[CHAIN];
    if (!account) {
      throw new Error(`Account derivation failed for ${CHAIN}.`);
    }
    console.log(`  ↳ From: ${account.address}`);

    const balance = await getTokenBalance(handle, CHAIN, usdt.address);
    console.log(`  ↳ Current USDT balance: ${balance.toString()} units`);
    if (balance < amount) {
      throw new Error(
        `Insufficient USDT — have ${balance}, need ${amount}.`,
      );
    }

    const quote = await quoteTokenSend(
      handle,
      CHAIN,
      usdt.address,
      RECIPIENT,
      amount,
    );
    console.log(`  ↳ Network fee quote: ${quote.fee.toString()} native units`);

    const result = await sendToken(
      handle,
      CHAIN,
      usdt.address,
      RECIPIENT,
      amount,
    );
    const explorer = networkSpec(CHAIN, NETWORK).txExplorer(result.signature);
    console.log("✓ Transfer submitted.");
    console.log(`  ↳ Signature: ${result.signature}`);
    console.log(`  ↳ Explorer: ${explorer}`);
  } finally {
    // Erases the private keys from memory. Always do this when an
    // agent's task is complete.
    closeWallet(handle);
  }
}

main().catch((err) => {
  console.error("Agent run failed:", err);
  process.exit(1);
});
