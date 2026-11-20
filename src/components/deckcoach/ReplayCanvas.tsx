import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CorrectionArrow, ReplayFrame } from "@/lib/trick-analyzer";

interface ReplayCanvasProps {
  frames: ReplayFrame[];
  correctionArrows: CorrectionArrow[];
  mirrored: boolean;
}

const TONE_COLOR: Record<CorrectionArrow["tone"], string> = {
  hazard: "#DC2626",
  primary: "#8B5CF6",
  cyan: "#38BDF8",
};

const REPLAY_LOOP_MS = 2400;

/**
 * Plays back the user's recorded fingertip & board trajectory in slow motion
 * with visual correction arrows overlaid directly onto the key fault point.
 */
export function ReplayCanvas({ frames, correctionArrows, mirrored }: ReplayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const xs: number[] = [];
    const ys: number[] = [];
    for (const f of frames) {
      xs.push(mirrored ? 1 - f.index.x : f.index.x, mirrored ? 1 - f.middle.x : f.middle.x);
      ys.push(f.index.y, f.middle.y);
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(0.18, maxX - minX);
    const spanY = Math.max(0.16, maxY - minY);
    const padX = spanX * 0.28;
    const padY = spanY * 0.34;
    const loX = minX - padX;
    const hiX = maxX + padX;
    const loY = minY - padY;
    const hiY = maxY + padY * 0.65;

    let raf = 0;
    let startAt = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = 280;
    const cssH = 128;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    const toPx = (nx: number, ny: number): [number, number] => {
      const mx = mirrored ? 1 - nx : nx;
      return [
        ((mx - loX) / Math.max(1e-4, hiX - loX)) * canvas.width,
        ((ny - loY) / Math.max(1e-4, hiY - loY)) * canvas.height,
      ];
    };

    const firstFrame = frames[0]!;
    const surfaceCanvasY = toPx(firstFrame.middle.x, firstFrame.middle.y)[1];

    // Find apex frame index for anchoring correction arrows
    let apexIdx = 0;
    let bestY = Infinity;
    frames.forEach((f, i) => {
      const midY = (f.index.y + f.middle.y) / 2;
      if (midY < bestY) {
        bestY = midY;
        apexIdx = i;
      }
    });
    const apexFrame = frames[apexIdx] ?? firstFrame;

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle tactical grid & ground line
      ctx.strokeStyle = "rgba(244, 242, 237, 0.08)";
      ctx.lineWidth = 1 * dpr;
      for (let gx = 0; gx <= 4; gx++) {
        const x = (gx / 4) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(244, 242, 237, 0.25)";
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(0, surfaceCanvasY);
      ctx.lineTo(w, surfaceCanvasY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Full recorded paths (dimmed trail)
      const drawPath = (pick: (f: ReplayFrame) => { x: number; y: number }, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        frames.forEach((f, i) => {
          const p = pick(f);
          const [px, py] = toPx(p.x, p.y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      };

      drawPath((f) => f.index, "rgba(139,92,246, 0.35)");
      drawPath((f) => f.middle, "rgba(220,38,38, 0.35)");

      if (!playingRef.current) {
        startAt = now - REPLAY_LOOP_MS * 0.45;
      }
      const progress = reducedMotion ? 0.5 : ((now - startAt) % REPLAY_LOOP_MS) / REPLAY_LOOP_MS;
      const frameIdx = Math.min(frames.length - 1, Math.floor(progress * frames.length));
      const cur = frames[frameIdx] ?? apexFrame;

      // Active deck bar & tips at current playback frame
      const [ix, iy] = toPx(cur.index.x, cur.index.y);
      const [mx, my] = toPx(cur.middle.x, cur.middle.y);

      ctx.strokeStyle = "rgba(244, 242, 237, 0.85)";
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(ix, iy);
      ctx.stroke();

      const drawDot = (x: number, y: number, color: string, label: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 5.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0B0B0B";
        ctx.font = `700 ${Math.round(7.5 * dpr)}px "Space Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y + 0.5 * dpr);
      };

      drawDot(ix, iy, "#8B5CF6", "I");
      drawDot(mx, my, "#DC2626", "M");

      // Visual correction arrows overlaid directly onto the replay
      for (const arrow of correctionArrows) {
        const color = TONE_COLOR[arrow.tone];
        const anchorNorm =
          arrow.target === "index"
            ? apexFrame.index
            : arrow.target === "middle"
              ? firstFrame.middle
              : {
                  x: (apexFrame.index.x + apexFrame.middle.x) / 2,
                  y: (apexFrame.index.y + apexFrame.middle.y) / 2,
                };

        const rawSign = mirrored ? -1 : 1;
        const mapPt = (off: { x: number; y: number }): [number, number] =>
          toPx(anchorNorm.x + off.x * rawSign, anchorNorm.y + off.y);

        const p0 = mapPt(arrow.fromOffset);
        const p1 = mapPt(arrow.ctrlOffset);
        const p2 = mapPt(arrow.toOffset);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.2 * dpr;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6 * dpr;
        ctx.setLineDash([5 * dpr, 3 * dpr]);
        ctx.lineDashOffset = -(now / 32) * dpr;

        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
        ctx.stroke();

        ctx.setLineDash([]);
        const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
        const head = 7.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(p2[0], p2[1]);
        ctx.lineTo(
          p2[0] - head * Math.cos(angle - Math.PI / 6),
          p2[1] - head * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          p2[0] - head * Math.cos(angle + Math.PI / 6),
          p2[1] - head * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();

        // Crisp correction label kept inside canvas bounds
        ctx.shadowBlur = 3 * dpr;
        ctx.shadowColor = "rgba(0,0,0,0.95)";
        ctx.font = `700 ${Math.round(8.5 * dpr)}px "Space Mono", monospace`;
        const lx = Math.min(w - 6 * dpr, Math.max(6 * dpr, p2[0]));
        const ly = Math.min(h - 8 * dpr, Math.max(10 * dpr, p2[1] - 8 * dpr));
        ctx.textAlign = p2[0] > w * 0.6 ? "right" : p2[0] < w * 0.4 ? "left" : "center";
        ctx.fillText(arrow.label, lx, ly);
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [frames, correctionArrows, mirrored]);

  if (frames.length < 2) return null;

  return (
    <div className="relative mt-2.5 overflow-hidden rounded-lg border border-paper/15 bg-black/70">
      <canvas ref={canvasRef} className="block h-[128px] w-full" />
      <div className="pointer-events-none absolute top-1.5 left-2 flex items-center gap-1.5 font-mono text-[9px] text-paper/65">
        <span>REPLAY</span>
        {correctionArrows.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-primary">CORRECTION PATH</span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause attempt replay" : "Play attempt replay"}
        className="absolute right-1 bottom-1 grid size-10 place-items-center rounded border border-paper/15 bg-black/65 text-paper/80 transition-colors cursor-pointer hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
    </div>
  );
}
