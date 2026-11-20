import { Loader2, RefreshCw } from "lucide-react";
import { type RefObject } from "react";

import type { CameraInfo, CameraStatus } from "@/hooks/use-camera";
import type { CameraErrorKind } from "@/lib/camera";
import { cn } from "@/lib/utils";

import { BrickSpot } from "./BrickSpot";

const ERROR_COPY: Record<CameraErrorKind, { title: string; body: string }> = {
  denied: {
    title: "Camera access blocked",
    body: "Allow camera access in your browser settings and tap retry. Everything else still works without it.",
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
    <div className="absolute inset-0 overflow-hidden bg-background">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          live ? "opacity-100" : "opacity-0",
          info?.mirrored && "-scale-x-100",
        )}
      />

      {/* Measured edge scrims for HUD contrast without clouding the central 85% camera space */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 to-transparent" />

      {/* Minimalist perimeter reticle corners keeping the entire center frame open */}
      <div className="pointer-events-none absolute inset-3 sm:inset-5">
        <span className="absolute top-0 left-0 size-4 border-t border-l border-uv/45" />
        <span className="absolute top-0 right-0 size-4 border-t border-r border-uv/45" />
        <span className="absolute bottom-0 left-0 size-4 border-b border-l border-uv/45" />
        <span className="absolute bottom-0 right-0 size-4 border-b border-r border-uv/45" />
      </div>

      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="hud-glass flex items-center gap-3 rounded-lg px-4 py-2.5 text-paper">
            <Loader2 className="size-4 animate-spin text-primary" />
            <p className="font-mono text-xs tracking-wide">Starting camera…</p>
          </div>
        </div>
      )}

      {/* No camera: never block. Swap in the brick-wall demo spot and a low-key corner pill. */}
      {status === "error" && copy && (
        <>
          <BrickSpot />
          <div className="pointer-events-auto absolute top-16 right-3 z-30 flex items-center gap-2 border border-hazard/50 bg-black/70 py-1 pr-1 pl-2.5 font-mono text-[10px] font-bold tracking-wider text-hazard backdrop-blur-md sm:right-5">
            <span title={copy.body}>NO CAM // BRICK SPOT DEMO</span>
            <button
              type="button"
              onClick={onRetry}
              aria-label={`${copy.title}. Try the camera again`}
              title={`${copy.title}. ${copy.body}`}
              className="grid size-6 cursor-pointer place-items-center bg-hazard/15 text-hazard press hover:bg-hazard/30 focus-visible:ring-2 focus-visible:ring-uv focus-visible:outline-none"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
