import { Hand, ScanLine } from "lucide-react";

import type { BoardCalibration } from "@/lib/board-calibration";

import type { CalibrationState } from "./ControlBar";

interface SurfaceOverlayProps {
  state: CalibrationState;
  boardLock: BoardCalibration | null;
  handDetected?: boolean;
  sampleProgress?: number;
}

export function SurfaceOverlay({
  state,
  boardLock,
  handDetected = false,
  sampleProgress = 0,
}: SurfaceOverlayProps) {
  if (state === "idle") return null;

  if (state === "scanning") {
    const pct = Math.min(100, Math.max(0, Math.round(sampleProgress * 100)));
    return (
      <div className="pointer-events-none absolute inset-0 z-10" aria-live="polite">
        <div className="absolute inset-x-[6%] h-0.5 animate-scan bg-hazard shadow-[0_0_12px_#facc15]" />
        <div className="absolute inset-0 grid place-items-center px-4">
          <div className="hud-glass flex max-w-xs flex-col items-center gap-2 rounded-xl border-primary/30 px-4 py-3 text-center text-paper">
            <div className="flex items-center gap-2">
              {handDetected ? (
                <ScanLine className="size-4 text-primary" />
              ) : (
                <Hand className="size-4 text-hazard" />
              )}
              <p className="font-mono text-xs font-bold tracking-wide text-paper">
                {handDetected ? "Hold steady · locking board" : "Rest fingers on your board"}
              </p>
            </div>
            <p className="font-mono text-[11px] text-paper/65">
              {handDetected
                ? "Measuring landmarks 5 · 8 · 9 · 12"
                : "Place index & middle tips on deck to measure scale & tilt"}
            </p>
            {handDetected && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-paper/15">
                <div
                  className="h-full bg-primary transition-[width] duration-75"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!boardLock) return null;

  const lineWidthPx = Math.round(Math.max(boardLock.deckLengthPx * 1.4, 170));
  const deckSpanPx = Math.round(boardLock.deckLengthPx);
  const tilt = boardLock.tiltAngleDeg;
  const xPct = (boardLock.centerNorm.x * 100).toFixed(2);
  const yPct = (boardLock.centerNorm.y * 100).toFixed(2);
  const gridTopPct = Math.min(82, Math.max(35, boardLock.centerNorm.y * 100)).toFixed(2);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-live="polite">
      {/* Subtle perspective horizon grid anchored to the locked board plane */}
      <div
        className="absolute inset-x-[-20%] bottom-0 surface-grid opacity-45 animate-in fade-in duration-500"
        style={{
          top: `${gridTopPct}%`,
          transform: `perspective(520px) rotateX(62deg) rotateZ(${(tilt * 0.25).toFixed(1)}deg)`,
        }}
      />

      {/* Board-anchored hazard-tape calibration line & deck footprint brackets */}
      <div
        className="absolute flex flex-col items-center animate-in fade-in duration-300"
        style={{
          left: `${xPct}%`,
          top: `${yPct}%`,
          width: `${lineWidthPx}px`,
          transform: `translate(-50%, -50%) rotate(${tilt.toFixed(2)}deg)`,
        }}
      >
        {/* Deck length bracket ticks */}
        <div
          className="relative mb-1.5 flex items-end justify-between"
          style={{ width: `${deckSpanPx}px` }}
        >
          <span className="h-2.5 w-0.5 bg-primary" aria-hidden="true" />
          <span className="h-px flex-1 bg-primary/45" aria-hidden="true" />
          <span className="h-2.5 w-0.5 bg-primary" aria-hidden="true" />
        </div>

        {/* Hazard-tape calibration line scaled & angled to the real board */}
        <div className="flex w-full items-center gap-1.5">
          <span className="h-3 w-px bg-primary/80" aria-hidden="true" />
          <div className="hazard-tape h-2 flex-1 rounded-xs border border-black/80 opacity-90 drop-hard-sm" />
          <span className="h-3 w-px bg-primary/80" aria-hidden="true" />
        </div>

        {/* Unboxed graffiti + tabular calibration telemetry */}
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] tabular-nums text-paper/85 drop-hard-sm">
          <span className="font-marker text-xs tracking-wider text-primary">BOARD LOCKED</span>
          <span className="text-paper/45" aria-hidden="true">
            ·
          </span>
          <span>{boardLock.scale.toFixed(2)}×</span>
          <span className="text-paper/45" aria-hidden="true">
            ·
          </span>
          <span>
            {tilt >= 0 ? "+" : ""}
            {tilt.toFixed(1)}°
          </span>
        </div>
      </div>
    </div>
  );
}
