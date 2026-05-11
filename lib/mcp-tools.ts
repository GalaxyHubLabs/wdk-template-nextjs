/**
 * Tool registry for the wallet's MCP server.
 *
 * The /api/mcp endpoint exposes the wallet's *read* surface as a set
 * of Model Context Protocol tools that any MCP-aware AI agent can
 * invoke. Because the server runs on the public deployment (not on
 * the user's device), it cannot access the encrypted seed phrase —
 * every tool here is therefore read-only. Signing and sending still
 * happen on the user's device through the existing wallet UI, via
 * the agent example in `examples/agent-send-usdt.ts`, or via a
 * custom server-side deployment that injects its own seed.
 *
 * Tools defined here:
 *   - list_supported_chains
 *   - validate_address
 *   - resolve_name
 *   - get_balance
 *   - get_token_metadata
 *   - get_recent_transactions
 *
 * Each tool has a JSON-schema-style input descriptor that MCP clients
 * use to populate prompts, plus a runtime `execute` that returns
 * plain JSON.
 */

import {
  CHAIN_CONFIGS,
  CHAIN_IDS,
  networkSpec,
  type ChainId,
  type NetworkKey,
} from "./chains";
import { resolveName } from "./name-resolution";
import {
  fetchNativeBalance,
  fetchTetherBalances,
} from "./watch-balances";
import {
  getEvmRecentTransactions,
  getSolanaRecentTransactions,
  isLikelyAddressFor,
} from "./wdk-client";

/** Standard MCP content shape — every tool returns one of these arrays. */
export type ToolContent =
  | { type: "text"; text: string }
  | { type: "json"; data: unknown };

export interface ToolDescriptor {
  /** Tool name as the MCP client will see it. */
  name: string;
  /** Short, agent-facing summary of what the tool does. */
  description: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: {
    type: "object";
    properties: Record<string, JsonSchemaNode>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /** Runtime: given parsed args, return the tool's output. */
  execute: (
    args: Record<string, unknown>,
  ) => Promise<{ content: ToolContent[] }>;
}

interface JsonSchemaNode {
  type: string;
  description?: string;
  enum?: readonly string[];
  default?: unknown;
}

// ─── Shared helpers ───────────────────────────────────────────────────

function pickChain(args: Record<string, unknown>): ChainId {
  const chain = args.chain;
  if (typeof chain !== "string" || !(CHAIN_IDS as readonly string[]).includes(chain)) {
    throw toolError(
      `Invalid \`chain\` parameter. Supported: ${CHAIN_IDS.join(", ")}.`,
    );
  }
  return chain as ChainId;
}

function pickNetwork(args: Record<string, unknown>): NetworkKey {
  const network = args.network ?? "mainnet";
  if (network !== "mainnet" && network !== "testnet") {
    throw toolError("`network` must be \"mainnet\" or \"testnet\".");
  }
  return network as NetworkKey;
}

function requireString(
  args: Record<string, unknown>,
  key: string,
  hint: string,
): string {
  const v = args[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw toolError(`Missing required \`${key}\` (${hint}).`);
  }
  return v.trim();
}

function toolError(message: string): Error {
  const e = new Error(message);
  (e as Error & { isToolError?: boolean }).isToolError = true;
  return e;
}

// ─── Tool implementations ─────────────────────────────────────────────

export const TOOLS: ToolDescriptor[] = [
  {
    name: "list_supported_chains",
    description:
      "List every blockchain this wallet template supports, with its native asset symbol and decimals. Use this first if you don't already know which `chain` parameter to pass to other tools.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => ({
      content: [
        {
          type: "json",
          data: CHAIN_IDS.map((id) => ({
            chain: id,
            label: CHAIN_CONFIGS[id].label,
            nativeSymbol: CHAIN_CONFIGS[id].nativeSymbol,
            nativeDecimals: CHAIN_CONFIGS[id].nativeDecimals,
          })),
        },
      ],
    }),
  },

  {
    name: "validate_address",
    description:
      "Best-effort syntactic validation that a string looks like an address on the given chain. Doesn't check on-chain existence — use this to fail fast on obviously-wrong inputs before calling balance / transaction tools.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "Chain id. Call list_supported_chains for the set.",
          enum: CHAIN_IDS,
        },
        address: {
          type: "string",
          description: "The address string to validate.",
        },
      },
      required: ["chain", "address"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const chain = pickChain(args);
      const address = requireString(args, "address", "the address string");
      const valid = isLikelyAddressFor(chain, address);
      return {
        content: [{ type: "json", data: { chain, address, valid } }],
      };
    },
  },

  {
    name: "resolve_name",
    description:
      "Resolve a human-readable on-chain name (e.g. `vitalik.eth` on EVM chains, `bonfida.sol` on Solana mainnet) to a concrete address. Returns null when the name can't be resolved.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "Chain to resolve against.",
          enum: CHAIN_IDS,
        },
        name: {
          type: "string",
          description: "The .eth or .sol name to resolve.",
        },
        network: {
          type: "string",
          description: "Network to query (default: mainnet).",
          enum: ["mainnet", "testnet"],
          default: "mainnet",
        },
      },
      required: ["chain", "name"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const chain = pickChain(args);
      const network = pickNetwork(args);
      const name = requireString(args, "name", "an ENS / SNS name");
      const address = await resolveName(chain, name, network);
      return {
        content: [
          {
            type: "json",
            data: { chain, network, name, address },
          },
        ],
      };
    },
  },

  {
    name: "get_balance",
    description:
      "Read the native-asset balance and (where Tether has deployed it) the USDT and XAUt token balances for an address on a chain. Public-RPC only — no keys required.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: CHAIN_IDS },
        address: { type: "string", description: "Address to query." },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
          default: "mainnet",
        },
      },
      required: ["chain", "address"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const chain = pickChain(args);
      const network = pickNetwork(args);
      const address = requireString(args, "address", "the address");
      if (!isLikelyAddressFor(chain, address)) {
        throw toolError(
          `\`${address}\` doesn't look like a valid ${chain} address.`,
        );
      }
      const config = CHAIN_CONFIGS[chain];
      const spec = networkSpec(chain, network);
      const [native, tetherMap] = await Promise.all([
        fetchNativeBalance(chain, network, address),
        fetchTetherBalances(chain, network, address),
      ]);
      return {
        content: [
          {
            type: "json",
            data: {
              chain,
              network,
              address,
              native: {
                symbol: config.nativeSymbol,
                decimals: config.nativeDecimals,
                /** Raw units as a base-10 string (bigint-safe for JSON). */
                raw: native.toString(),
              },
              tetherTokens: spec.tetherTokens.map((t) => {
                const bal = tetherMap[t.address];
                return {
                  symbol: t.symbol,
                  name: t.name,
                  contract: t.address,
                  decimals: t.decimals,
                  raw: bal == null ? null : bal.toString(),
                };
              }),
            },
          },
        ],
      };
    },
  },

  {
    name: "get_token_metadata",
    description:
      "For an EVM chain, fetch a token contract's ERC-20 metadata (symbol, decimals, name) via on-chain `eth_call`. Useful when the agent needs to render an unknown contract's display info before quoting a balance.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: CHAIN_IDS },
        contract: { type: "string", description: "Token contract address." },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
          default: "mainnet",
        },
      },
      required: ["chain", "contract"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const chain = pickChain(args);
      const network = pickNetwork(args);
      const contract = requireString(args, "contract", "the token contract");
      // Reuse the approvals module's metadata reader so we don't
      // ship two near-identical ERC-20 metadata implementations.
      const { readErc20Metadata } = await import("./approvals");
      const rpcUrl = networkSpec(chain, network).rpcUrl;
      const meta = await readErc20Metadata(rpcUrl, contract);
      return {
        content: [
          { type: "json", data: { chain, network, contract, ...meta } },
        ],
      };
    },
  },

  {
    name: "get_recent_transactions",
    description:
      "Return the latest transactions for an address. Solana is read via `getSignaturesForAddress`; EVM family via the Etherscan-compatible API for the chain (no API key required for the default rate limits).",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: CHAIN_IDS },
        address: { type: "string" },
        limit: {
          type: "number",
          description: "Up to 25 entries.",
          default: 10,
        },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
          default: "mainnet",
        },
      },
      required: ["chain", "address"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const chain = pickChain(args);
      const network = pickNetwork(args);
      const address = requireString(args, "address", "the address");
      const limit = Math.min(
        25,
        Math.max(1, Number(args.limit) || 10),
      );
      const spec = networkSpec(chain, network);
      // The two list-capable backends each return a different shape.
      // We normalise to a small common payload here so the tool's
      // output is predictable across chains.
      if (chain === "solana") {
        const txs = await fetchSolanaForTool(address, network, limit);
        return {
          content: [
            {
              type: "json",
              data: {
                chain,
                network,
                address,
                transactions: txs.map((tx) => ({
                  hash: tx.signature,
                  slot: tx.slot,
                  blockTime: tx.blockTime,
                  failed: tx.err != null,
                  explorerUrl: spec.txExplorer(tx.signature),
                })),
              },
            },
          ],
        };
      }
      if (
        chain === "evm" ||
        chain === "bsc" ||
        chain === "polygon" ||
        chain === "arbitrum" ||
        chain === "base" ||
        chain === "optimism"
      ) {
        const txs = await fetchEvmForTool(chain, network, address, limit);
        return {
          content: [
            {
              type: "json",
              data: {
                chain,
                network,
                address,
                transactions: txs.map((tx) => ({
                  hash: tx.hash,
                  blockNumber: tx.blockNumber,
                  blockTime: tx.blockTime,
                  from: tx.from,
                  to: tx.to,
                  /** Wei as base-10 string. */
                  valueRaw: tx.value.toString(),
                  failed: tx.failed,
                  explorerUrl: spec.txExplorer(tx.hash),
                })),
              },
            },
          ],
        };
      }
      // TRON and TON don't have list endpoints exposed by WDK or by
      // common public APIs without an API key. Return a clear hint.
      return {
        content: [
          {
            type: "text",
            text: `Inline transaction history isn't wired for ${chain}. Use the chain explorer link from \`networkSpec(${chain}, ${network}).addressExplorer(${address})\` instead.`,
          },
        ],
      };
    },
  },
];

// Helpers wrap the existing client-side fetchers so the tool runtime
// stays decoupled from the larger `WalletHandle` type. They build a
// synthetic minimal handle that only carries what the fetchers need.
async function fetchSolanaForTool(
  address: string,
  network: NetworkKey,
  limit: number,
) {
  const fakeHandle = {
    accounts: { solana: { address } },
    network,
    accountIndex: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return getSolanaRecentTransactions(fakeHandle, limit);
}

async function fetchEvmForTool(
  chain: ChainId,
  network: NetworkKey,
  address: string,
  limit: number,
) {
  const fakeHandle = {
    accounts: { [chain]: { address } },
    network,
    accountIndex: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return getEvmRecentTransactions(fakeHandle, chain, limit);
}
