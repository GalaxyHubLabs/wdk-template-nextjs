/**
 * Tiny toast notification system. Plain zustand store so the helpers
 * (`toast.success` / `toast.error` / `toast.info`) can be called from any
 * client component or callback without lugging context around.
 *
 * Renderer lives in `components/toast.tsx` and is mounted globally in
 * `app/layout.tsx`. Each toast auto-dismisses after its `duration` ms.
 */

"use client";

import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
  duration: number;
}

interface ToastState {
  items: ToastMessage[];
  push: (item: Omit<ToastMessage, "id">) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (item) => {
    const id = ++nextId;
    set((s) => ({ items: [...s.items, { ...item, id }] }));
    if (item.duration > 0) {
      setTimeout(() => get().dismiss(id), item.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  clear: () => set({ items: [] }),
}));

function emit(kind: ToastKind, text: string, duration = 4000): number {
  return useToastStore.getState().push({ kind, text, duration });
}

export const toast = {
  success: (text: string, duration?: number) => emit("success", text, duration),
  error: (text: string, duration?: number) => emit("error", text, duration ?? 6000),
  info: (text: string, duration?: number) => emit("info", text, duration),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
  clear: () => useToastStore.getState().clear(),
};
