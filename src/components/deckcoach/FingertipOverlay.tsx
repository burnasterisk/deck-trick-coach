import { useEffect, useRef } from "react";

import type { BoardCalibration, HandBoardLandmarks } from "@/lib/board-calibration";
import type { BoardTrackTelemetry } from "@/lib/board-tracker";
import type { Trick } from "@/lib/tricks";

interface TipPoint {
  x: number;
  y: number;
}

interface TrailPoint {
  index: TipPoint;
  middle: TipPoint;
  t: number;
}

const TRAIL_MS = 420;

export interface FingertipOverlayProps {
  tips: { index: TipPoint; middle: TipPoint } | null;
  handPose?: HandBoardLandmarks | null;
  boardLock?: BoardCalibration | null;
  boardTrack?: BoardTrackTelemetry | null;
  liveFlipDeg?: number;
  trick?: Trick;
  showVisuals?: boolean;
  scanning?: boolean;
  /** True when the video is mirrored (front camera) — landmarks must flip too. */
  mirrored: boolean;
}

/**
 * Renders spray-paint tracking dots, motion trails, trick-specific directional
 * flick/scoop vector arrows, and real-time board bounding-box + optical-flow HUD.
 */
export function FingertipOverlay({
  tips,
  handPose = null,
  boardLock = null,
  boardTrack = null,
  liveFlipDeg = 0,
  trick,
  showVisuals = true,
  scanning = false,
  mirrored,
}: FingertipOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipsRef = useRef(tips);
  const handPoseRef = useRef(handPose);
  const boardLockRef = useRef(boardLock);
  const boardTrackRef = useRef(boardTrack);
  const liveFlipRef = useRef(liveFlipDeg);
  const trickRef = useRef(trick);
  const showVisualsRef = useRef(showVisuals);
  const scanningRef = useRef(scanning);
  const mirroredRef = useRef(mirrored);
  const trailRef = useRef<TrailPoint[]>([]);

  tipsRef.current = tips;
  handPoseRef.current = handPose;
  boardLockRef.current = boardLock;
  boardTrackRef.current = boardTrack;
  liveFlipRef.current = liveFlipDeg;
  trickRef.current = trick;
  showVisualsRef.current = showVisuals;
  scanningRef.current = scanning;
  mirroredRef.current = mirrored;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const px = (p: TipPoint): [number, number] => [
      (mirroredRef.current ? 1 - p.x : p.x) * canvas.width,
      p.y * canvas.height,
    ];

    const sprayDot = (p: TipPoint, color: string, radius: number, now: number) => {
      const [x, y] = px(p);
      const wobble = Math.sin(now / 90 + x) * 0.06;

      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.25 * (1 + wobble), 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = radius * (1.4 + Math.random() * 1.6);
        ctx.globalAlpha = 0.12 + Math.random() * 0.2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, radius * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawDirectionalArrow = (
      origin: [number, number],
      cp: [number, number],
      end: [number, number],
      color: string,
      label: string,
      now: number,
      scaleMult: number,
    ) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6 * scaleMult * dpr;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 * dpr;
      ctx.setLineDash([7 * dpr, 5 * dpr]);
      ctx.lineDashOffset = -(now / 26) * dpr;

      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.quadraticCurveTo(cp[0], cp[1], end[0], end[1]);
      ctx.stroke();

      // Solid arrowhead oriented along the final tangent (cp -> end).
      ctx.setLineDash([]);
      const angle = Math.atan2(end[1] - cp[1], end[0] - cp[0]);
      const headLen = 10 * scaleMult * dpr;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(
        end[0] - headLen * Math.cos(angle - Math.PI / 6),
        end[1] - headLen * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        end[0] - headLen * Math.cos(angle + Math.PI / 6),
        end[1] - headLen * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();

      // Crisp action tag near the arrow tip.
      ctx.shadowBlur = 4 * dpr;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.font = `700 ${Math.round(10 * dpr)}px "Space Mono", monospace`;
      const tx = end[0] + Math.cos(angle) * 8 * dpr;
      const ty = end[1] + Math.sin(angle) * 8 * dpr;
      ctx.textAlign = Math.cos(angle) >= 0 ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(label, tx, ty);
      ctx.restore();
    };

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const lock = boardLockRef.current;
      const scaleMult = lock ? Math.min(1.6, Math.max(0.65, lock.scale)) : 1;
      const visualsOn = showVisualsRef.current;

      // While scanning for Lock Board, draw the 5-8-9-12 measurement quad live.
      const pose = handPoseRef.current;
      if (scanningRef.current && pose) {
        const [x5, y5] = px(pose.indexMcp);
        const [x8, y8] = px(pose.indexTip);
        const [x9, y9] = px(pose.middleMcp);
        const [x12, y12] = px(pose.middleTip);

        ctx.strokeStyle = "rgba(139,92,246,0.78)";
        ctx.lineWidth = 1.75 * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(x5, y5);
        ctx.lineTo(x8, y8);
        ctx.lineTo(x12, y12);
        ctx.lineTo(x9, y9);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        for (const [kx, ky] of [
          [x5, y5],
          [x9, y9],
        ] as const) {
          ctx.fillStyle = "rgba(244,242,237,0.9)";
          ctx.beginPath();
          ctx.arc(kx, ky, 4 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!visualsOn) {
        trailRef.current = [];
        return;
      }

      const current = tipsRef.current;
      if (current) {
        trailRef.current.push({ index: current.index, middle: current.middle, t: now });
      }
      const cutoff = now - TRAIL_MS;
      trailRef.current = trailRef.current.filter((p) => p.t >= cutoff);

      // 1. Lightweight real-time board bounding-box + optical-flow overlay beneath fingertips.
      const track = boardTrackRef.current;
      if (track && track.detected) {
        const box = track.boundingBox;
        const bx1 = (mirroredRef.current ? 1 - (box.x + box.width) : box.x) * w;
        const by1 = box.y * h;
        const bw = box.width * w;
        const bh = box.height * h;
        const isAlert = track.primoScore >= 0.55 || Math.abs(track.pitchDeg) >= 18;
        const boxColor = isAlert ? "rgba(220,38,38, 0.9)" : "rgba(139,92,246, 0.72)";
        const corner = Math.min(14 * dpr, bw * 0.22, bh * 0.35);

        ctx.save();
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 1.75 * dpr;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(bx1, by1 + corner);
        ctx.lineTo(bx1, by1);
        ctx.lineTo(bx1 + corner, by1);
        // Top-right
        ctx.moveTo(bx1 + bw - corner, by1);
        ctx.lineTo(bx1 + bw, by1);
        ctx.lineTo(bx1 + bw, by1 + corner);
        // Bottom-right
        ctx.moveTo(bx1 + bw, by1 + bh - corner);
        ctx.lineTo(bx1 + bw, by1 + bh);
        ctx.lineTo(bx1 + bw - corner, by1 + bh);
        // Bottom-left
        ctx.moveTo(bx1 + corner, by1 + bh);
        ctx.lineTo(bx1, by1 + bh);
        ctx.lineTo(bx1, by1 + bh - corner);
        ctx.stroke();

        // Optical-flow motion vectors inside the board box
        ctx.strokeStyle = "rgba(244, 242, 237, 0.65)";
        ctx.lineWidth = 1.25 * dpr;
        for (const fv of track.flowVectors) {
          const [fx, fy] = px(fv);
          const fvx = (mirroredRef.current ? -fv.vx : fv.vx) * w * 2.5;
          const fvy = fv.vy * h * 2.5;
          if (Math.hypot(fvx, fvy) < 1.5 * dpr) continue;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + fvx, fy + fvy);
          ctx.stroke();
        }

        // Crisp live board telemetry readout
        const pitchSign = track.pitchDeg >= 0 ? "+" : "";
        const flipTxt = liveFlipRef.current > 15 ? ` · FLIP ${liveFlipRef.current}°` : "";
        const statusTxt = track.primoScore >= 0.62 ? " · PRIMO" : "";
        ctx.font = `700 ${Math.round(10 * dpr)}px "Space Mono", monospace`;
        ctx.fillStyle = boxColor;
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = 4 * dpr;
        ctx.fillText(
          `PITCH ${pitchSign}${Math.round(track.pitchDeg)}°${flipTxt}${statusTxt}`,
          bx1,
          by1 + bh + 13 * dpr,
        );
        ctx.restore();
      }

      // 2. Motion-trail ribbons.
      const trail = trailRef.current;
      if (trail.length >= 2) {
        const firstPoint = trail[0];
        if (firstPoint) {
          for (const side of ["index", "middle"] as const) {
            ctx.beginPath();
            const first = px(firstPoint[side]);
            ctx.moveTo(first[0], first[1]);
            for (let i = 1; i < trail.length; i++) {
              const item = trail[i];
              if (!item) continue;
              const p = px(item[side]);
              ctx.lineTo(p[0], p[1]);
            }
            for (let i = trail.length - 1; i >= 0; i--) {
              const item = trail[i];
              if (!item) continue;
              const age = (now - item.t) / TRAIL_MS;
              const spread = (5 + 22 * age) * scaleMult * dpr;
              const p = px(item[side]);
              ctx.lineTo(p[0], p[1] + spread);
            }
            for (let i = 0; i < trail.length; i++) {
              const item = trail[i];
              if (!item) continue;
              const age = (now - item.t) / TRAIL_MS;
              const spread = (5 + 22 * age) * scaleMult * dpr;
              const p = px(item[side]);
              ctx.lineTo(p[0], p[1] - spread);
            }
            ctx.closePath();
            ctx.fillStyle = side === "index" ? "rgba(139,92,246,0.13)" : "rgba(220,38,38,0.13)";
            ctx.fill();
          }
        }
      }

      // 3. Fingertip spray dots, connector, and trick-specific flick/scoop directional vectors.
      if (current) {
        const [ix, iy] = px(current.index);
        const [mx, my] = px(current.middle);

        ctx.strokeStyle = "rgba(139,92,246,0.65)";
        ctx.lineWidth = 2 * scaleMult * dpr;
        ctx.lineCap = "round";
        ctx.setLineDash([8 * scaleMult * dpr, 6 * scaleMult * dpr]);
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);

        // Compute deck-aligned local basis from middle (tail) -> index (nose).
        const dx = ix - mx;
        const dy = iy - my;
        const tipDistPx = Math.hypot(dx, dy);
        if (tipDistPx > 6) {
          const ux = dx / tipDistPx;
          const uy = dy / tipDistPx;
          // Ensure -perp consistently points upward on screen regardless of left/right nose facing.
          const sign = ux >= 0 ? 1 : -1;
          const perpX = -uy * sign;
          const perpY = ux * sign;
          const unitLen = lock
            ? lock.deckLengthPx * 0.34 * dpr
            : Math.max(46 * dpr, tipDistPx * 0.72);

          const activeTrick = trickRef.current;
          if (activeTrick) {
            for (const vec of activeTrick.fingerVectors) {
              const base = vec.finger === "index" ? [ix, iy] : [mx, my];
              const p0 = vec.points[0];
              const p1 = vec.points[1];
              const p2 = vec.points[2];
              if (!p0 || !p1 || !p2) continue;

              const toScreen = (pt: { along: number; perp: number }): [number, number] => [
                (base[0] ?? 0) + (ux * pt.along + perpX * pt.perp) * unitLen,
                (base[1] ?? 0) + (uy * pt.along + perpY * pt.perp) * unitLen,
              ];

              const color = vec.tone === "primary" ? "#8B5CF6" : "#DC2626";
              drawDirectionalArrow(
                toScreen(p0),
                toScreen(p1),
                toScreen(p2),
                color,
                vec.label,
                now,
                scaleMult,
              );
            }
          }
        }

        const dotRadius = 8.5 * scaleMult * dpr;
        sprayDot(current.index, "rgba(139,92,246,1)", dotRadius, now);
        sprayDot(current.middle, "rgba(220,38,38,1)", dotRadius, now);
      }
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[18] h-full w-full mix-blend-screen"
    />
  );
}
