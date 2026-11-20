import { ScanLine } from "lucide-react";

import type { CalibrationState } from "./ControlBar";

export function SurfaceOverlay({ state }: { state: CalibrationState }) {
  if (state === "idle") return null;

  if (state === "scanning") {
    return (
      <div className="pointer-events-none absolute inset-0 z-10" aria-live="polite">
        <div className="absolute inset-x-[6%] h-1 animate-scan bg-hazard blur-[1.5px]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="drop-hard -rotate-2">
            <div className="torn-tape flex items-center gap-2 bg-tape grain px-6 py-2 text-tape-foreground">
              <ScanLine className="size-4" />
              <p className="hud-label">Hold steady · reading surface</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-live="polite">
      <div className="absolute inset-x-[-30%] bottom-0 h-[55%] surface-grid animate-in fade-in duration-700" />
      <div className="absolute inset-x-0 bottom-[38%] flex justify-center sm:bottom-[30%]">
        <p className="animate-slap -rotate-3 border-[3px] border-ink bg-primary grain px-3 py-1 font-marker text-lg text-primary-foreground hard-shadow sticker-edge">
          Surface locked
        </p>
      </div>
    </div>
  );
}
