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
      <div className="pointer-events-auto hud-glass flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
        <span className="grid size-8 place-items-center rounded-full bg-volt font-display text-sm font-bold text-primary-foreground">
          DC
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold tracking-wide">DeckCoach</p>
          <p className="hud-label flex items-center gap-1.5 text-muted-foreground">
            <span
              className={
                live
                  ? "size-1.5 rounded-full bg-signal animate-pulse-dot"
                  : "size-1.5 rounded-full bg-muted-foreground"
              }
            />
            {live ? "Live" : status === "error" ? "No signal" : "Connecting"}
            <span className="hidden sm:inline">· {trick.name}</span>
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        {live && info && info.width > 0 && (
          <div className="hud-glass hidden rounded-full px-3 py-2 sm:block">
            <p className="hud-label text-muted-foreground">
              {info.width}×{info.height}
              {info.frameRate ? ` · ${info.frameRate}fps` : ""}
            </p>
          </div>
        )}
        <Button
          variant="hud"
          size="icon-lg"
          onClick={onFlip}
          disabled={!canFlip || status === "starting"}
          aria-label="Flip camera"
          title="Flip camera"
          className="pointer-events-auto"
        >
          <SwitchCamera />
        </Button>
      </div>
    </header>
  );
}
