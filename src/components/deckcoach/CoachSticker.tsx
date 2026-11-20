import { Axe } from "lucide-react";

import type { Attempt } from "@/lib/trick-analyzer";

const VERDICT_COLOR: (score: number) => string = (score) =>
  score >= 78 ? "text-primary" : score >= 50 ? "text-hazard" : "text-destructive";

export interface CoachStickerProps {
  attempt: Attempt;
  trickName: string;
  onDismiss: () => void;
}

/** Slapped-on coach's verdict: score, slang advice, one quick tip. */
export function CoachSticker({ attempt, trickName, onDismiss }: CoachStickerProps) {
  const { score, diagnosis, metrics } = attempt;
  const popPct = Math.round(metrics.peakPop * 400); // 0..~0.25 rise → 0..100%
  const spreadDeg = Math.round(metrics.spread * 720);

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Coach diagnosis — tap to dismiss"
      className="pointer-events-auto absolute top-1/2 left-1/2 z-[35] w-64 max-w-[85vw] -translate-x-1/2 -translate-y-1/2 -rotate-2 animate-slap cursor-pointer text-left drop-hard sm:w-80"
    >
      <span className="tape-tab -top-2.5 left-1/2 z-10 h-5 w-24 -translate-x-1/2 -rotate-3" />
      <span className="tape-tab -top-2.5 right-4 z-10 h-5 w-20 rotate-6" />
      <span className="torn-paper relative block bg-paper grain px-5 pt-6 pb-5 text-paper-foreground">
        <span className="mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Axe className="size-4 text-hazard" aria-hidden />
            <span className="hud-label">Coach says · {trickName}</span>
          </span>
          <span className={`font-display text-4xl leading-none ${VERDICT_COLOR(score)}`}>{score}</span>
        </span>

        <span className="mt-2 block font-marker text-2xl leading-tight text-hazard">
          {diagnosis.title}
        </span>
        <span className="mt-1.5 block text-sm leading-snug font-medium">{diagnosis.advice}</span>

        <span className="mt-3 flex flex-wrap gap-1.5">
          <span className="hud-label torn-tape bg-tape grain px-2.5 py-1 text-tape-foreground">
            Pop {popPct}%
          </span>
          <span className="hud-label torn-tape bg-tape grain px-2.5 py-1 text-tape-foreground">
            Spread ~{spreadDeg}°
          </span>
          <span className="hud-label torn-tape bg-tape grain px-2.5 py-1 text-tape-foreground">
            Flick {metrics.flick >= 0 ? "→ nose" : "← tail"}
          </span>
        </span>

        <span className="mt-3 block border-t-2 border-dashed border-paper-foreground/25 pt-2 text-xs leading-snug">
          <span className="font-marker text-sm text-hazard">Quick tip: </span>
          {diagnosis.tip}
        </span>
      </span>
    </button>
  );
}
