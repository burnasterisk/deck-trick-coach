import { useEffect, useRef, useState } from "react";

import type { BoardCalibration, HandBoardLandmarks, ViewportSize } from "@/lib/board-calibration";
import {
  GHOST_LOOP_DURATION_MS,
  projectGhostDeck,
  resolveGhostAnchor,
  sampleGhostPose,
  smoothGhostAnchor,
  type GhostAnchor,
} from "@/lib/ghost-preview";
import type { DeckSetupId } from "@/lib/setup";
import type { Tips } from "@/lib/trick-analyzer";
import type { Trick } from "@/lib/tricks";
import { cn } from "@/lib/utils";

interface GhostDeckProps {
  trick: Trick;
  setup: DeckSetupId;
  tips: Tips | null;
  handPose: HandBoardLandmarks | null;
  boardLock?: BoardCalibration | null;
  viewport: ViewportSize;
  mirrored: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function GhostDeck({
  trick,
  setup,
  tips,
  handPose,
  boardLock = null,
  viewport,
  mirrored,
}: GhostDeckProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trickRef = useRef(trick);
  const setupRef = useRef(setup);
  const tipsRef = useRef(tips);
  const handPoseRef = useRef(handPose);
  const boardLockRef = useRef(boardLock);
  const viewportRef = useRef(viewport);
  const mirroredRef = useRef(mirrored);

  trickRef.current = trick;
  setupRef.current = setup;
  tipsRef.current = tips;
  handPoseRef.current = handPose;
  boardLockRef.current = boardLock;
  viewportRef.current = viewport;
  mirroredRef.current = mirrored;

  const anchorRef = useRef<GhostAnchor | null>(null);
  const restAvgYRef = useRef<number | null>(null);
  const lastStepRef = useRef<0 | 1 | 2>(0);
  const lastMetricRef = useRef("");

  const [activeStep, setActiveStep] = useState<0 | 1 | 2>(0);
  const [phaseReadout, setPhaseReadout] = useState(() => `${trick.preview.popAngleDeg}° POP`);
  const [calloutPos, setCalloutPos] = useState<{
    x: number;
    y: number;
    anchored: boolean;
    scale: number;
  }>(() => ({
    x: viewport.width * 0.5,
    y: viewport.height * 0.24,
    anchored: false,
    scale: 1,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = 1;
    const startAt = performance.now();
    let lastHudSyncAt = 0;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = (canvas.clientWidth || viewportRef.current.width) * dpr;
      canvas.height = (canvas.clientHeight || viewportRef.current.height) * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const drawLoop = (now: number) => {
      raf = requestAnimationFrame(drawLoop);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const curTrick = trickRef.current;
      const curSetup = setupRef.current;
      const curTips = tipsRef.current;
      const curPose = handPoseRef.current;
      const curLock = boardLockRef.current;
      const curViewport = viewportRef.current;
      const isMirrored = mirroredRef.current;

      // Track resting hand surface elevation so jumping into a real attempt doesn't pull the anchor mid-air.
      let handIsAirborne = false;
      if (curTips) {
        const avgY = (curTips.index.y + curTips.middle.y) / 2;
        const refY = curLock?.surfaceY ?? restAvgYRef.current ?? avgY;
        if (refY - avgY > 0.085) {
          handIsAirborne = true;
        } else {
          restAvgYRef.current =
            restAvgYRef.current === null ? avgY : restAvgYRef.current * 0.88 + avgY * 0.12;
        }
      } else if (!curLock) {
        restAvgYRef.current = null;
      }

      const nextAnchor = resolveGhostAnchor({
        handPose: handIsAirborne ? null : curPose,
        tips: handIsAirborne ? null : curTips,
        boardLock: curLock,
        viewport: curViewport,
        mirrored: isMirrored,
      });

      const anchor =
        handIsAirborne && anchorRef.current
          ? anchorRef.current
          : smoothGhostAnchor(anchorRef.current, nextAnchor, 0.24);
      anchorRef.current = anchor;

      const elapsed = now - startAt;
      const progress = reducedMotion
        ? 0.46
        : (elapsed % GHOST_LOOP_DURATION_MS) / GHOST_LOOP_DURATION_MS;
      const pose = sampleGhostPose(curTrick, progress, curSetup);
      const proj = projectGhostDeck(pose, anchor, curSetup);

      if (
        pose.stepIndex !== lastStepRef.current ||
        pose.phaseReadout !== lastMetricRef.current ||
        now - lastHudSyncAt > 140
      ) {
        lastStepRef.current = pose.stepIndex;
        lastMetricRef.current = pose.phaseReadout;
        lastHudSyncAt = now;
        setActiveStep(pose.stepIndex);
        setPhaseReadout(pose.phaseReadout);
        setCalloutPos({
          x: anchor.centerPx.x,
          y: anchor.centerPx.y - anchor.deckLengthPx * (pose.catchHeightNorm + 0.34),
          anchored: anchor.anchoredToHand,
          scale: anchor.scale,
        });
      }

      const toCanvas = (x: number, y: number): [number, number] => [x * dpr, y * dpr];
      const scaleMult = clamp(anchor.scale, 0.65, 1.55);

      ctx.save();

      // 1. Surface launch baseline & tail pivot marker
      const [bx1, by1] = toCanvas(proj.baseline[0].x, proj.baseline[0].y);
      const [bx2, by2] = toCanvas(proj.baseline[1].x, proj.baseline[1].y);
      ctx.strokeStyle = "rgba(244, 242, 237, 0.26)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([5 * dpr, 5 * dpr]);
      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Catch height target bracket (left side of launch arc)
      const [ax, ay] = toCanvas(proj.catchApexPx.x, proj.catchApexPx.y);
      const [cx0, cy0] = toCanvas(anchor.centerPx.x, anchor.centerPx.y);
      ctx.strokeStyle =
        pose.stepIndex === 2 ? "rgba(139,92,246, 0.55)" : "rgba(139,92,246, 0.22)";
      ctx.lineWidth = 1.25 * dpr;
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);

      // Catch height tick bar
      const tickHalf = 14 * scaleMult * dpr;
      ctx.strokeStyle =
        pose.stepIndex === 2 ? "rgba(139,92,246, 0.85)" : "rgba(139,92,246, 0.36)";
      ctx.lineWidth = 1.75 * dpr;
      ctx.beginPath();
      ctx.moveTo(ax - tickHalf, ay);
      ctx.lineTo(ax + tickHalf, ay);
      ctx.stroke();

      // 3. Pop angle wedge indicator at tail pivot during snap/launch
      if (pose.pitchDeg > 4) {
        const [px, py] = toCanvas(proj.tailPivotPx.x, proj.tailPivotPx.y);
        const arcR = Math.max(22, anchor.deckLengthPx * 0.2) * dpr;
        const baseAngle = anchor.tiltAngleRad + (anchor.noseSign === 1 ? 0 : Math.PI);
        const popRad = (pose.pitchDeg * Math.PI) / 180;
        const startA = baseAngle;
        const endA = anchor.noseSign === 1 ? baseAngle - popRad : baseAngle + popRad;

        ctx.strokeStyle = "rgba(220,38,38, 0.78)";
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(px, py, arcR, startA, endA, anchor.noseSign === 1);
        ctx.stroke();

        ctx.fillStyle = "rgba(220,38,38, 0.16)";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, arcR, startA, endA, anchor.noseSign === 1);
        ctx.closePath();
        ctx.fill();
      }

      // 4. Translucent Futuristic-Graffiti 3D Ghost Deck body
      if (proj.outline.length >= 3) {
        const primaryStroke = proj.topFacing ? "rgba(139,92,246, 0.9)" : "rgba(220,38,38, 0.9)";
        const bodyFill = proj.topFacing ? "rgba(139,92,246, 0.13)" : "rgba(220,38,38, 0.16)";
        const glowColor = proj.topFacing ? "rgba(139,92,246, 0.45)" : "rgba(220,38,38, 0.45)";

        // Soft spray glow under deck
        const [dcx, dcy] = toCanvas(proj.deckCenterPx.x, proj.deckCenterPx.y);
        const glowR = anchor.deckLengthPx * 0.42 * dpr;
        const grad = ctx.createRadialGradient(dcx, dcy, glowR * 0.08, dcx, dcy, glowR);
        grad.addColorStop(0, proj.topFacing ? "rgba(139,92,246, 0.16)" : "rgba(220,38,38, 0.16)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(dcx, dcy, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Four translucent wheel rings
        const wheelR = Math.max(3, anchor.deckLengthPx * 0.032) * dpr;
        ctx.strokeStyle = "rgba(244, 242, 237, 0.48)";
        ctx.fillStyle = "rgba(11, 11, 11, 0.42)";
        ctx.lineWidth = 1.4 * dpr;
        for (const wh of proj.wheels) {
          const [wx, wy] = toCanvas(wh.x, wh.y);
          ctx.beginPath();
          ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Translucent deck polygon
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12 * dpr;
        ctx.fillStyle = bodyFill;
        ctx.strokeStyle = primaryStroke;
        ctx.lineWidth = 2.1 * scaleMult * dpr;
        ctx.lineJoin = "round";

        const first = proj.outline[0];
        if (first) {
          ctx.beginPath();
          const [fx, fy] = toCanvas(first.x, first.y);
          ctx.moveTo(fx, fy);
          for (let i = 1; i < proj.outline.length; i++) {
            const pt = proj.outline[i];
            if (!pt) continue;
            const [px, py] = toCanvas(pt.x, pt.y);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Nose kick graphic stripe so front/spin direction pops visually
        ctx.shadowBlur = 0;
        if (proj.noseAccent.length >= 2) {
          const n0 = proj.noseAccent[0];
          if (n0) {
            ctx.strokeStyle = "rgba(220,38,38, 0.92)";
            ctx.lineWidth = 2.6 * scaleMult * dpr;
            ctx.beginPath();
            const [nx0, ny0] = toCanvas(n0.x, n0.y);
            ctx.moveTo(nx0, ny0);
            for (let i = 1; i < proj.noseAccent.length; i++) {
              const pt = proj.noseAccent[i];
              if (!pt) continue;
              const [nx, ny] = toCanvas(pt.x, pt.y);
              ctx.lineTo(nx, ny);
            }
            ctx.stroke();
          }
        }

        // Deck center spine hairline
        const [stx, sty] = toCanvas(proj.spine[0].x, proj.spine[0].y);
        const [snx, sny] = toCanvas(proj.spine[1].x, proj.spine[1].y);
        ctx.strokeStyle = "rgba(244, 242, 237, 0.34)";
        ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(stx, sty);
        ctx.lineTo(snx, sny);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5. Ghost Fingertips (I & M) + Finger Separation Span Line
      const [ix, iy] = toCanvas(proj.indexTipPx.x, proj.indexTipPx.y);
      const [mx, my] = toCanvas(proj.middleTipPx.x, proj.middleTipPx.y);

      ctx.strokeStyle =
        pose.fingerSeparation > 1.15 ? "rgba(220,38,38, 0.68)" : "rgba(139,92,246, 0.52)";
      ctx.lineWidth = 1.6 * scaleMult * dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.setLineDash([]);

      const drawGhostFinger = (
        fx: number,
        fy: number,
        letter: string,
        ringColor: string,
        fillColor: string,
      ) => {
        const r = 9.5 * scaleMult * dpr;
        ctx.save();
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = 10 * dpr;
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#F4F2ED";
        ctx.font = `700 ${Math.round(9.5 * scaleMult * dpr)}px "Space Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, fx, fy + 0.5 * dpr);
        ctx.restore();
      };

      drawGhostFinger(ix, iy, "I", "rgba(139,92,246, 0.95)", "rgba(139,92,246, 0.24)");
      drawGhostFinger(mx, my, "M", "rgba(220,38,38, 0.95)", "rgba(220,38,38, 0.24)");

      ctx.restore();
    };

    raf = requestAnimationFrame(drawLoop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Keep the 3-step callout rail cleanly inside the safe viewport margins above the ghost apex.
  const marginX = Math.min(176, Math.max(120, viewport.width * 0.44));
  const leftPx = clamp(calloutPos.x, marginX, Math.max(marginX, viewport.width - marginX));
  const topPx = clamp(calloutPos.y, 76, Math.max(76, viewport.height - 196));

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[16] overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Clean synced step callouts anchored above the ghost launch apex */}
      <div
        className="hud-glass absolute max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-2 text-paper transition-[left,top] duration-150 ease-out sm:px-3"
        style={{
          left: `${leftPx.toFixed(1)}px`,
          top: `${topPx.toFixed(1)}px`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-marker text-xs tracking-wide text-primary hud-tag-glow whitespace-nowrap">
            {trick.name} Ghost
          </span>
          <span className="font-mono text-[10px] font-bold tabular-nums text-hazard whitespace-nowrap">
            {phaseReadout}
          </span>
        </div>

        <ol className="mt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] whitespace-nowrap sm:gap-2 sm:text-[10px]">
          {trick.preview.stepCallouts.map((label, idx) => {
            const isActive = idx === activeStep;
            const isDone = idx < activeStep;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-1.5 transition-colors duration-150",
                  isActive ? "font-bold text-primary" : isDone ? "text-paper/70" : "text-paper/40",
                )}
              >
                {idx > 0 && (
                  <span className="text-paper/25" aria-hidden="true">
                    ·
                  </span>
                )}
                <span className={cn(isActive && "underline decoration-hazard underline-offset-4")}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {!calloutPos.anchored && (
          <p className="mt-1 font-mono text-[10px] text-paper/60 whitespace-nowrap">
            Rest index + middle on deck to lock onto your board
          </p>
        )}
      </div>
    </div>
  );
}
