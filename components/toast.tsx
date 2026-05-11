"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast, useToastStore, type ToastKind } from "@/lib/toast";

const KIND_ICON: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const KIND_CLASS: Record<ToastKind, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
  error:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100",
  info:
    "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
};

const KIND_ICON_CLASS: Record<ToastKind, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-zinc-500 dark:text-zinc-400",
};

export function Toaster() {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end">
      {items.map((t) => {
        const Icon = KIND_ICON[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur-sm",
              "animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
              KIND_CLASS[t.kind],
            )}
          >
            <Icon size={18} className={cn("mt-0.5 shrink-0", KIND_ICON_CLASS[t.kind])} />
            <p className="flex-1 text-sm leading-snug">{t.text}</p>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
