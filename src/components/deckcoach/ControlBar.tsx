import { Crosshair, Footprints, Loader2, RotateCcw } from "lucide-react";

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
}

export function ControlBar({
  trick,
  onTrickChange,
  calibration,
  onCalibrate,
  stanceGuide,
  onStanceGuideChange,
}: ControlBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-safe pb-safe">
      <nav
        aria-label="Session controls"
        className="pointer-events-auto hud-glass w-full max-w-5xl animate-float-in rounded-3xl p-2 lg:flex lg:items-center lg:gap-2 lg:rounded-full"
      >
        <div className="min-w-0 lg:flex-1">
          <TrickSelector value={trick} onChange={onTrickChange} />
        </div>

        <div className="mx-1 my-2 h-px bg-hud-border lg:my-0 lg:h-7 lg:w-px" />

        <div className="grid grid-cols-2 gap-1.5 lg:flex lg:shrink-0">
          <Button
            variant={calibration === "locked" ? "chip-active" : "volt"}
            size="pill"
            onClick={onCalibrate}
            disabled={calibration === "scanning"}
            className="font-display tracking-wide"
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

          <Button
            variant={stanceGuide ? "chip-active" : "chip"}
            size="pill"
            aria-pressed={stanceGuide}
            onClick={() => onStanceGuideChange(!stanceGuide)}
            className="font-display tracking-wide"
          >
            <Footprints />
            Stance Guide
            <span
              aria-hidden
              className={
                stanceGuide
                  ? "relative ml-1 inline-block h-4 w-7 shrink-0 rounded-full bg-primary transition-colors"
                  : "relative ml-1 inline-block h-4 w-7 shrink-0 rounded-full bg-muted transition-colors"
              }
            >
              <span
                className={
                  stanceGuide
                    ? "absolute top-0.5 left-3.5 size-3 rounded-full bg-primary-foreground transition-all"
                    : "absolute top-0.5 left-0.5 size-3 rounded-full bg-muted-foreground transition-all"
                }
              />
            </span>
          </Button>
        </div>
      </nav>
    </div>
  );
}
