# WDK Template Wallet — Next.js

> **One seed. Nine chains. USDT-first.** A self-custodial, multi-chain wallet template built on [Tether's Wallet Development Kit](https://docs.wdk.tether.io). Designed for human users **and AI agents** — every wallet operation that an agent could need is exposed through a clean programmatic surface, plus a built-in [Model Context Protocol](https://modelcontextprotocol.io) server at `/api/mcp`.

[![Built on Tether WDK](https://img.shields.io/badge/Built%20on-Tether%20WDK-009393?style=flat-square)](https://docs.wdk.tether.io)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](#-license)

---

## 🎬 Live demo

> **Demo URL added when deployed to Vercel.** Run locally in the meantime — see [Quick start](#-quick-start).

Once deployed, the wallet is also a runnable MCP server: any Claude Desktop user can drive its read surface with five lines of config. See [`/agents`](app/agents/page.tsx) once the site is live, or [Built for AI agents](#-built-for-ai-agents) below.

---

## ✨ Everything that ships

A complete, opinionated wallet that demonstrates how far the WDK gets you without writing chain-specific code.

### Multi-chain — nine chains from a single BIP-39 seed

| Chain | Module | Tether tokens (mainnet) | Native price feed |
| --- | --- | --- | --- |
| **Solana** | `@tetherto/wdk-wallet-solana` | USDT | SOL |
| **TRON** | `@tetherto/wdk-wallet-tron` | USDT · XAUt | TRX |
| **TON** | `@tetherto/wdk-wallet-ton` | USDT | TON |
| **Ethereum** | `@tetherto/wdk-wallet-evm` | USDT · XAUt | ETH |
| **BSC** | `@tetherto/wdk-wallet-evm` | USDT (BEP-20) | BNB |
| **Polygon** | `@tetherto/wdk-wallet-evm` | USDT | MATIC |
| **Arbitrum** | `@tetherto/wdk-wallet-evm` | USDT | ETH |
| **Base** | `@tetherto/wdk-wallet-evm` | _none official yet — env override available_ | ETH |
| **Optimism** | `@tetherto/wdk-wallet-evm` | USDT | ETH |
| _Bitcoin_ | `@tetherto/wdk-wallet-bitcoin` (pending) | _coming soon_ | _coming soon_ |

The same `WalletManagerEvm` is registered under five different chain ids with different RPCs — exactly the pattern the WDK docs recommend for EVM L2s. Adding another L2 is a one-entry change in [`lib/chains.ts`](lib/chains.ts) + one `.registerWallet()` call in [`lib/wdk-client.ts`](lib/wdk-client.ts).

### Onboarding & vault

- ✅ **Create wallet** — 3-step flow (password → reveal 12-word seed → confirm backup).
- ✅ **Import wallet** — numbered 12/24-word grid with paste-anywhere fan-out.
- ✅ **Unlock screen** — password → AES-GCM decrypt → resume.
- ✅ **Biometric unlock** — Touch ID / Face ID / Windows Hello via WebAuthn PRF (Chrome 116+, Edge 116+, Safari TP 17+). Password remains required for the very first unlock after a wipe.
- ✅ **Encrypted local vault** — AES-GCM with 250,000-iteration PBKDF2, all via WebCrypto. Stored in `localStorage`, **never** sent anywhere.
- ✅ **Recovery phrase backup** — Settings → password gate → tap-to-reveal grid → copy.
- ✅ **Wipe** — irreversibly clears the vault and every derived state on this device.

### Networks

- ✅ **Mainnet / Testnet toggle** — global, applies to every chain. Switching tears down the WDK and re-binds to the new RPCs.
- ✅ **Per-network faucet shortcuts** — surfaced on `/wallet` whenever a testnet account has a zero balance.
- ✅ **Custom RPC editor** — Settings → Networks lets the user paste a Helius / Alchemy / QuickNode / Triton URL per chain × network. Changes propagate through `networkSpec()` on the next wallet open.

### Multi-account

- ✅ **BIP-44 account index** — tracked on the `WalletHandle`.
- ✅ **Dynamic account list** — create, rename, delete (UI only — the BIP-44 math always derives the same address for a given index).
- ✅ **`/settings/add-account`** picker with five options: Create new ✅ · Import recovery phrase ✅ · Watch any address ✅ · Connect hardware wallet (Soon) · Import private key (Soon).
- ✅ **Watch-only addresses** across all nine chains via raw RPC. Read-only — no keys held, no signing surface.

### Tokens

- ✅ Canonical Tether tokens on every supported chain × network (USDT on every mainnet that has it, XAUt on Ethereum + TRON).
- ✅ **Send any token** — native or ERC-20 / SPL / TRC-20 / jetton — via WDK's uniform `account.transfer({ token, recipient, amount })`.
- ✅ **Custom token import** with **Jupiter auto-fetch** on Solana (paste a mint, get symbol + decimals + logo).
- ✅ **Pinned (favorite) tokens** — star a token to keep it at the top of the list across reloads.
- ✅ **24-hour price change** badges (green/red) next to every USD value.

### Send / Receive / History

- ✅ **Send flow** — form → fee quote → review → execute → success. Native + tokens. Insufficient-gas warning separate from insufficient-asset.
- ✅ **ENS / SNS resolution** — `.eth` on every EVM chain, `.sol` on Solana. Debounced 350 ms, resolved address rendered as a preview, kept on the review screen.
- ✅ **Recent recipients** — last 8 destinations per chain, surfaced as one-click chips alongside the address book.
- ✅ **First-send-to-new-address warning** — explicit acknowledgement checkbox before review.
- ✅ **Receive page** with QR + chain-aware payment URI (Solana Pay / EIP-681 / `tron:` / `ton://transfer/`). Asset + amount selector builds a wallet-scannable charge link.
- ✅ **Activity history** — Solana via JSON-RPC, EVM family via Etherscan-compatible APIs. Grouped by day (Today / Yesterday / specific date), direction-aware icons, status pills.
- ✅ **Address book** — per-chain CRUD with ENS / SNS resolution on save and one-click chips in the send form.

### Signing & security

- ✅ **Sign arbitrary message** — `/wallet/sign` exposes WDK's uniform `account.sign(message)` for every chain. Useful for SIWE / SIWS, attestations, off-chain order books.
- ✅ **Token approvals page** (`/wallet/approvals`) — scans the last ~10k blocks for Approval events on EVM chains, lists every standing allowance with current value resolved on-chain, one-click revoke via WDK's `account.approve(amount: 0n)`. Unlimited approvals flagged in red.
- ✅ **Auto-lock** — Settings → Privacy preset selector (Off / 5 / 15 / 30 / 60 min). Mouse, keyboard, touch, scroll, and visibility-state events all count as activity.
- ✅ **Hide-balances toggle** — global `••••` masking, persisted per device.

### NFTs

- ✅ **Solana collectibles** (`/wallet/collectibles`) — Metaplex DAS via `getAssetsByOwner` on the configured RPC. Graceful degradation with an in-app CTA to plug a DAS-capable provider.

### Portfolio & prices

- ✅ Portfolio total in USD on the wallet headline (`$X.XX across N chains · Network`).
- ✅ Per-balance USD value below every amount.
- ✅ CoinGecko free-tier price feed with 60s in-memory cache. `priceChanges` slice for the 24h delta. Includes `matic-network` for Polygon's native.

### Identity & UX

- ✅ **Deterministic address avatars** — pure SVG gradient driven by a hash of the address. Same address always paints the same picture.
- ✅ **Real chain logos** from Trustwallet — never text initials.
- ✅ **Real Tether logo** for USDT + XAUt rows.
- ✅ **Tether teal brand** (`#009393` / `#1FBFA8`) baked in as CSS vars (`--brand`, `--brand-foreground`, `--brand-soft`).
- ✅ **Three-state theme toggle** (system / light / dark) with pre-React inline script to avoid FOUC.
- ✅ **Skeleton loaders** wherever a value is in flight — no more `—` placeholders.
- ✅ **⌘K command palette** — global jump-to-anything overlay, fuzzy filter, keyboard-driven.
- ✅ **Toast notifications** — zustand-driven, used in every async flow.
- ✅ **PWA manifest** + favicon + apple-touch-icon + Open Graph image — all generated via `next/og`. No binary assets in the repo.

### Documentation surfaces

- ✅ **`/agents`** — in-app walk-through for plugging the wallet's MCP server into Claude Desktop.
- ✅ **`examples/agent-send-usdt.ts`** — runnable TypeScript script that opens the wallet from a seed in `SEED_PHRASE` env, quotes a USDT transfer, sends it, prints the explorer link. Works on any of the nine chains by changing one constant.

---

## 🤖 Built for AI agents

The killer differentiator: this template ships a **built-in Model Context Protocol server** at `/api/mcp`. Any MCP-aware client (Claude Desktop, the Anthropic API's MCP client, custom agent runtimes) gets six read tools out of the box:

| Tool | What it does |
| --- | --- |
| `list_supported_chains` | Chain id → label + native symbol + decimals table. |
| `validate_address` | Syntactic address check per chain — fail fast. |
| `resolve_name` | ENS (`.eth`) on EVM, SNS (`.sol`) on Solana mainnet. |
| `get_balance` | Native + USDT + XAUt balances for any address. |
| `get_token_metadata` | ERC-20 `symbol()` / `decimals()` / `name()` via `eth_call`. |
| `get_recent_transactions` | Last N transactions normalised to a common shape. |

### Wire it into Claude Desktop in five lines

Paste this into your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wdk-wallet": {
      "transport": {
        "type": "http",
        "url": "https://<your-deployment>/api/mcp"
      }
    }
  }
}
```

Restart Claude Desktop. The wallet's tools then appear under the `wdk-wallet` server in any conversation.

### Signing & sending (the write path)

The MCP server is read-only by design — the seed phrase never leaves the user's device, so a stateless web server can't sign. For agents that need to **move funds**, the repo ships [`examples/agent-send-usdt.ts`](examples/agent-send-usdt.ts) — a 130-line standalone script that loads a seed from `SEED_PHRASE`, opens the wallet through `lib/wdk-client.ts`, and sends USDT on any of the nine chains.

```bash
export SEED_PHRASE="your twelve testnet words go here"
export RECIPIENT="<solana-or-evm-address>"
export AMOUNT_USDT="1.5"
npx tsx examples/agent-send-usdt.ts
```

Wire that pattern into your agent runtime when you need state-changing operations.

---

## 🚀 Quick start

```bash
# 1. Clone
git clone https://github.com/GalaxyHubLabs/wdk-template-nextjs.git
cd wdk-template-nextjs

# 2. Install
npm install

# 3. Dev server (Next.js 16 / Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Create new wallet**, set a password, save your seed phrase, and you land on a working multi-chain wallet — the default network is **testnet** so a first-time run can't burn real funds.

Need testnet SOL? The wallet surfaces the [Solana faucet](https://faucet.solana.com/) shortcut whenever your balance is zero on devnet.

---

## 🔧 Configuration

Every default works out of the box for local testing. For production deployments, drop RPCs and (optionally) custom token addresses into `.env.local`:

```bash
# Solana
NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://your-mainnet-helius-url
NEXT_PUBLIC_SOLANA_RPC_DEVNET=https://your-devnet-helius-url

# TRON
NEXT_PUBLIC_TRON_RPC_MAINNET=https://api.trongrid.io
NEXT_PUBLIC_TRON_RPC_TESTNET=https://api.shasta.trongrid.io

# TON
NEXT_PUBLIC_TON_RPC_MAINNET=https://toncenter.com/api/v2/jsonRPC
NEXT_PUBLIC_TON_RPC_TESTNET=https://testnet.toncenter.com/api/v2/jsonRPC

# EVM family — Ethereum, BSC, Polygon, Arbitrum, Base, Optimism
NEXT_PUBLIC_EVM_RPC_MAINNET=https://eth.llamarpc.com
NEXT_PUBLIC_EVM_RPC_TESTNET=https://sepolia.drpc.org
NEXT_PUBLIC_BSC_RPC_MAINNET=https://bsc-dataseed.binance.org
NEXT_PUBLIC_POLYGON_RPC_MAINNET=https://polygon-rpc.com
# … see lib/chains.ts for the full list
```

Compatible with [Helius](https://www.helius.dev), [Triton](https://triton.one), [QuickNode](https://www.quicknode.com), [Alchemy](https://www.alchemy.com), and any standards-compliant RPC. **End users can override these without redeploying** via Settings → Networks → tap a chain → paste their URL. Overrides persist to `localStorage`.

---

## 🧩 Architecture

```
                ┌───────────────────────────────────────────┐
                │   User / AI agent                          │
                └───────────────────┬───────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            │                                                │
   ┌────────▼────────┐                            ┌─────────▼─────────┐
   │ Next.js UI      │                            │ /api/mcp           │
   │ App Router      │                            │ JSON-RPC over HTTP │
   │ Wallet flows    │                            │ Six read tools     │
   └────────┬────────┘                            └─────────┬─────────┘
            │                                                │
            └─────────────────┬──────────────────────────────┘
                              │
            ┌─────────────────▼──────────────────┐
            │  lib/wdk-client.ts                  │
            │  openWallet · send · sign · approve │
            │  quote · token transfers · history  │
            │  (the only seed-aware module)       │
            └─────────────────┬──────────────────┘
                              │
            ┌─────────────────▼──────────────────┐
            │  @tetherto/wdk WdkManager           │
            │  .registerWallet(chain, manager,    │
            │                  { provider, … })   │
            └─────────────────┬──────────────────┘
                              │
   ┌──────────────┬───────────┼────────────┬──────────────┐
   │              │           │            │              │
┌──▼──┐ ┌────────▼────┐ ┌────▼────┐ ┌─────▼────┐ ┌──────▼─────┐
│ SOL │ │ TRON / TRX  │ │ TON     │ │ EVM × 6  │ │  Public RPC│
│     │ │             │ │         │ │ chains   │ │  per chain │
└─────┘ └─────────────┘ └─────────┘ └──────────┘ └────────────┘
```

### Built _on_ WDK, not _around_ it

A core architectural principle of this template — and a deliberate point of credibility for the bounty review — is that **every wallet operation goes through the WDK SDK as the contract intends**.

Concretely, in [`lib/wdk-client.ts`](lib/wdk-client.ts):

```ts
await account.transfer({ token, recipient, amount });     // token send
await account.sendTransaction({ to, value });             // native send
await account.approve({ token, spender, amount });        // revoke approval
await account.sign(message);                              // sign message
await account.quoteTransfer({ token, recipient, amount }); // fee quote
await account.quoteSendTransaction({ to, value });        // native fee quote
```

Every chain registers its own `WalletManager` via `WdkManager.registerWallet(...)`. Derivation, signing, nonce management, chain-specific encoding — **all of it is the SDK's job**, this template just orchestrates the calls.

Three places intentionally talk to raw RPC instead, and the reason is the same in each: WDK doesn't expose that read shape, so there's no contract to honour.

- [`lib/watch-balances.ts`](lib/watch-balances.ts) reads balances for arbitrary addresses (watch-only entries have no seed registered with WDK).
- [`lib/approvals.ts`](lib/approvals.ts) scans `eth_getLogs` for Approval events — WDK exposes `approve()` for the write path but no list endpoint for the read path.
- The EVM history feed in [`lib/wdk-client.ts::getEvmRecentTransactions`](lib/wdk-client.ts) and the Solana history in `getSolanaRecentTransactions` use chain explorers + JSON-RPC for the same reason.

Each of those paths is documented inline so a reviewer can confirm at a glance that nothing is being reimplemented around the SDK.

### Layering rationale

- **`lib/wdk-client.ts` is the only seed-aware module.** Everything else (pages, store, address book, watch list) talks to it through typed helpers. An AI agent that wants to drive the wallet doesn't need to touch React.
- **State (`store/wallet.ts`) is in-memory only.** Persistence lives in `localStorage` via dedicated modules: `lib/storage.ts` for the encrypted vault, `lib/accounts.ts` for the account list, `lib/watch-list.ts` for watch-only entries, `lib/address-book.ts`, `lib/recent-recipients.ts`, `lib/token-favorites.ts`, `lib/rpc-overrides.ts`, `lib/biometric.ts`.
- **Per-chain RPC overrides** are applied inline at `networkSpec()` lookup time. Every existing call site — `openWallet`'s WDK registrations, the watch-only balance fetcher, the explorer URL builders — picks up the override without a per-callsite change.

---

## 🔐 Security model

| Concern | How the template handles it |
| --- | --- |
| Seed storage | AES-GCM ciphertext in `localStorage`. Key derived from password via PBKDF2-SHA256, 250,000 iterations. WebCrypto throughout. |
| Seed exposure | The plaintext seed lives only on the in-memory `WalletHandle` for the duration of the unlocked session. `reset()` drops the reference; auto-lock fires `reset()` after the configured idle window. |
| Biometric | WebAuthn PRF extension binds an AES key to the platform authenticator. The password is encrypted with that key and stored locally; only a successful Touch ID / Face ID / Windows Hello ceremony recovers it. |
| First-send phishing | Sending to an address not in the address book or recent recipients requires an explicit acknowledgement checkbox. |
| Token approvals | `/wallet/approvals` surfaces every standing ERC-20 allowance on EVM chains with a one-click revoke. |
| Sign-message attestations | A clear "what is this?" disclaimer above every signing flow. |
| Watch-only addresses | Read-only, no keys held. The send button is rendered as a disabled affordance. |

The template has **no backend**. There is no API to phish, no database to breach, no server to compromise.

---

## 🛠️ Project structure

```
app/
  page.tsx                       Landing — hero + 6 feature cards + MCP strip
  layout.tsx                     Theme init, AutoLock, CommandPalette, Toaster
  globals.css                    Brand color vars, Tailwind v4 dark class strategy
  icon.tsx                       Dynamically generated favicon (next/og)
  apple-icon.tsx                 Apple touch icon (next/og)
  opengraph-image.tsx            1200×630 social preview (next/og)
  manifest.ts                    PWA manifest
  agents/page.tsx                AI-agent setup walk-through (MCP)
  api/mcp/route.ts               MCP JSON-RPC 2.0 over HTTP server
  onboarding/create/page.tsx     3-step wallet creation
  onboarding/import/page.tsx     12/24-word import
  unlock/page.tsx                Password + biometric unlock
  settings/page.tsx              Appearance, Privacy/Security, Accounts, Backup, Networks/RPCs, Danger zone
  settings/add-account/page.tsx  5-option picker (Create / Import / Watch / Hardware-soon / PK-soon)
  settings/add-watch/page.tsx    Watch-only address registration
  wallet/page.tsx                Dashboard — portfolio total, chain/network selector, account card, tokens, activity
  wallet/send/page.tsx           Token-aware send (native + USDT + XAUt + customs) with ENS/SNS + recents + first-send warning
  wallet/receive/page.tsx        QR + payment-request builder
  wallet/history/page.tsx        Unified activity feed (Solana + EVM family)
  wallet/sign/page.tsx           Arbitrary-message signing
  wallet/approvals/page.tsx      ERC-20 approval explorer + revoker
  wallet/collectibles/page.tsx   Solana NFTs via Metaplex DAS
  wallet/addresses/page.tsx      Address book with ENS/SNS resolution
  wallet/tokens/add/page.tsx     Custom token import + Jupiter auto-fetch (Solana)
  watch/[id]/page.tsx            Read-only view for a watched address

components/
  ui/avatar.tsx                  Deterministic SVG address avatar
  ui/button.tsx                  4 variants (primary uses bg-brand)
  ui/card.tsx                    Card + CardTitle + CardDescription
  ui/dropdown.tsx                Accessible dropdown
  ui/input.tsx                   Input + Textarea
  ui/skeleton.tsx                Animated pulse placeholder
  auto-lock.tsx                  Idle timeout watcher (mounted at layout)
  command-palette.tsx            ⌘K global jump-to-anything overlay
  theme.tsx                      Three-state theme toggle + pre-React init
  toast.tsx                      Toaster component

lib/
  wdk-client.ts                  Thin WDK wrappers — the only seed-aware module
  chains.ts                      Single source of truth for chain × network configs
  storage.ts                     AES-GCM vault (WebCrypto)
  biometric.ts                   WebAuthn PRF quick-unlock
  accounts.ts                    Account list (BIP-44 index registry)
  watch-list.ts                  Watch-only address registry
  watch-balances.ts              Raw-RPC balance fetchers for any address
  address-book.ts                Saved recipients
  recent-recipients.ts           Last N destinations per chain
  custom-tokens.ts               User-imported tokens + Jupiter auto-fetch
  token-favorites.ts             Pinned-token set
  name-resolution.ts             ENS + SNS resolver (ethers transitively from WDK)
  payment-uri.ts                 Solana Pay / EIP-681 / tron:/ / ton:// builders
  rpc-overrides.ts               localStorage-backed per-chain RPC override layer
  approvals.ts                   ERC-20 Approval event scanner + revoker plumbing
  nfts.ts                        Metaplex DAS NFT fetcher (Solana)
  prices.ts                      CoinGecko free-tier feed + 24h change cache
  mcp-tools.ts                   Tool catalogue for the /api/mcp server
  toast.ts                       Toast store
  utils.ts                       cn + truncate + formatBalance

store/
  wallet.ts                      Zustand — in-memory handle, balances, prices, preferences

examples/
  agent-send-usdt.ts             Runnable AI-agent example for the write path

next.config.ts                   sodium-native → sodium-javascript alias for browser
```

---

## ➕ Adding another chain

WDK ships separate wallet modules per chain. Adding a new EVM L2 or a non-EVM ecosystem is a three-step change:

1. **Install the module** (or reuse `@tetherto/wdk-wallet-evm` for an EVM-compatible chain):

   ```bash
   npm install @tetherto/wdk-wallet-<chain>
   ```

2. **Add the chain to `lib/chains.ts`** — extend the `ChainId` union, add an entry to `CHAIN_CONFIGS` with the mainnet / testnet RPC + explorer + USDT contract (if any), and include the id in `CHAIN_IDS`.

3. **Register the wallet in `lib/wdk-client.ts::openWallet`** — one new `.registerWallet(id, manager, { provider })` line on the WDK orchestrator.

That's it. Every page in the wallet — dashboard, send, receive, history, watch-only, MCP tools — picks up the new chain automatically because they all iterate `CHAIN_IDS`. The vault, onboarding, and unlock screens are chain-agnostic.

---

## 🧪 Tech stack

- [Next.js 16](https://nextjs.org) (App Router + Turbopack)
- [TypeScript](https://www.typescriptlang.org) — strict mode, ES2020 target
- [Tailwind CSS v4](https://tailwindcss.com) — class-based dark variant via `@custom-variant dark`
- [`@tetherto/wdk`](https://www.npmjs.com/package/@tetherto/wdk) + `@tetherto/wdk-wallet-{solana,tron,ton,evm}`
- [Zustand](https://github.com/pmndrs/zustand) for in-memory state
- [bip39](https://github.com/bitcoinjs/bip39) for seed-phrase entropy
- [`qrcode.react`](https://github.com/zpao/qrcode.react) for QR rendering
- [Lucide](https://lucide.dev) for icons
- WebCrypto · WebAuthn (PRF extension) · `next/og` for dynamic image generation

---

## 🗺️ Roadmap

Features the template architecture is ready for but doesn't yet ship:

- **Other framework variants** — Vue, Svelte, Angular, and Flutter implementations of the same template are on the roadmap.
- **Bitcoin** support once `@tetherto/wdk-wallet-bitcoin` lands on npm. The "Coming soon" placeholder in the chain selector already points there.
- **WalletConnect v2** so the template can act as the wallet side of any dApp.
- **Hardware wallet** signing (Ledger via WebHID).
- **Private key import** as a fifth account type.
- **Cross-chain swap** (Jupiter on Solana, LI.FI / Across for EVM ↔ EVM).
- **EVM NFT listing** (ERC-721 / ERC-1155 collectibles, mirroring the Solana DAS implementation).
- **TRC-20 / jetton balances in the watch-only view** (currently link out to the chain explorer).

---

## ⚖️ License

[MIT](LICENSE) — fork it, rebrand it, ship it.

---

## 🙏 Acknowledgments

- **Tether** for the WDK and the bounty that funded this template.
- **Trustwallet** for the open chain-logo asset library this template renders.
- **Anthropic** for the [Model Context Protocol](https://modelcontextprotocol.io) spec that makes the AI-agent integration so clean.
