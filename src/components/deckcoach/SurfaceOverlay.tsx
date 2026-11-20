import { ScanLine } from "lucide-react";

import type { CalibrationState } from "./ControlBar";

export function SurfaceOverlay({ state }: { state: CalibrationState }) {
  if (state === "idle") return null;

  if (state === "scanning") {
    return (
      <div className="pointer-events-none absolute inset-0 z-10" aria-live="polite">
        <div className="absolute inset-x-[6%] h-0.5 animate-scan bg-volt shadow-volt" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="hud-glass flex items-center gap-2 rounded-full px-4 py-2">
            <ScanLine className="size-4 text-primary" />
            <p className="hud-label text-foreground">Hold steady · reading surface</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-live="polite">
      <div className="absolute inset-x-[-30%] bottom-0 h-[55%] surface-grid animate-in fade-in duration-700" />
      <div className="absolute inset-x-0 bottom-[38%] flex justify-center sm:bottom-[30%]">
        <p className="hud-glass hud-label rounded-full px-3 py-1.5 text-primary">
          Surface locked
        </p>
      </div>
    </div>
  );
}
