import { CameraOff, Loader2, RefreshCw } from "lucide-react";
import type { RefObject } from "react";

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

interface ViewfinderProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: CameraErrorKind | null;
  info: CameraInfo | null;
  onRetry: () => void;
}

export function Viewfinder({ videoRef, status, error, info, onRetry }: ViewfinderProps) {
  const copy = error ? ERROR_COPY[error] : null;
  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          status === "live" ? "opacity-100" : "opacity-0",
          info?.mirrored && "-scale-x-100",
        )}
      />

      <div className="pointer-events-none absolute inset-0 bg-vignette" />

      {/* Framing brackets */}
      <div className="pointer-events-none absolute inset-[10%] sm:inset-[12%]">
        {[
          "top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
          "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
          "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
          "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl",
        ].map((c) => (
          <span key={c} className={cn("absolute size-8 border-foreground/40", c)} />
        ))}
        <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/40" />
      </div>

      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="hud-label">Opening camera</p>
          </div>
        </div>
      )}

      {status === "error" && copy && (
        <div className="absolute inset-0 z-40 grid place-items-center p-6">
          <div className="hud-glass max-w-sm animate-float-in rounded-3xl p-6 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-signal/15 text-signal">
              <CameraOff className="size-5" />
            </span>
            <h2 className="font-display text-lg font-semibold">{copy.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
            <Button variant="volt" size="pill" className="mt-5 font-display" onClick={onRetry}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
