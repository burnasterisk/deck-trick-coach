import { useEffect, useRef } from "react";

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
  /** True when the video is mirrored (front camera) — landmarks must flip too. */
  mirrored: boolean;
}

/** Gritty spray-paint tracking dots + spread line + motion-trail ribbon. */
export function FingertipOverlay({ tips, mirrored }: FingertipOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipsRef = useRef(tips);
  const mirroredRef = useRef(mirrored);
  const trailRef = useRef<TrailPoint[]>([]);
  tipsRef.current = tips;
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

    // Fuzzy spray dot: layered translucent circles with random speckle around the core.
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

      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = radius * (1.4 + Math.random() * 1.7);
        ctx.globalAlpha = 0.12 + Math.random() * 0.2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const current = tipsRef.current;
      if (current) {
        trailRef.current.push({ index: current.index, middle: current.middle, t: now });
      }
      const cutoff = now - TRAIL_MS;
      trailRef.current = trailRef.current.filter((p) => p.t >= cutoff);

      const trail = trailRef.current;
      if (trail.length >= 2) {
        // Motion-trail ribbon: tapered translucent band swept by both fingertips.
        for (const side of ["index", "middle"] as const) {
          ctx.beginPath();
          const first = px(trail[0][side]);
          ctx.moveTo(first[0], first[1]);
          for (let i = 1; i < trail.length; i++) {
            const p = px(trail[i][side]);
            ctx.lineTo(p[0], p[1]);
          }
          for (let i = trail.length - 1; i >= 0; i--) {
            const age = (now - trail[i].t) / TRAIL_MS;
            const spread = (6 + 26 * age) * dpr;
            const p = px(trail[i][side]);
            ctx.lineTo(p[0], p[1] + spread);
          }
          for (let i = 0; i < trail.length; i++) {
            const age = (now - trail[i].t) / TRAIL_MS;
            const spread = (6 + 26 * age) * dpr;
            const p = px(trail[i][side]);
            ctx.lineTo(p[0], p[1] - spread);
          }
          ctx.closePath();
          ctx.fillStyle = side === "index" ? "rgba(229,255,0,0.13)" : "rgba(255,77,0,0.13)";
          ctx.fill();
        }
      }

      if (current) {
        const [ix, iy] = px(current.index);
        const [mx, my] = px(current.middle);

        // Finger-spread connector.
        ctx.strokeStyle = "rgba(229,255,0,0.85)";
        ctx.lineWidth = 3 * dpr;
        ctx.lineCap = "round";
        ctx.setLineDash([10 * dpr, 8 * dpr]);
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);

        sprayDot(current.index, "rgba(229,255,0,1)", 9 * dpr, now);
        sprayDot(current.middle, "rgba(255,77,0,1)", 9 * dpr, now);
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
