import { useEffect, useRef, useState } from "react";

import {
  analyzeBoardPatch,
  BOARD_ROI_H,
  BOARD_ROI_W,
  computeBoardRoi,
  rgbaToGray,
  type BoardTrackTelemetry,
} from "@/lib/board-tracker";
import type { Tips } from "@/lib/trick-analyzer";

export interface LiveBoardState {
  telemetry: BoardTrackTelemetry | null;
  liveFlipDeg: number;
}

/**
 * Lightweight real-time computer-vision board tracker running beneath the
 * tracked fingertips via a 64x40 offscreen ROI, high-contrast bounding-box
 * PCA pitch estimation, and block-matching optical flow.
 */
export function useBoardTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  tips: Tips | null,
  live: boolean,
  mirrored: boolean,
  deckLengthNorm?: number,
): LiveBoardState {
  const [telemetry, setTelemetry] = useState<BoardTrackTelemetry | null>(null);
  const [liveFlipDeg, setLiveFlipDeg] = useState(0);

  const tipsRef = useRef(tips);
  const mirroredRef = useRef(mirrored);
  const deckLengthNormRef = useRef(deckLengthNorm);
  tipsRef.current = tips;
  mirroredRef.current = mirrored;
  deckLengthNormRef.current = deckLengthNorm;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevGrayRef = useRef<Float32Array | null>(null);
  const lastTsRef = useRef(-1);
  const lastSampleAtRef = useRef(0);
  const flipAccumRef = useRef(0);
  const lastSpinAtRef = useRef(0);

  useEffect(() => {
    if (!live) {
      prevGrayRef.current = null;
      setTelemetry(null);
      setLiveFlipDeg(0);
      return;
    }

    if (!canvasRef.current && typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = BOARD_ROI_W;
      c.height = BOARD_ROI_H;
      canvasRef.current = c;
    }

    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const currentTips = tipsRef.current;

      if (!video || !canvas || video.readyState < 2 || !currentTips) {
        prevGrayRef.current = null;
        flipAccumRef.current = 0;
        if (!currentTips) {
          setTelemetry(null);
          setLiveFlipDeg(0);
        }
        return;
      }

      const ts = video.currentTime * 1000;
      if (ts <= lastTsRef.current) return;
      const dtMs = lastSampleAtRef.current > 0 ? Math.max(8, now - lastSampleAtRef.current) : 16;
      lastTsRef.current = ts;
      lastSampleAtRef.current = now;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const roi = computeBoardRoi(currentTips, deckLengthNormRef.current ?? 0.24);

      const sx = Math.floor(roi.x * vw);
      const sy = Math.floor(roi.y * vh);
      const sw = Math.max(8, Math.floor(roi.width * vw));
      const sh = Math.max(8, Math.floor(roi.height * vh));

      try {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, BOARD_ROI_W, BOARD_ROI_H);
        const img = ctx.getImageData(0, 0, BOARD_ROI_W, BOARD_ROI_H);
        const gray = rgbaToGray(img.data, BOARD_ROI_W * BOARD_ROI_H);

        const result = analyzeBoardPatch(
          gray,
          prevGrayRef.current,
          roi,
          dtMs,
          BOARD_ROI_W,
          BOARD_ROI_H,
        );
        prevGrayRef.current = gray;

        const orientedPitch = mirroredRef.current ? -result.pitchDeg : result.pitchDeg;
        const orientedResult: BoardTrackTelemetry = {
          ...result,
          pitchDeg: orientedPitch,
        };

        if (result.detected && result.flipRateDegPerSec > 120) {
          flipAccumRef.current += result.flipRateDegPerSec * (dtMs / 1000);
          lastSpinAtRef.current = now;
        } else if (now - lastSpinAtRef.current > 650) {
          flipAccumRef.current = 0;
        }

        setTelemetry(orientedResult);
        setLiveFlipDeg(Math.round(flipAccumRef.current));
      } catch {
        prevGrayRef.current = null;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, videoRef]);

  return { telemetry, liveFlipDeg };
}
