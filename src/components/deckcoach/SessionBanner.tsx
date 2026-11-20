import { Flame, Target, X } from "lucide-react";

import { DAILY_WARMUP_PLAN, getTutorial, type WarmupProgress } from "@/lib/sessions";
import { getTrick } from "@/lib/tricks";
import { cn } from "@/lib/utils";

import type { ActiveTutorialState } from "./SessionsDrawer";

interface SessionBannerProps {
  activeTutorial: ActiveTutorialState | null;
  warmup: WarmupProgress;
  onOpenSessions: () => void;
  onDismiss: () => void;
}

/**
 * Compact single-strip live drill / warmup HUD indicator positioned cleanly beneath
 * TopBar only while an interactive drill or Daily Warmup is running.
 */
export function SessionBanner({
  activeTutorial,
  warmup,
  onOpenSessions,
  onDismiss,
}: SessionBannerProps) {
  if (!activeTutorial && !warmup.active) return null;

  let kicker = "";
  let headline = "";
  let feedback: string | null = null;
  let isComplete = false;

  if (activeTutorial) {
    const tut = getTutorial(activeTutorial.tutorialId);
    if (!tut) return null;
    const step = tut.steps[activeTutorial.stepIndex];
    kicker = `${tut.title} · Phase ${activeTutorial.stepIndex + 1}/${tut.steps.length}`;
    headline = activeTutorial.completed
      ? "All phases verified!"
      : (step?.title.replace(/^\d+\.\s*/, "") ?? tut.title);
    feedback = activeTutorial.lastFeedback;
    isComplete = activeTutorial.completed;
  } else if (warmup.active) {
    const target = DAILY_WARMUP_PLAN[warmup.stepIndex];
    if (!target) return null;
    kicker = `Daily Warmup · ${warmup.stepIndex + 1}/${DAILY_WARMUP_PLAN.length}`;
    headline = warmup.completed
      ? "Warmup complete!"
      : `${getTrick(target.trickId).name} (${warmup.repsCompleted}/${target.targetReps})`;
    feedback = warmup.lastFeedback;
    isComplete = warmup.completed;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-safe sm:top-16">
      <div
        className={cn(
          "hud-glass pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg border px-3 py-1.5 text-paper animate-slap",
          isComplete ? "border-primary/65 bg-primary/15" : "border-paper/15",
        )}
      >
        <button
          type="button"
          onClick={onOpenSessions}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {activeTutorial ? (
            <Target className="size-4 shrink-0 text-primary" />
          ) : (
            <Flame className="size-4 shrink-0 text-hazard" />
          )}
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] text-paper/65">{kicker}</p>
            <p className="truncate font-mono text-xs font-bold text-paper">
              {headline}
              {feedback ? <span className="font-normal text-primary"> · {feedback}</span> : null}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="End active drill or warmup"
          className="grid size-10 shrink-0 place-items-center rounded text-paper/60 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
