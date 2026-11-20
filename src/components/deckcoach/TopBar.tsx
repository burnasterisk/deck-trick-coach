import { Eye, EyeOff, House, SwitchCamera } from "lucide-react";

import type { CameraStatus } from "@/hooks/use-camera";
import { getDeckSetup, type DeckSetupId } from "@/lib/setup";
import type { Trick } from "@/lib/tricks";
import { cn } from "@/lib/utils";

interface TopBarProps {
  status: CameraStatus;
  trick: Trick;
  setup: DeckSetupId;
  boardName?: string;
  canFlip: boolean;
  onFlip: () => void;
  hudHidden: boolean;
  onToggleHud: () => void;
  onHome: () => void;
}

export function TopBar({
  status,
  trick,
  setup,
  boardName,
  canFlip,
  onFlip,
  hudHidden,
  onToggleHud,
  onHome,
}: TopBarProps) {
  const live = status === "live";
  const setupProfile = getDeckSetup(setup);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-safe pt-safe">
      {/* Brand + live trick/setup graffiti tag — quiet, unboxed, zero clutter */}
      <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-lg bg-black/45 px-3 py-1.5 backdrop-blur-md border border-paper/10">
        <span className="font-display text-lg leading-none tracking-wider text-paper whitespace-nowrap shrink-0 sm:text-xl">
          DECK<span className="text-primary hud-tag-glow">COACH</span>
        </span>
        <span className="h-3.5 w-px bg-paper/20 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-paper/85">
          {live && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-hazard animate-pulse-dot"
              title="Camera live"
              aria-hidden="true"
            />
          )}
          <span className="font-marker text-sm text-primary whitespace-nowrap truncate">
            {trick.name}
          </span>
          <span className="hidden text-paper/45 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden max-w-[150px] truncate text-paper/75 whitespace-nowrap sm:inline" title={boardName ?? setupProfile.shortTag}>
            {boardName ?? setupProfile.shortTag}
          </span>
        </div>
      </div>

      {/* Right actions: Focus/HUD toggle + Flip Camera */}
      <div className="pointer-events-auto flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onHome}
          aria-label="Back to home"
          title="Back to home"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-paper/15 bg-black/45 text-paper/90 backdrop-blur-md transition-colors cursor-pointer press hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <House className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleHud}
          aria-label={hudHidden ? "Show controls" : "Hide controls"}
          title={hudHidden ? "Show controls" : "Hide controls while skating"}
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border px-2.5 font-mono text-xs whitespace-nowrap shrink-0 backdrop-blur-md transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            hudHidden
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-paper/15 bg-black/45 text-paper/85 hover:border-paper/35 hover:text-paper",
          )}
        >
          {hudHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          <span className="hidden sm:inline">{hudHidden ? "Show HUD" : "Focus"}</span>
        </button>

        <button
          type="button"
          onClick={onFlip}
          disabled={!canFlip || status === "starting"}
          aria-label="Flip camera"
          title="Flip camera"
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-paper/15 bg-black/45 text-paper/90 backdrop-blur-md transition-colors cursor-pointer press hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40",
            hudHidden && "opacity-75 hover:opacity-100",
          )}
        >
          <SwitchCamera className="size-4" />
        </button>
      </div>
    </header>
  );
}
