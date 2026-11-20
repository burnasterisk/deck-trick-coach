import { CameraOff, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { CameraInfo, CameraStatus } from "@/hooks/use-camera";
import type { CameraErrorKind } from "@/lib/camera";
import { cn } from "@/lib/utils";

const ERROR_COPY: Record<CameraErrorKind, { title: string; body: string }> = {
  denied: {
    title: "Camera access blocked",
    body: "Allow camera access in your browser settings, then try again. If you're inside an embedded preview, open DeckCoach in its own tab.",
  },
  "not-found": {
    title: "No camera found",
    body: "Connect a webcam or switch to a device with a camera.",
  },
  "in-use": {
    title: "Camera is busy",
    body: "Another app may be using the camera. Close it and try again.",
  },
  unsupported: {
    title: "Camera not supported here",
    body: "This browser can't open the camera. Use Safari or Chrome over a secure (https) connection.",
  },
  unknown: {
    title: "Couldn't start the camera",
    body: "Something went wrong opening the camera. Try again.",
  },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Camcorder-style tape counter (HH:MM:SS:FF at 30fps), runs only while live. */
function Timecode({ running }: { running: boolean }) {
  const [frames, setFrames] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const id = setInterval(() => {
      setFrames(Math.floor(((performance.now() - start) / 1000) * 30));
    }, 1000 / 15);
    return () => clearInterval(id);
  }, [running]);
  const s = Math.floor(frames / 30);
  return (
    <span className="tabular-nums">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor(s / 60) % 60)}:{pad(s % 60)}:{pad(frames % 30)}
    </span>
  );
}

interface ViewfinderProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: CameraErrorKind | null;
  info: CameraInfo | null;
  onRetry: () => void;
}

export function Viewfinder({ videoRef, status, error, info, onRetry }: ViewfinderProps) {
  const copy = error ? ERROR_COPY[error] : null;
  const live = status === "live";
  return (
    <div className="absolute inset-0 overflow-hidden bg-background grain-light">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        className={cn(
          "h-full w-full object-cover contrast-[1.08] saturate-[0.9] transition-opacity duration-500",
          live ? "opacity-100" : "opacity-0",
          info?.mirrored && "-scale-x-100",
        )}
      />

      {/* VX1000 LCD feel: scanlines, grit, heavy fisheye-style vignette */}
      <div className="pointer-events-none absolute inset-0 vx-lcd opacity-60" />
      <div className="pointer-events-none absolute inset-0 grain-light opacity-25 mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-vignette" />

      {/* Viewfinder frame */}
      <div className="pointer-events-none absolute inset-[10%] sm:inset-[12%]">
        {[
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((c) => (
          <span key={c} className={cn("absolute size-6 border-paper/80", c)} />
        ))}

        {/* Center crosshair with open middle */}
        <div className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute top-1/2 left-0 h-0.5 w-5 -translate-y-1/2 bg-paper/80" />
          <span className="absolute top-1/2 right-0 h-0.5 w-5 -translate-y-1/2 bg-paper/80" />
          <span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-paper/80" />
          <span className="absolute bottom-0 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-paper/80" />
          <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 bg-hazard" />
        </div>

        {/* Tape status, top-left inside frame */}
        <div className="absolute top-3 left-3 hud-label flex items-center gap-2 text-sm text-paper">
          {live ? (
            <>
              <span className="size-2.5 rounded-full bg-hazard animate-pulse-dot" />
              <span className="text-hazard">REC</span>
            </>
          ) : (
            <span className="text-paper/70">STBY</span>
          )}
          <Timecode running={live} />
        </div>

        {/* Tape speed + battery, bottom-right inside frame */}
        <div className="absolute right-3 bottom-3 hud-label hidden items-center gap-2 text-sm text-paper sm:flex">
          <span>SP</span>
          <span className="flex h-3.5 items-stretch gap-0.5 border-2 border-paper p-0.5" aria-hidden>
            <span className="w-1.5 bg-paper" />
            <span className="w-1.5 bg-paper" />
            <span className="w-1.5 bg-paper" />
            <span className="w-1.5 bg-paper/20" />
          </span>
        </div>
      </div>

      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-paper">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="hud-label">Loading tape…</p>
          </div>
        </div>
      )}

      {status === "error" && copy && (
        <div className="absolute inset-0 z-40 grid place-items-center p-6">
          <div className="relative max-w-sm -rotate-1 animate-slap drop-hard">
            <span className="tape-tab -top-2 left-6 z-10 -rotate-6" />
            <span className="tape-tab -top-2 right-6 z-10 rotate-6" />
            <div className="torn-paper bg-paper grain px-6 pt-8 pb-7 text-center text-paper-foreground">
              <span className="mx-auto mb-3 grid size-12 place-items-center border-[3px] border-ink bg-hazard text-hazard-foreground sticker-edge">
                <CameraOff className="size-5" />
              </span>
              <h2 className="font-display text-2xl leading-tight">{copy.title}</h2>
              <p className="mt-2 text-sm">{copy.body}</p>
              <Button variant="hazard" size="pill" className="mt-5 rotate-1" onClick={onRetry}>
                <RefreshCw />
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
