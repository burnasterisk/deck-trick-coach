import { ChevronUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  getTrick,
  getTricksByCategory,
  TRICK_CATEGORIES,
  type TrickCategory,
  type TrickId,
} from "@/lib/tricks";
import { cn } from "@/lib/utils";

interface TrickSelectorProps {
  value: TrickId;
  onChange: (id: TrickId) => void;
  /** Closes the category trick tray when the control bar auto-hides. */
  hudHidden?: boolean;
}

export function TrickSelector({ value, onChange, hudHidden = false }: TrickSelectorProps) {
  const activeTrick = getTrick(value);
  const [open, setOpen] = useState(false);
  const [browseCategory, setBrowseCategory] = useState<TrickCategory>(activeTrick.category);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBrowseCategory(activeTrick.category);
  }, [activeTrick.category]);

  useEffect(() => {
    if (hudHidden) setOpen(false);
  }, [hudHidden]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const categoryTricks = getTricksByCategory(browseCategory);

  return (
    <div ref={containerRef} className="relative min-w-0">
      {/* Floating category trick drawer positioned cleanly above the bottom HUD bar */}
      {open && (
        <div
          role="dialog"
          aria-label="Choose fingerboard trick"
          className="hud-glass absolute bottom-full left-0 z-40 mb-2.5 w-[min(92vw,34rem)] animate-slap rounded-xl p-3 text-paper"
        >
          <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-2">
            <div
              role="tablist"
              aria-label="Trick categories"
              className="no-scrollbar flex items-center gap-1 overflow-x-auto"
            >
              {TRICK_CATEGORIES.map((cat) => {
                const isSelected = cat.id === browseCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setBrowseCategory(cat.id)}
                    className={cn(
                      "min-h-[36px] shrink-0 rounded-md px-2.5 py-1 font-mono text-[11px] whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isSelected
                        ? "bg-primary/15 font-bold text-primary"
                        : "text-paper/65 hover:bg-paper/10 hover:text-paper",
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close trick list"
              className="grid size-9 shrink-0 place-items-center rounded-md text-paper/60 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label={`${TRICK_CATEGORIES.find((c) => c.id === browseCategory)?.label ?? ""} tricks`}
            className="mt-2.5 grid max-h-[42dvh] grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-3"
          >
            {categoryTricks.map((t) => {
              const isActive = t.id === value;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-[44px] flex-col items-start justify-center rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-paper/10 bg-black/35 text-paper/85 hover:border-paper/30 hover:text-paper",
                  )}
                >
                  <span
                    className={cn(
                      "w-full truncate font-mono text-xs",
                      isActive && "font-marker text-[13px] tracking-wide",
                    )}
                  >
                    {t.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] tabular-nums text-paper/50">
                    <span>{t.short}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-hazard">
                      {"■".repeat(t.difficulty)}
                      <span className="text-paper/20">{"■".repeat(5 - t.difficulty)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Slim inline bar: Active Trick dropdown button + 4 category quick-tabs */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Selected trick: ${activeTrick.name}. Change trick`}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            open
              ? "border-primary bg-primary/20 text-primary"
              : "border-primary/45 bg-primary/12 text-primary hover:bg-primary/20",
          )}
        >
          <span className="font-marker text-sm tracking-wide">{activeTrick.name}</span>
          <ChevronUp
            className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")}
          />
        </button>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-paper/15" aria-hidden="true" />

        {TRICK_CATEGORIES.map((cat) => {
          const isCurrentCategory = activeTrick.category === cat.id;
          const isBrowsing = open && browseCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setBrowseCategory(cat.id);
                setOpen(true);
              }}
              className={cn(
                "relative flex min-h-[40px] shrink-0 items-center px-2.5 py-1.5 font-mono text-[11px] whitespace-nowrap rounded-md transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isBrowsing
                  ? "bg-paper/15 font-bold text-primary"
                  : isCurrentCategory
                    ? "bg-paper/8 font-bold text-paper"
                    : "text-paper/65 hover:bg-paper/10 hover:text-paper",
              )}
            >
              <span>{cat.label}</span>
              {isCurrentCategory && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-primary/80"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
