import { Crosshair, Footprints, Ghost, Hand, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TrickId } from "@/lib/tricks";

import { TrickSelector } from "./TrickSelector";

export type CalibrationState = "idle" | "scanning" | "locked";

interface ControlBarProps {
  trick: TrickId;
  onTrickChange: (id: TrickId) => void;
  calibration: CalibrationState;
  onCalibrate: () => void;
  stanceGuide: boolean;
  onStanceGuideChange: (on: boolean) => void;
  ghostDeck: boolean;
  onGhostDeckChange: (on: boolean) => void;
  tipTracking: boolean;
  onTipTrackingChange: (on: boolean) => void;
}

export function ControlBar({
  trick,
  onTrickChange,
  calibration,
  onCalibrate,
  stanceGuide,
  onStanceGuideChange,
  ghostDeck,
  onGhostDeckChange,
  tipTracking,
  onTipTrackingChange,
}: ControlBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-safe pb-safe">
      <nav
        aria-label="Session controls"
        className="pointer-events-auto griptape w-full max-w-5xl animate-slap p-2 lg:flex lg:items-center lg:gap-3"
      >
        <div className="min-w-0 lg:flex-1">
          <TrickSelector value={trick} onChange={onTrickChange} />
        </div>

        {/* Spray-painted divider */}
        <div className="mx-2 my-1 h-0.5 rotate-[-0.5deg] bg-primary/40 blur-[0.5px] lg:my-0 lg:h-8 lg:w-0.5 lg:rotate-0" />

        <div className="grid grid-cols-2 gap-3 px-1 pt-1 pb-1.5 lg:flex lg:shrink-0">
          <Button
            variant={calibration === "locked" ? "slab" : "hazard"}
            size="pill"
            onClick={onCalibrate}
            disabled={calibration === "scanning"}
            className="-rotate-1 font-marker"
          >
            {calibration === "scanning" ? (
              <Loader2 className="animate-spin" />
            ) : calibration === "locked" ? (
              <RotateCcw />
            ) : (
              <Crosshair />
            )}
            {calibration === "scanning"
              ? "Scanning…"
              : calibration === "locked"
                ? "Recalibrate"
                : "Calibrate Surface"}
          </Button>

          <div className="drop-hard">
            <Button
              variant={tipTracking ? "tape-hot" : "tape"}
              size="pill"
              aria-pressed={tipTracking}
              onClick={() => onTipTrackingChange(!tipTracking)}
              className="w-full rotate-1"
            >
              <Hand />
              Tip Track
              <span
                aria-hidden
                className="relative ml-1 inline-block h-4 w-8 shrink-0 border-2 border-ink bg-ink"
              >
                <span
                  className={
                    tipTracking
                      ? "absolute top-0 left-4 size-3 bg-hazard transition-all"
                      : "absolute top-0 left-0 size-3 bg-tape transition-all"
                  }
                />
              </span>
            </Button>
          </div>

          <div className="drop-hard">
            <Button
              variant={ghostDeck ? "tape-hot" : "tape"}
              size="pill"
              aria-pressed={ghostDeck}
              onClick={() => onGhostDeckChange(!ghostDeck)}
              className="w-full -rotate-1"
            >
              <Ghost />
              Ghost Deck
              <span
                aria-hidden
                className="relative ml-1 inline-block h-4 w-8 shrink-0 border-2 border-ink bg-ink"
              >
                <span
                  className={
                    ghostDeck
                      ? "absolute top-0 left-4 size-3 bg-hazard transition-all"
                      : "absolute top-0 left-0 size-3 bg-tape transition-all"
                  }
                />
              </span>
            </Button>
          </div>

          <div className="drop-hard">
            <Button
              variant={stanceGuide ? "tape-hot" : "tape"}
              size="pill"
              aria-pressed={stanceGuide}
              onClick={() => onStanceGuideChange(!stanceGuide)}
              className="w-full rotate-1"
            >
              <Footprints />
              Stance Guide
              <span
                aria-hidden
                className="relative ml-1 inline-block h-4 w-8 shrink-0 border-2 border-ink bg-ink"
              >
                <span
                  className={
                    stanceGuide
                      ? "absolute top-0 left-4 size-3 bg-hazard transition-all"
                      : "absolute top-0 left-0 size-3 bg-tape transition-all"
                  }
                />
              </span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}
