import {
  Compass,
  Film,
  Footprints,
  Ghost,
  Hand,
  Loader2,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";

import type { HandTrackingStatus } from "@/lib/hand-tracking";
import type { DeckSetupId } from "@/lib/setup";
import type { TrickId } from "@/lib/tricks";
import { cn } from "@/lib/utils";

import { SetupToggle } from "./SetupToggle";
import { TrickSelector } from "./TrickSelector";

export type CalibrationState = "idle" | "scanning" | "locked";

interface ControlBarProps {
  trick: TrickId;
  onTrickChange: (id: TrickId) => void;
  setup: DeckSetupId;
  onSetupChange: (setup: DeckSetupId) => void;
  calibration: CalibrationState;
  onLockBoard: () => void;
  onCancelLock: () => void;
  stanceGuide: boolean;
  onStanceGuideChange: (on: boolean) => void;
  ghostDeck: boolean;
  onGhostDeckChange: (on: boolean) => void;
  tipTracking: boolean;
  onTipTrackingChange: (on: boolean) => void;
  trackingStatus: HandTrackingStatus;
  clipsCount: number;
  recordingClip: boolean;
  onOpenClips: () => void;
  sessionActive: boolean;
  onOpenSessions: () => void;
  hidden: boolean;
  onReveal: () => void;
  onInteract: () => void;
}

export function ControlBar({
  trick,
  onTrickChange,
  setup,
  onSetupChange,
  calibration,
  onLockBoard,
  onCancelLock,
  stanceGuide,
  onStanceGuideChange,
  ghostDeck,
  onGhostDeckChange,
  tipTracking,
  onTipTrackingChange,
  trackingStatus,
  clipsCount,
  recordingClip,
  onOpenClips,
  sessionActive,
  onOpenSessions,
  hidden,
  onReveal,
  onInteract,
}: ControlBarProps) {
  const trackBusy = tipTracking && trackingStatus === "loading";
  const trackErr = tipTracking && trackingStatus === "error";
  const scanning = calibration === "scanning";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center justify-end px-safe pb-safe">
      {/* Minimalist wake pill shown when menus auto-hide during skating */}
      {hidden && (
        <button
          type="button"
          onClick={onReveal}
          aria-label="Show session controls"
          className="pointer-events-auto mb-1 flex min-h-[40px] items-center gap-2 rounded-full border border-paper/15 bg-black/55 px-4 py-1.5 font-mono text-[11px] text-paper/80 backdrop-blur-md transition-all cursor-pointer press hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SlidersHorizontal className="size-3.5 text-primary" />
          <span className="whitespace-nowrap">Controls</span>
        </button>
      )}

      <nav
        aria-label="Session controls"
        aria-hidden={hidden}
        onPointerEnter={onInteract}
        onPointerDown={onInteract}
        onFocusCapture={onInteract}
        className={cn(
          "hud-glass w-full max-w-5xl rounded-xl p-1.5 transition-all duration-200 ease-out sm:p-2 lg:flex lg:items-center lg:justify-between lg:gap-2.5",
          hidden
            ? "pointer-events-none translate-y-6 opacity-0 h-0 overflow-hidden p-0 border-0"
            : "pointer-events-auto translate-y-0 opacity-100",
        )}
      >
        <div className="min-w-0 lg:flex-1">
          <TrickSelector value={trick} onChange={onTrickChange} hudHidden={hidden} />
        </div>

        <div className="my-1 h-px bg-paper/10 lg:my-0 lg:h-6 lg:w-px" aria-hidden="true" />

        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pt-0.5 lg:shrink-0 lg:pt-0">
          <SetupToggle value={setup} onChange={onSetupChange} />

          <span className="h-5 w-px shrink-0 bg-paper/10" aria-hidden="true" />

          {scanning ? (
            <button
              type="button"
              onClick={onCancelLock}
              className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border border-hazard/60 bg-hazard/20 px-3 py-1.5 font-mono text-xs font-bold whitespace-nowrap text-hazard transition-colors cursor-pointer press hover:bg-hazard/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Loader2 className="size-3.5 animate-spin" />
              <span>Locking…</span>
              <X className="size-3 opacity-80" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onLockBoard}
              className={cn(
                "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-bold whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                calibration === "locked"
                  ? "border-primary/45 bg-primary/15 text-primary hover:bg-primary/25"
                  : "border-hazard/70 bg-hazard text-hazard-foreground hover:brightness-110",
              )}
            >
              {calibration === "locked" ? (
                <RotateCcw className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
              <span>{calibration === "locked" ? "Relock Board" : "Lock Board"}</span>
            </button>
          )}

          <button
            type="button"
            aria-pressed={tipTracking}
            onClick={() => onTipTrackingChange(!tipTracking)}
            title={
              trackErr
                ? "Hand tracking failed to load"
                : "Show or hide fingertip vectors and board tracking visuals"
            }
            className={cn(
              "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              trackErr
                ? "border-hazard bg-hazard/20 text-hazard font-bold"
                : tipTracking
                  ? "border-primary/50 bg-primary/15 text-primary font-bold"
                  : "border-paper/15 bg-black/35 text-paper/75 hover:border-paper/30 hover:text-paper",
            )}
          >
            {trackBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Hand className="size-3.5" />
            )}
            <span>{trackBusy ? "Loading…" : trackErr ? "Track Error" : "Tip Track"}</span>
          </button>

          <button
            type="button"
            aria-pressed={stanceGuide}
            onClick={() => onStanceGuideChange(!stanceGuide)}
            className={cn(
              "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              stanceGuide
                ? "border-primary/50 bg-primary/15 text-primary font-bold"
                : "border-paper/15 bg-black/35 text-paper/75 hover:border-paper/30 hover:text-paper",
            )}
          >
            <Footprints className="size-3.5" />
            <span>Stance</span>
          </button>

          <button
            type="button"
            aria-pressed={ghostDeck}
            onClick={() => onGhostDeckChange(!ghostDeck)}
            title="Show live slow-motion Ghost Deck preview anchored to your fingertips"
            className={cn(
              "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              ghostDeck
                ? "border-primary/50 bg-primary/15 text-primary font-bold"
                : "border-paper/15 bg-black/35 text-paper/75 hover:border-paper/30 hover:text-paper",
            )}
          >
            <Ghost className="size-3.5" />
            <span>Ghost</span>
          </button>

          <button
            type="button"
            onClick={onOpenClips}
            title="Open saved slow-motion trick clips"
            className={cn(
              "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              recordingClip
                ? "border-[#FF2A2A]/70 bg-[#FF2A2A]/20 text-paper font-bold"
                : clipsCount > 0
                  ? "border-primary/45 bg-primary/12 text-primary font-bold hover:bg-primary/20"
                  : "border-paper/15 bg-black/35 text-paper/75 hover:border-paper/30 hover:text-paper",
            )}
          >
            {recordingClip ? (
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[#FF2A2A] animate-pulse-dot"
              />
            ) : (
              <Film className="size-3.5" />
            )}
            <span className="tabular-nums">
              {clipsCount > 0 ? `Clips · ${clipsCount}` : "Clips"}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSessions}
            title="Open Sessions hub: warmups, guided tutorials, and Weekly Clip Challenge"
            className={cn(
              "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              sessionActive
                ? "border-primary/50 bg-primary/15 text-primary font-bold"
                : "border-paper/15 bg-black/35 text-paper/80 hover:border-paper/35 hover:text-paper",
            )}
          >
            <Compass className="size-3.5" />
            <span>Sessions</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
