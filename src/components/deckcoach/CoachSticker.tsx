import { Film, X } from "lucide-react";

import { getDeckSetup } from "@/lib/setup";
import type { Attempt } from "@/lib/trick-analyzer";

import { ReplayCanvas } from "./ReplayCanvas";

const VERDICT_COLOR = (score: number) =>
  score >= 78 ? "text-primary" : score >= 50 ? "text-hazard" : "text-destructive";

const LANDING_LABELS = {
  clean: "CLEAN",
  sketchy: "SKETCHY",
  primo: "PRIMO",
  rocket: "ROCKET",
} as const;

export interface CoachStickerProps {
  attempt: Attempt;
  trickName: string;
  mirrored: boolean;
  savedClipId?: string;
  onOpenClip?: (clipId: string) => void;
  onDismiss: () => void;
}

/**
 * Minimalist futuristic-graffiti coach diagnosis card showing trick match,
 * live replay with visual correction arrows, and setup-tailored failure analysis.
 */
export function CoachSticker({
  attempt,
  trickName,
  mirrored,
  savedClipId,
  onOpenClip,
  onDismiss,
}: CoachStickerProps) {
  const {
    score,
    diagnosis,
    metrics,
    setup,
    trickMatched,
    matchConfidence,
    detectedMotionLabel,
    failureReasons,
    correctionArrows,
    replayFrames,
  } = attempt;

  const popPct = Math.round(metrics.peakPop * 400);
  const setupTag = setup ? getDeckSetup(setup).shortTag : null;
  const landingTag = metrics.landingKind ? LANDING_LABELS[metrics.landingKind] : null;
  const timingTag =
    metrics.popTiming === "early-slide"
      ? "Early Slide"
      : metrics.popTiming === "late-flick"
        ? "Late Flick"
        : metrics.popTiming === "crisp"
          ? "Crisp Timing"
          : null;

  return (
    <div
      role="dialog"
      aria-label={`${trickName} coach diagnosis`}
      className="pointer-events-auto absolute top-1/2 left-1/2 z-[35] max-h-[82dvh] w-80 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 animate-slap overflow-y-auto rounded-xl sm:w-96"
    >
      <div className="hud-glass relative rounded-xl border-primary/35 p-4 text-paper">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-paper/65">
              {trickName}
              {setupTag ? ` · ${setupTag}` : ""}
              {landingTag ? ` · ${landingTag}` : ""}
            </p>
            <h2 className="mt-0.5 font-marker text-2xl leading-tight text-primary hud-tag-glow">
              {diagnosis.title}
            </h2>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-paper/70">
              {trickMatched
                ? `Matched ${matchConfidence}%`
                : `Mismatch (${matchConfidence}%) · Looked like ${detectedMotionLabel}`}
            </p>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <span
              className={`font-display text-4xl leading-none tabular-nums ${VERDICT_COLOR(score)}`}
            >
              {score}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss coach diagnosis"
              className="-mt-1 -mr-1 grid size-11 place-items-center rounded-md text-paper/55 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Recorded trajectory replay + visual correction vectors */}
        <ReplayCanvas
          frames={replayFrames}
          correctionArrows={correctionArrows}
          mirrored={mirrored}
        />

        {/* Primary setup-tailored coaching takeaway */}
        <p className="mt-2.5 font-mono text-xs leading-relaxed text-paper/95">{diagnosis.advice}</p>

        {/* Detailed explanation of WHY the attempt failed / locked */}
        <div className="mt-2.5 rounded-lg border border-paper/10 bg-black/35 p-2.5">
          <p className="font-mono text-[10px] font-bold tracking-wider text-hazard">
            {failureReasons.length > 0 ? "WHY IT FAILED" : "MECHANICS LOCKED"}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-snug text-paper/85">
            {diagnosis.whyFailed}
          </p>
          {failureReasons.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 font-mono text-[10px] text-paper/70">
              {failureReasons.slice(0, 3).map((reason) => (
                <li key={reason} className="leading-snug">
                  • {reason}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quantitative telemetry strip */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] tabular-nums text-paper/65">
          <span>Pop {popPct}%</span>
          {timingTag && (
            <>
              <span aria-hidden="true">·</span>
              <span>{timingTag}</span>
            </>
          )}
          {metrics.wristRotationDeg !== undefined && metrics.wristRotationDeg > 8 && (
            <>
              <span aria-hidden="true">·</span>
              <span>Wrist {metrics.wristRotationDeg}°</span>
            </>
          )}
          {metrics.indexCurl !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>Curl {Math.round(metrics.indexCurl * 100)}%</span>
            </>
          )}
          {metrics.boardPitchDeg !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Pitch {metrics.boardPitchDeg >= 0 ? "+" : ""}
                {Math.round(metrics.boardPitchDeg)}°
              </span>
            </>
          )}
          {metrics.flipRotationDeg !== undefined && metrics.flipRotationDeg > 15 && (
            <>
              <span aria-hidden="true">·</span>
              <span>Flip {metrics.flipRotationDeg}°</span>
            </>
          )}
        </div>

        <p className="mt-2.5 border-t border-paper/10 pt-2 font-mono text-[11px] leading-snug text-paper/85">
          <span className="font-marker text-xs text-hazard">Next Try: </span>
          {diagnosis.tip}
        </p>

        {savedClipId && onOpenClip && (
          <button
            type="button"
            onClick={() => onOpenClip(savedClipId)}
            className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md border border-primary/45 bg-primary/12 px-3 py-1.5 font-mono text-xs font-bold text-primary transition-colors cursor-pointer press hover:bg-primary/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Film className="size-3.5 shrink-0" />
            <span>Slow-Mo Clip Saved · Scrub Mistake Frame</span>
          </button>
        )}
      </div>
    </div>
  );
}
