import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Skeleton loader.
 *
 * A neutral animated placeholder used while balances, prices, or
 * transactions are in flight. Prefer this over a plain dash so the UI
 * communicates "loading" instead of "empty".
 *
 * Usage:
 *   <Skeleton className="h-6 w-24" />
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200/80 dark:bg-zinc-800/60",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}
