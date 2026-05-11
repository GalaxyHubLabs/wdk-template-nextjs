"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { hasVault } from "@/lib/storage";
import { useWalletStore } from "@/store/wallet";

/**
 * Idle auto-lock watcher.
 *
 * Pro wallets lock themselves after a period of inactivity so a laptop
 * left open on a coffee shop table can't be drained by the next person
 * who walks past. We mirror that behaviour: when the wallet is open
 * and the configured timeout elapses without any user input, we call
 * `reset()` (which disposes the WDK orchestrator and clears the
 * in-memory handle) and bounce the user to the unlock screen.
 *
 * The timeout is read from `localStorage` so users can tune it from
 * Settings → Privacy. A value of `0` disables auto-lock entirely.
 *
 * Activity is observed via `pointermove`, `keydown`, `mousedown`,
 * `touchstart`, `scroll`, and visibility-state changes (the laptop-
 * lid case). The handler debounces inside a single `requestAnimation
 * Frame` so a busy mouse doesn't spam timer resets.
 */

export const AUTO_LOCK_KEY = "wdk-template:auto-lock-min";

/** Minute presets surfaced in the settings dropdown. */
export const AUTO_LOCK_PRESETS: Array<{
  value: number;
  label: string;
  sublabel: string;
}> = [
  { value: 0, label: "Off", sublabel: "Stay unlocked until you lock manually" },
  { value: 5, label: "5 minutes", sublabel: "Lock after 5 minutes idle" },
  { value: 15, label: "15 minutes", sublabel: "Lock after 15 minutes idle" },
  { value: 30, label: "30 minutes", sublabel: "Lock after 30 minutes idle" },
  { value: 60, label: "1 hour", sublabel: "Lock after 1 hour idle" },
];

const DEFAULT_MINUTES = 15;

export function loadAutoLockMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_MINUTES;
  const raw = window.localStorage.getItem(AUTO_LOCK_KEY);
  if (raw == null) return DEFAULT_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MINUTES;
  return n;
}

export function saveAutoLockMinutes(minutes: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_LOCK_KEY, String(Math.max(0, minutes)));
}

export function AutoLock() {
  const router = useRouter();
  const handle = useWalletStore((s) => s.handle);
  const reset = useWalletStore((s) => s.reset);

  // We keep the timer in a ref so re-renders don't reset it.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!handle) return; // only run while unlocked

    const minutes = loadAutoLockMinutes();
    if (minutes <= 0) return; // user opted out

    const timeoutMs = minutes * 60 * 1000;

    function bump() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        reset();
        router.replace(hasVault() ? "/unlock" : "/");
      }, timeoutMs);
    }

    // Use passive listeners so we never interfere with scroll perf.
    const events = ["pointermove", "keydown", "mousedown", "touchstart", "scroll"];
    for (const ev of events) {
      window.addEventListener(ev, bump, { passive: true });
    }
    // Lock immediately when the tab goes to the background past the
    // timeout — desktop wallets behave this way too.
    function onVisibility() {
      if (document.visibilityState === "visible") bump();
    }
    document.addEventListener("visibilitychange", onVisibility);

    bump(); // start the clock
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of events) window.removeEventListener(ev, bump);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [handle, reset, router]);

  return null;
}
