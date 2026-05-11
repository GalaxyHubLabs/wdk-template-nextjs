"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookUser,
  History,
  ImageIcon,
  KeyRound,
  Lock,
  PenLine,
  Plus,
  Search,
  Settings,
  ShieldOff,
  Wallet,
} from "lucide-react";

import { hasVault } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/store/wallet";

/**
 * Cmd-K command palette.
 *
 * A single keyboard shortcut (⌘K / Ctrl-K) opens a global navigator
 * over whatever screen the user is on. The palette lists every
 * primary action the wallet exposes and filters by fuzzy substring as
 * the user types. Selection is keyboard-driven (↑↓ to move, Enter to
 * fire, Esc to close).
 *
 * The component lives at the layout level — it has no per-route state
 * and quietly attaches a `keydown` listener at mount. When the wallet
 * is locked the palette still opens but most entries route through
 * the unlock screen first.
 */

interface Command {
  id: string;
  label: string;
  /** Optional secondary line ("Open the …"). */
  description?: string;
  /** Keyboard shortcut hint shown on the right ("⌘S", "G then H"). */
  shortcut?: string;
  Icon: typeof Wallet;
  /** Comma-separated extra keywords used by the filter. */
  keywords?: string;
  /** What happens when the user picks the item. */
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const reset = useWalletStore((s) => s.reset);
  const handle = useWalletStore((s) => s.handle);
  const setActiveChain = useWalletStore((s) => s.setActiveChain);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global ⌘K / Ctrl-K listener. Attaches once at mount, dismounts
  // alongside this component when the layout unmounts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset state and focus the input every time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    // Wait a frame so the input is in the DOM before focus.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function close() {
    setOpen(false);
  }

  function go(path: string) {
    return () => {
      close();
      router.push(path);
    };
  }

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [];
    const inWallet = Boolean(handle);

    if (inWallet) {
      list.push(
        {
          id: "nav-wallet",
          label: "Open wallet",
          Icon: Wallet,
          shortcut: "G W",
          run: go("/wallet"),
        },
        {
          id: "send",
          label: "Send",
          description: "Native asset, USDT, XAUt, or a custom token",
          Icon: ArrowUpRight,
          keywords: "transfer pay",
          run: go("/wallet/send"),
        },
        {
          id: "receive",
          label: "Receive",
          description: "Address QR or amount-encoded payment request",
          Icon: ArrowDownLeft,
          keywords: "request qr charge",
          run: go("/wallet/receive"),
        },
        {
          id: "history",
          label: "Activity history",
          description: "Recent transactions grouped by day",
          Icon: History,
          keywords: "transactions tx activity",
          run: go("/wallet/history"),
        },
        {
          id: "collectibles",
          label: "Collectibles",
          description: "Solana NFTs owned by the active account",
          Icon: ImageIcon,
          keywords: "nft mint metaplex",
          run: () => {
            close();
            setActiveChain("solana");
            router.push("/wallet/collectibles");
          },
        },
        {
          id: "address-book",
          label: "Address book",
          Icon: BookUser,
          keywords: "contacts recipients",
          run: go("/wallet/addresses"),
        },
        {
          id: "sign",
          label: "Sign message",
          description: "Prove ownership by signing arbitrary text",
          Icon: PenLine,
          keywords: "authenticate siwe attestation",
          run: go("/wallet/sign"),
        },
        {
          id: "approvals",
          label: "Token approvals",
          description: "Review and revoke standing ERC-20 authorisations",
          Icon: ShieldOff,
          keywords: "revoke allowance erc20 dex",
          run: go("/wallet/approvals"),
        },
        {
          id: "swap",
          label: "Swap tokens",
          description: "Powered by Tether's WDK Velora protocol module (EVM)",
          Icon: ArrowLeftRight,
          keywords: "trade exchange velora paraswap dex",
          run: go("/wallet/swap"),
        },
        {
          id: "add-token",
          label: "Add custom token",
          Icon: Plus,
          keywords: "import token spl erc20",
          run: go("/wallet/tokens/add"),
        },
        {
          id: "settings",
          label: "Settings",
          description: "Accounts, theme, RPC endpoints, danger zone",
          Icon: Settings,
          keywords: "preferences accounts",
          run: go("/settings"),
        },
        {
          id: "add-account",
          label: "Add account",
          description: "New derivation, import seed, or watch any address",
          Icon: Plus,
          keywords: "create import watch",
          run: go("/settings/add-account"),
        },
        {
          id: "lock",
          label: "Lock wallet",
          description: "Return to the unlock screen",
          Icon: Lock,
          keywords: "logout exit",
          run: () => {
            close();
            reset();
            router.replace(hasVault() ? "/unlock" : "/");
          },
        },
      );
    } else {
      list.push(
        {
          id: "create",
          label: "Create new wallet",
          Icon: Plus,
          run: go("/onboarding/create"),
        },
        {
          id: "import",
          label: "Import existing wallet",
          Icon: KeyRound,
          run: go("/onboarding/import"),
        },
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.description ?? ""} ${c.keywords ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  // Keep the highlighted index inside the filtered list bounds.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[highlight]?.run();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Search size={16} className="text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search actions…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 sm:inline-block dark:border-zinc-800">
            esc
          </kbd>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-zinc-500">
              Nothing matches &ldquo;{query}&rdquo;.
            </li>
          ) : (
            filtered.map((cmd, i) => {
              const active = i === highlight;
              return (
                <li key={cmd.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={cmd.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-brand-soft text-foreground"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        active
                          ? "bg-white text-brand dark:bg-zinc-950"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
                      )}
                    >
                      <cmd.Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">
                        {cmd.label}
                      </span>
                      {cmd.description && (
                        <span className="block truncate text-xs text-zinc-500">
                          {cmd.description}
                        </span>
                      )}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-block dark:border-zinc-800 dark:bg-zinc-950">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-500 dark:border-zinc-800">
          <span>
            <kbd className="rounded border border-zinc-200 px-1 font-mono dark:border-zinc-800">
              ↑↓
            </kbd>{" "}
            navigate ·{" "}
            <kbd className="rounded border border-zinc-200 px-1 font-mono dark:border-zinc-800">
              ↵
            </kbd>{" "}
            select
          </span>
          <span>
            Open with{" "}
            <kbd className="rounded border border-zinc-200 px-1 font-mono dark:border-zinc-800">
              ⌘K
            </kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
