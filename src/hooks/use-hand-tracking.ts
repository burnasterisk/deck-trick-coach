import { useEffect, useRef, useState } from "react";

import type { HandLandmarker } from "@mediapipe/tasks-vision";

import { createHandLandmarker, type HandTrackingStatus } from "@/lib/hand-tracking";

/**
 * Loads the hand landmarker once and runs detection on the live video each
 * animation frame, reporting index (8) and middle (12) fingertip positions in
 * [0..1] video space so the overlay can map them onto the canvas.
 */
export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  live: boolean,
) {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(-1);
  const [status, setStatus] = useState<HandTrackingStatus>("idle");
  const [tips, setTips] = useState<{ index: { x: number; y: number }; middle: { x: number; y: number } } | null>(
    null,
  );

  useEffect(() => {
    if (!enabled || !live) {
      setStatus("idle");
      setTips(null);
      return;
    }
    let cancelled = false;

    setStatus("loading");
    createHandLandmarker()
      .then((landmarker) => {
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [enabled, live]);

  useEffect(() => {
    if (status !== "ready") return;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || video.readyState < 2 || !landmarker) return;
      // MediaPipe requires monotonically increasing timestamps.
      const ts = video.currentTime * 1000;
      if (ts <= lastTsRef.current) return;
      lastTsRef.current = ts;

      try {
        const result = landmarker.detectForVideo(video, ts);
        const hand = result.landmarks[0];
        if (!hand) {
          setTips(null);
          return;
        }
        setTips({
          index: { x: hand[8].x, y: hand[8].y },
          middle: { x: hand[12].x, y: hand[12].y },
        });
      } catch {
        setTips(null);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, videoRef]);

  return { status, tips };
}
