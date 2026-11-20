import { SwitchCamera } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CameraInfo, CameraStatus } from "@/hooks/use-camera";
import type { Trick } from "@/lib/tricks";

interface TopBarProps {
  status: CameraStatus;
  info: CameraInfo | null;
  trick: Trick;
  canFlip: boolean;
  onFlip: () => void;
}

export function TopBar({ status, info, trick, canFlip, onFlip }: TopBarProps) {
  const live = status === "live";
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-safe pt-safe">
      {/* Hand-stamped stencil logo on a scrap of grip tape */}
      <div className="pointer-events-auto flex -rotate-2 items-center gap-3 border-2 border-ink bg-asphalt grain-light py-1.5 pr-3 pl-2 hard-shadow sticker-edge">
        <div className="stamp rotate-[-3deg] border-[3px] border-primary px-1.5 pt-1 pb-0.5 text-primary">
          <p className="font-display text-xl leading-[0.85] tracking-wide sm:text-2xl">DECK</p>
          <p className="font-display text-xl leading-[0.85] tracking-wide sm:text-2xl">COACH</p>
        </div>
        <div className="leading-tight">
          <p className="hud-label flex items-center gap-1.5 text-paper">
            <span
              className={
                live
                  ? "size-2 rounded-full bg-hazard animate-pulse-dot"
                  : "size-2 rounded-full bg-concrete"
              }
            />
            {live ? "Rolling" : status === "error" ? "No tape" : "Loading"}
          </p>
          <p className="mt-0.5 font-marker text-sm text-primary">{trick.name}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        {live && info && info.width > 0 && (
          <div className="hidden rotate-1 bg-ink px-2.5 py-1.5 hard-shadow-sm sm:block">
            <p className="hud-label text-paper">
              <span className="text-hazard">CAM</span> {info.width}×{info.height}
              {info.frameRate ? ` · ${info.frameRate}FPS` : ""}
            </p>
          </div>
        )}
        <Button
          variant="slab"
          size="icon-lg"
          onClick={onFlip}
          disabled={!canFlip || status === "starting"}
          aria-label="Flip camera"
          title="Flip camera"
          className="pointer-events-auto rotate-2"
        >
          <SwitchCamera />
        </Button>
      </div>
    </header>
  );
}
