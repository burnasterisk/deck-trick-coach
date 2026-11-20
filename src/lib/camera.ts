export type Facing = "user" | "environment";

/** Phones and tablets, including iPadOS which reports itself as a Mac with touch. */
export function detectMobile(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini/i.test(userAgent)) {
    return true;
  }
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Rear camera on mobile; on desktop let the browser pick the standard webcam. */
export function getDefaultFacing(isMobile: boolean): Facing | null {
  return isMobile ? "environment" : null;
}

export function flipFacing(facing: Facing | null): Facing {
  return facing === "environment" ? "user" : "environment";
}

export interface CameraRequest {
  facing: Facing | null;
  deviceId?: string;
  strict?: boolean;
}

export function buildVideoConstraints({
  facing,
  deviceId,
  strict = false,
}: CameraRequest): MediaStreamConstraints {
  const video: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 60 },
  };
  if (deviceId) {
    video.deviceId = { exact: deviceId };
  } else if (facing) {
    video.facingMode = strict ? { exact: facing } : { ideal: facing };
  }
  return { video, audio: false };
}

export type CameraErrorKind = "denied" | "not-found" | "in-use" | "unsupported" | "unknown";

export function classifyCameraError(err: unknown): CameraErrorKind {
  const name =
    err instanceof Error || (err && typeof err === "object" && "name" in err)
      ? String((err as { name: unknown }).name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "not-found";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in-use";
    case "TypeError":
      return "unsupported";
    default:
      return "unknown";
  }
}
