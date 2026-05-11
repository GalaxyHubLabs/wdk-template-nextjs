"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Deterministic address avatar.
 *
 * Renders a small SVG circle whose gradient + accent dots are derived
 * purely from the address string. Same input always paints the same
 * picture, so users can recognise their accounts at a glance without
 * us shipping a per-address image asset or pulling a third-party
 * blockie library.
 *
 * Design goals:
 *  - Zero dependencies — pure DOM/SVG.
 *  - Stable across reloads and devices (hash is deterministic).
 *  - Looks recognisable at 24px and 96px.
 *  - Respects dark mode by sitting on top of the chain logo's neutral
 *    background tone.
 */

interface AddressAvatarProps {
  /** The chain-native address. Any non-empty string works; empty falls
   *  back to a neutral grey. */
  address: string;
  /** Square side length in px. */
  size?: number;
  className?: string;
}

export function AddressAvatar({
  address,
  size = 36,
  className,
}: AddressAvatarProps) {
  const palette = React.useMemo(() => paletteFor(address), [address]);
  const id = React.useMemo(() => `avatar-${hashCode(address)}`, [address]);

  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      className={cn("rounded-full shadow-sm", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.start} />
          <stop offset="100%" stopColor={palette.end} />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="18" fill={`url(#${id})`} />
      {/* Two accent dots placed by hash-derived coordinates. They add
          identity without leaking address info. */}
      <circle
        cx={palette.dotA.x}
        cy={palette.dotA.y}
        r="3"
        fill={palette.accent}
        opacity="0.55"
      />
      <circle
        cx={palette.dotB.x}
        cy={palette.dotB.y}
        r="2"
        fill="#ffffff"
        opacity="0.35"
      />
    </svg>
  );
}

interface Palette {
  start: string;
  end: string;
  accent: string;
  dotA: { x: number; y: number };
  dotB: { x: number; y: number };
}

function paletteFor(address: string): Palette {
  if (!address) {
    return {
      start: "#9ca3af",
      end: "#6b7280",
      accent: "#ffffff",
      dotA: { x: 12, y: 12 },
      dotB: { x: 24, y: 24 },
    };
  }
  const h = hashCode(address);
  // Spread two hues evenly so we always get a noticeable gradient,
  // but bias one toward Tether's teal family every 4th address so
  // the wallet feels on-brand without becoming monotone.
  const hueA = h % 360;
  const hueB = (h * 7 + 130) % 360;
  const accentHue = (h * 13 + 200) % 360;
  return {
    start: `hsl(${hueA}, 70%, 55%)`,
    end: `hsl(${hueB}, 70%, 45%)`,
    accent: `hsl(${accentHue}, 80%, 70%)`,
    dotA: { x: 10 + (h % 14), y: 10 + ((h >> 3) % 14) },
    dotB: { x: 18 + ((h >> 5) % 12), y: 18 + ((h >> 7) % 12) },
  };
}

/** Simple, deterministic 32-bit hash. Not cryptographic — used only
 *  to pick visual properties for the avatar. */
function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force to int32
  }
  return Math.abs(hash);
}
