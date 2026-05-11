# WDK Template Wallet — Next.js

A **self-custodial Solana wallet** template built on [Tether's Wallet Development Kit (WDK)](https://docs.wdk.tether.io). Production-ready Next.js scaffold for both **human users and autonomous AI agents**.

Designed to be forked. Designed to ship.

> ⚡ **Featured chain:** Solana · **Stack:** Next.js 16 + TypeScript + Tailwind v4 + WDK · **License:** MIT

---

## ✨ What's inside

A complete, opinionated starter that demonstrates the WDK integration patterns most teams end up writing themselves:

- ✅ **Create wallet** with BIP-39 seed phrase generation (12 words, 128-bit entropy)
- ✅ **Import wallet** from existing seed phrase with validation
- ✅ **Password-encrypted vault** (AES-GCM + PBKDF2 250K iters, WebCrypto)
- ✅ **Unlock flow** — vault persists in `localStorage`, decrypt with password
- ✅ **Send native SOL** with real fee quoting and Solscan confirmation links
- ✅ **Receive** screen with QR code, copy-to-clipboard, network warning
- ✅ **Account view** with live balance from Solana RPC
- ✅ **Watch any address** — read-only tracking for any address on any supported chain, with native + Tether token balances, USD totals, and explorer links. No keys held, no signing surface.
- ✅ **Lock / wipe** flows that keep the seed phrase as the source of truth

Built so a developer can clone this repo, plug in their own RPC keys, and have a deployable wallet UI in under five minutes.

## 🎬 Live demo

> *Demo URL added when deployed to Vercel.* Run locally in the meantime — see [Quick start](#-quick-start).

## 🚀 Quick start

```bash
# 1. Clone
git clone https://github.com/GalaxyHubLabs/wdk-template-nextjs.git
cd wdk-template-nextjs

# 2. Install
npm install

# 3. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Create new wallet**, set a password, save your seed phrase, and you'll land on a working wallet with a real on-chain devnet address.

Funded test: send your devnet address some SOL from the [Solana faucet](https://faucet.solana.com/) — the balance should appear after clicking **Refresh**.

### Configure RPC providers (optional)

The defaults use Solana's public RPC endpoints, which have aggressive rate limits and CORS quirks. For anything beyond local testing, drop your own provider URLs into `.env.local`:

```bash
NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://your-mainnet-rpc.example
NEXT_PUBLIC_SOLANA_RPC_DEVNET=https://your-devnet-rpc.example
```

Compatible with [Helius](https://www.helius.dev), [Triton](https://triton.one), [QuickNode](https://www.quicknode.com), and any standard Solana RPC.

## 🧩 Architecture

```
                     ┌──────────────────────────┐
                     │   User / AI agent        │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │   Next.js App Router     │  app/
                     │   /, /onboarding/*,      │  components/ui/*
                     │   /unlock, /wallet/*     │
                     └────────────┬─────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
   ┌────────────▼─────────────┐         ┌──────────▼───────────┐
   │  WebCrypto vault         │         │  Zustand store        │
   │  AES-GCM + PBKDF2        │         │  Wallet handle,       │
   │  in localStorage          │         │  balance, network     │
   │  (lib/storage.ts)         │         │  (store/wallet.ts)    │
   └────────────┬─────────────┘         └──────────┬───────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │  WDK client adapter      │  lib/wdk-client.ts
                     │  openWallet, send, quote │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │  @tetherto/wdk-wallet-   │
                     │  solana (WalletManager)  │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │  Solana RPC              │
                     │  (devnet / mainnet)      │
                     └──────────────────────────┘
```

### Layering rationale

- **The seed phrase only exists in cleartext** inside `lib/wdk-client.ts::openWallet` and `lib/storage.ts::saveVault`/`unlockVault`. Every other module operates on a `WalletHandle` (manager + account + address) and never sees the raw secret.
- **WDK is lazy-imported** inside `openWallet()` rather than at module top-level. This excludes WDK and its native crypto deps from the server-side render bundle.
- **The vault is a thin envelope** — version, salt, IV, ciphertext — so future hardening (e.g. moving to IndexedDB or WebAuthn-backed keys) is a swap inside `lib/storage.ts` with no UI changes.

## 🔐 Security model

This template ships with sensible defaults but is intended as a **starting point**, not the final word.

| Concern | What this template does | Production hardening recommended |
|---|---|---|
| Seed at rest | AES-GCM with PBKDF2(SHA-256, 250k iters) keyed from user password, stored in `localStorage` | Move to IndexedDB with a non-extractable CryptoKey, optionally WebAuthn / hardware-backed |
| Seed in memory | Held in module-scope only inside the unlock function; never written to logs | Wipe Uint8Array buffers after derivation; consider a service worker boundary |
| Unlock attempts | Unbounded | Add rate-limiting + wipe-after-N-failures |
| Address validation | Base58 regex check + WDK-side validation on submit | Add full Ed25519 pubkey check on the client |
| Transport | RPC over HTTPS | Pin allowed RPC origins via CSP; consider RPC proxy with auth |
| Clipboard exposure | `navigator.clipboard.writeText` for address copy | Audit your runtime extensions; clipboard contents leak across the OS |

For agents and unattended runtimes, replace the password-encrypted vault with a managed secret store (HSM, KMS, OS keychain) and remove the unlock UI entirely.

## 🧠 Use with AI agents

WDK is explicitly designed to be controlled by autonomous agents as well as humans. The same `WalletHandle` you see in the UI components is usable headlessly:

```ts
import { openWallet, sendNative } from "@/lib/wdk-client";

// Inside your agent runtime — seed comes from your secret store, not user input
const handle = await openWallet(seedFromHSM, "mainnet");
const result = await sendNative(handle, recipientAddress, 1_000_000n); // 0.001 SOL
console.log("Sent:", result.signature);
```

Pair this with an observability layer like [voight](https://github.com/Seenfinity/voight) (if your agents move money on-chain you want to see what they're doing) and you have a complete agent banking stack.

## 🛠️ Project structure

```
app/
  page.tsx                   # Landing — Create / Import / Unlock CTAs
  onboarding/
    create/page.tsx          # Set password -> reveal seed -> confirm
    import/page.tsx          # Paste seed -> set password -> open wallet
  unlock/page.tsx            # Password unlock (vault decrypt)
  wallet/
    page.tsx                 # Account + balance dashboard
    send/page.tsx            # Native SOL send (form -> review -> execute)
    receive/page.tsx         # QR + address + copy
  settings/
    page.tsx                 # Accounts, watched addresses, recovery phrase, danger zone
    add-account/page.tsx     # Picker: create / import / watch / hardware / private key
    add-watch/page.tsx       # Watch-only: pick chain + address + label
  watch/[id]/page.tsx        # Read-only view for a watched address (no signing UI)
lib/
  wdk-client.ts              # Thin WDK wrappers (the only seed-aware module)
  watch-list.ts              # Watch-only address registry (localStorage)
  watch-balances.ts          # Raw-RPC balance fetchers for arbitrary addresses
  storage.ts                 # WebCrypto vault
  networks.ts                # RPC endpoints per network
  utils.ts                   # cn, truncate, formatBalance
store/
  wallet.ts                  # Zustand — in-memory handle, balance, network
components/ui/               # Button, Card, Input — restyled for the template
next.config.ts               # sodium-native -> sodium-javascript alias for browser
```

## ➕ Adding another chain

WDK ships separate wallet modules per chain. Adding TON, TRON, Bitcoin, or any EVM is a three-step change:

1. `npm install @tetherto/wdk-wallet-<chain>`
2. In `lib/wdk-client.ts`, import the new `WalletManager<Chain>` and add a discriminator to `WalletHandle` (e.g. `kind: "solana" | "ton"`).
3. Add the network configs in `lib/networks.ts` and wire them into the UI's network indicator.

The vault, onboarding flow, and unlock screens are chain-agnostic — they only handle the seed.

## 🧪 Tech stack

- [Next.js 16](https://nextjs.org) with App Router and Turbopack
- [React 19.2](https://react.dev)
- [TypeScript](https://www.typescriptlang.org) (strict mode, ES2020 target)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Zustand](https://zustand-demo.pmnd.rs) for state
- [`@tetherto/wdk`](https://npmjs.com/package/@tetherto/wdk) + [`@tetherto/wdk-wallet-solana`](https://npmjs.com/package/@tetherto/wdk-wallet-solana)
- [`bip39`](https://npmjs.com/package/bip39) for mnemonic generation/validation
- [`qrcode.react`](https://npmjs.com/package/qrcode.react) for receive QR

## ⚖️ License

MIT — see [LICENSE](./LICENSE). Fork it, ship it, change the logo, charge for it. Just don't blame anyone here if something goes wrong with your wallet.

## 🙏 Acknowledgments

Built for the [Tether WDK Template Wallet bounty](https://tether.dev/grants/bounties/2800541287/). Shaped by patterns from [Phantom](https://phantom.app), [MetaMask](https://metamask.io), and the official [WDK examples](https://github.com/tetherto/wdk-examples).
