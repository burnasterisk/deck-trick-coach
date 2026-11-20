import { useEffect, useRef, useState } from "react";

import type { HandLandmarker } from "@mediapipe/tasks-vision";

import type { HandBoardLandmarks } from "@/lib/board-calibration";
import { extractHandKinematics, type HandKinematics } from "@/lib/hand-kinematics";
import { createHandLandmarker, type HandTrackingStatus } from "@/lib/hand-tracking";
import type { Tips } from "@/lib/trick-analyzer";

/**
 * Loads the hand landmarker once and runs detection on the live video each
 * animation frame, reporting fingertips (8, 12), board-calibration landmarks
 * (5, 8, 9, 12), and full hand kinematics (wrist rotation + finger curl).
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
  const [tips, setTips] = useState<Tips | null>(null);
  const [handPose, setHandPose] = useState<HandBoardLandmarks | null>(null);
  const [kinematics, setKinematics] = useState<HandKinematics | null>(null);

  useEffect(() => {
    if (!enabled || !live) {
      setStatus("idle");
      setTips(null);
      setHandPose(null);
      setKinematics(null);
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
        const lm5 = hand?.[5];
        const lm8 = hand?.[8];
        const lm9 = hand?.[9];
        const lm12 = hand?.[12];

        if (!hand || !lm5 || !lm8 || !lm9 || !lm12) {
          setTips(null);
          setHandPose(null);
          setKinematics(null);
          return;
        }

        const indexTip = { x: lm8.x, y: lm8.y };
        const middleTip = { x: lm12.x, y: lm12.y };

        setTips({
          index: indexTip,
          middle: middleTip,
        });
        setHandPose({
          indexMcp: { x: lm5.x, y: lm5.y },
          indexTip,
          middleMcp: { x: lm9.x, y: lm9.y },
          middleTip,
        });
        setKinematics(extractHandKinematics(hand, false));
      } catch {
        setTips(null);
        setHandPose(null);
        setKinematics(null);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, videoRef]);

  return { status, tips, handPose, kinematics };
}
