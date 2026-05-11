"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DropdownItem {
  value: string;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  /** Right-aligned trailing slot (balance, badge, etc). */
  trailing?: React.ReactNode;
  /** Optional leading slot (icon, avatar). */
  leading?: React.ReactNode;
  disabled?: boolean;
}

interface DropdownProps {
  value: string;
  items: DropdownItem[];
  onChange: (value: string) => void;
  /** Custom trigger label override (defaults to the active item's label). */
  triggerLabel?: React.ReactNode;
  triggerSublabel?: React.ReactNode;
  triggerLeading?: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}

/**
 * Minimal accessible dropdown built on a native `<details>`-free pattern:
 * click toggles the panel, outside click / escape closes. No portal, no
 * positioning library — the panel anchors below the trigger with absolute
 * positioning. Sufficient for our wallet template.
 */
export function Dropdown({
  value,
  items,
  onChange,
  triggerLabel,
  triggerSublabel,
  triggerLeading,
  align = "start",
  className,
  buttonClassName,
  ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const active = items.find((i) => i.value === value);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium",
          "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
          "dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
          buttonClassName,
        )}
      >
        {(triggerLeading ?? active?.leading) && (
          <span className="flex items-center">{triggerLeading ?? active?.leading}</span>
        )}
        <span className="flex flex-col items-start leading-tight">
          <span>{triggerLabel ?? active?.label ?? value}</span>
          {(triggerSublabel ?? active?.sublabel) && (
            <span className="text-[10px] font-normal text-zinc-500">
              {triggerSublabel ?? active?.sublabel}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "ml-1 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute z-30 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg",
            "dark:border-zinc-800 dark:bg-zinc-950",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => {
            const isActive = item.value === value;
            return (
              <li key={item.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none",
                    "dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900",
                    isActive && "bg-zinc-50 dark:bg-zinc-900",
                    item.disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  {item.leading && (
                    <span className="flex items-center">{item.leading}</span>
                  )}
                  <span className="flex-1 leading-tight">
                    <span className="block font-medium">{item.label}</span>
                    {item.sublabel && (
                      <span className="block text-[11px] text-zinc-500">
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                  {item.trailing && (
                    <span className="text-xs text-zinc-500">{item.trailing}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
