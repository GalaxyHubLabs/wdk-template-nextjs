import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merger — combine clsx + tailwind-merge so conflicting classes resolve correctly. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a long string (like a Solana address) for display. */
export function truncate(str: string, head = 4, tail = 4) {
  if (!str) return "";
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

/** Format a lamports / native-unit balance as a human-readable SOL string. */
export function formatBalance(value: bigint | number | null | undefined, decimals = 9) {
  if (value == null) return "—";
  const big = typeof value === "bigint" ? value : BigInt(Math.floor(value));
  const divisor = 10n ** BigInt(decimals);
  const whole = big / divisor;
  const frac = big % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
