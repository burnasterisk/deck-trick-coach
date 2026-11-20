import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildVideoConstraints,
  classifyCameraError,
  detectMobile,
  flipFacing,
  getDefaultFacing,
  type CameraErrorKind,
  type CameraRequest,
} from "@/lib/camera";

export type CameraStatus = "idle" | "starting" | "live" | "error";

export interface CameraInfo {
  width: number;
  height: number;
  frameRate: number | null;
  label: string;
  mirrored: boolean;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestId = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [request, setRequest] = useState<CameraRequest | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [info, setInfo] = useState<CameraInfo | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Decide the starting camera once we're in the browser.
  useEffect(() => {
    const mobile = detectMobile(navigator.userAgent, navigator.maxTouchPoints);
    setIsMobile(mobile);
    setRequest({ facing: getDefaultFacing(mobile), strict: mobile });
  }, []);

  useEffect(() => {
    if (!request) return;
    const id = ++requestId.current;

    async function start(req: CameraRequest) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("unsupported");
        setStatus("error");
        return;
      }
      setStatus("starting");
      setError(null);
      stop();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(buildVideoConstraints(req));
      } catch (err) {
        // A strict rear/front request can fail on devices with one camera; retry loosely.
        if (req.strict || req.deviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(
              buildVideoConstraints({ facing: req.facing }),
            );
          } catch (retryErr) {
            if (id !== requestId.current) return;
            setError(classifyCameraError(retryErr));
            setStatus("error");
            return;
          }
        } else {
          if (id !== requestId.current) return;
          setError(classifyCameraError(err));
          setStatus("error");
          return;
        }
      }

      if (id !== requestId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => undefined);
      }

      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings() ?? {};
      const facingMode = settings.facingMode;
      setInfo({
        width: settings.width ?? 0,
        height: settings.height ?? 0,
        frameRate: settings.frameRate ? Math.round(settings.frameRate) : null,
        label: track?.label ?? "Camera",
        mirrored: facingMode ? facingMode === "user" : req.facing !== "environment",
      });
      setStatus("live");

      // Labels are only available after permission is granted.
      const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (id === requestId.current) setDevices(all.filter((d) => d.kind === "videoinput"));
    }

    void start(request);
  }, [request, stop]);

  useEffect(() => stop, [stop]);

  const flip = useCallback(() => {
    setRequest((prev) => {
      const current = prev ?? { facing: null };
      // Desktops with several webcams: cycle through them by device.
      if (!isMobile && devices.length > 1) {
        const activeId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
        const idx = devices.findIndex((d) => d.deviceId === activeId);
        const next = devices[(idx + 1) % devices.length];
        if (next) return { facing: null, deviceId: next.deviceId };
      }
      return { facing: flipFacing(current.facing), strict: isMobile };
    });
  }, [devices, isMobile]);

  const retry = useCallback(() => {
    setRequest((prev) => ({ ...(prev ?? { facing: getDefaultFacing(isMobile) }) }));
  }, [isMobile]);

  return {
    videoRef,
    status,
    error,
    info,
    isMobile,
    canFlip: isMobile || devices.length !== 1,
    flip,
    retry,
  };
}
