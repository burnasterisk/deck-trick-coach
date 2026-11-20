import { Award, Check, Flame, History, Play, Sparkles, Target, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { SavedClip } from "@/lib/clips";
import {
  computeSuccessRatePct,
  DAILY_WARMUP_PLAN,
  GUIDED_TUTORIALS,
  getTrickOfTheDay,
  getWeeklyChallenge,
  isClipQualifiedForChallenge,
  type ChallengeSubmission,
  type GuidedTutorial,
  type SessionHistoryEntry,
  type WarmupProgress,
} from "@/lib/sessions";
import { getDeckSetup, type DeckSetupId } from "@/lib/setup";
import { getTrick, type TrickId } from "@/lib/tricks";
import { cn } from "@/lib/utils";

export type SessionsTab = "presets" | "challenge";

export interface ActiveTutorialState {
  tutorialId: string;
  stepIndex: number;
  completed: boolean;
  lastFeedback: string | null;
}

interface SessionsDrawerProps {
  open: boolean;
  initialTab?: SessionsTab;
  setup: DeckSetupId;
  clips: SavedClip[];
  warmup: WarmupProgress;
  activeTutorial: ActiveTutorialState | null;
  completedTutorialIds: string[];
  warmupDoneToday: boolean;
  totdDoneToday: boolean;
  submissions: ChallengeSubmission[];
  history: SessionHistoryEntry[];
  onClose: () => void;
  onStartWarmup: () => void;
  onStopWarmup: () => void;
  onPracticeTotd: (trickId: TrickId) => void;
  onStartTutorial: (tutorial: GuidedTutorial) => void;
  onStopTutorial: () => void;
  onClearHistory: () => void;
  onPracticeChallengeTrick: (trickId: TrickId) => void;
  onSubmitChallengeClip: (payload: {
    clip: SavedClip;
    handle: string;
  }) => ChallengeSubmission;
}

function formatHistoryTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${timeStr}`;
  const dayStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${dayStr} · ${timeStr}`;
}

export function SessionsDrawer({
  open,
  initialTab = "presets",
  setup,
  clips,
  warmup,
  activeTutorial,
  completedTutorialIds,
  warmupDoneToday,
  totdDoneToday,
  submissions,
  history,
  onClose,
  onStartWarmup,
  onStopWarmup,
  onPracticeTotd,
  onStartTutorial,
  onStopTutorial,
  onClearHistory,
  onPracticeChallengeTrick,
  onSubmitChallengeClip,
}: SessionsDrawerProps) {
  const [tab, setTab] = useState<SessionsTab>(initialTab);
  const [historyFilter, setHistoryFilter] = useState<"all" | "drills" | "tricks">("all");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [replacingEntry, setReplacingEntry] = useState(false);

  const totd = useMemo(() => getTrickOfTheDay(), []);
  const challenge = useMemo(() => getWeeklyChallenge(), []);
  const setupProfile = getDeckSetup(setup);

  const qualifyingClips = useMemo(
    () => clips.filter((c) => isClipQualifiedForChallenge(c, challenge)),
    [clips, challenge],
  );

  const existingSubmission = useMemo(
    () => submissions.find((s) => s.weekKey === challenge.weekKey) ?? null,
    [submissions, challenge.weekKey],
  );

  const activeClip = useMemo(() => {
    if (selectedClipId) {
      const found = clips.find((c) => c.id === selectedClipId);
      if (found) return found;
    }
    return qualifyingClips[0] ?? clips[0] ?? null;
  }, [clips, qualifyingClips, selectedClipId]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setFormError(null);
      setReplacingEntry(false);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const activeTutDef = activeTutorial
    ? (GUIDED_TUTORIALS.find((t) => t.id === activeTutorial.tutorialId) ?? null)
    : null;

  function handleChallengeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!activeClip) {
      setFormError(`Film a ${challenge.trick.name} clip first to save a draft.`);
      return;
    }
    if (!isClipQualifiedForChallenge(activeClip, challenge)) {
      setFormError(
        `Clip must be ${challenge.trick.name} with matched score >= ${challenge.minScore}.`,
      );
      return;
    }
    const cleanHandle = handleInput.trim();
    if (cleanHandle.length < 2) {
      setFormError("Enter your skater handle (at least 2 characters).");
      return;
    }
    onSubmitChallengeClip({
      clip: activeClip,
      handle: cleanHandle.startsWith("@") ? cleanHandle : `@${cleanHandle}`,
    });
    setReplacingEntry(false);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-black/55 backdrop-blur-sm"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Training sessions and weekly challenge"
        className="hud-glass flex h-full w-full max-w-[460px] flex-col border-r border-paper/15 text-paper animate-slap"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-paper/12 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl tracking-wide text-paper whitespace-nowrap">
              SESSIONS
            </h2>
            <p className="font-mono text-[11px] text-paper/60 whitespace-nowrap">
              Warmups · Drills · Pro Challenge
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sessions drawer"
            className="grid size-11 shrink-0 place-items-center rounded-md text-paper/65 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Top Hub Tabs */}
        <div className="px-4 pt-3 pb-2">
          <div
            role="tablist"
            aria-label="Sessions sections"
            className="grid grid-cols-2 gap-1 rounded-lg border border-paper/12 bg-black/45 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "presets"}
              onClick={() => setTab("presets")}
              className={cn(
                "min-h-[40px] rounded-md px-3 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                tab === "presets"
                  ? "bg-primary/18 font-bold text-primary"
                  : "text-paper/70 hover:text-paper",
              )}
            >
              Presets & Drills
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "challenge"}
              onClick={() => setTab("challenge")}
              className={cn(
                "min-h-[40px] rounded-md px-3 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                tab === "challenge"
                  ? "bg-primary/18 font-bold text-primary"
                  : "text-paper/70 hover:text-paper",
              )}
            >
              Weekly Challenge
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-5">
          {tab === "presets" ? (
            <div className="space-y-4 pt-1">
              {/* Live active drill / warmup progress summary */}
              {activeTutorial && activeTutDef && (
                <section className="rounded-lg border border-primary/45 bg-primary/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-wider text-primary">
                        ACTIVE INTERACTIVE DRILL
                      </p>
                      <h3 className="mt-0.5 font-marker text-base text-paper">
                        {activeTutDef.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={onStopTutorial}
                      className="min-h-[36px] rounded px-2 font-mono text-[11px] text-paper/75 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper"
                    >
                      End
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {activeTutDef.steps.map((step, idx) => {
                      const done = activeTutorial.completed || idx < activeTutorial.stepIndex;
                      const current = !activeTutorial.completed && idx === activeTutorial.stepIndex;
                      return (
                        <div
                          key={step.id}
                          className={cn(
                            "flex items-start gap-2 font-mono text-[11px]",
                            done
                              ? "text-primary"
                              : current
                                ? "font-bold text-paper"
                                : "text-paper/45",
                          )}
                        >
                          <span className="mt-0.5 shrink-0">
                            {done ? (
                              <Check className="size-3.5 text-primary" />
                            ) : (
                              <span>0{idx + 1}.</span>
                            )}
                          </span>
                          <span>{step.title.replace(/^\d+\.\s*/, "")}</span>
                        </div>
                      );
                    })}
                  </div>
                  {activeTutorial.lastFeedback && (
                    <p className="mt-2 border-t border-paper/12 pt-1.5 font-mono text-[11px] text-hazard">
                      {activeTutorial.lastFeedback}
                    </p>
                  )}
                </section>
              )}

              {warmup.active && (
                <section className="rounded-lg border border-primary/45 bg-primary/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-wider text-primary">
                        DAILY WARMUP RUNNING
                      </p>
                      <h3 className="mt-0.5 font-marker text-base text-paper">
                        {getTrick(DAILY_WARMUP_PLAN[warmup.stepIndex]!.trickId).name} ·{" "}
                        <span className="font-mono text-xs tabular-nums">
                          {warmup.repsCompleted}/{DAILY_WARMUP_PLAN[warmup.stepIndex]!.targetReps}
                        </span>
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={onStopWarmup}
                      className="min-h-[36px] rounded px-2 font-mono text-[11px] text-paper/75 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper"
                    >
                      End
                    </button>
                  </div>
                  {warmup.lastFeedback && (
                    <p className="mt-1.5 font-mono text-[11px] text-paper/85">
                      {warmup.lastFeedback}
                    </p>
                  )}
                </section>
              )}

              {/* 1. Daily Warmup Preset */}
              <section className="pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Flame className="size-4 text-hazard shrink-0" />
                    <h3 className="font-mono text-xs font-bold tracking-wider text-paper">
                      DAILY WARMUP
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-paper/60 tabular-nums">
                    {warmupDoneToday ? "Completed Today" : "3 Tricks · 5 Makes"}
                  </span>
                </div>

                <p className="mt-1.5 font-mono text-xs text-paper/80">
                  {DAILY_WARMUP_PLAN.map(
                    (step) => `${getTrick(step.trickId).name} ×${step.targetReps}`,
                  ).join(" · ")}
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-paper/60">
                  Dial tail snap, scoop timing, and flip wrist rhythm before free-skating.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    onStartWarmup();
                    onClose();
                  }}
                  className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 font-mono text-xs font-bold text-primary transition-colors cursor-pointer press hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Play className="size-3.5" />
                  <span>{warmup.active ? "Resume Warmup on Camera" : "Start Daily Warmup"}</span>
                </button>
              </section>

              {/* 2. Trick of the Day */}
              <section className="border-t border-paper/12 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary shrink-0" />
                    <h3 className="font-mono text-xs font-bold tracking-wider text-paper">
                      TRICK OF THE DAY
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-paper/60">
                    {totdDoneToday ? "Landed Today" : totd.dateKey}
                  </span>
                </div>

                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <p className="font-marker text-xl text-primary">{totd.trick.name}</p>
                  <span className="font-mono text-[11px] tabular-nums text-paper/65">
                    Difficulty {totd.trick.difficulty}/5
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-paper/75">
                  {setupProfile.shortTag}: {totd.bonusCue(setup)}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    onPracticeTotd(totd.trick.id);
                    onClose();
                  }}
                  className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-paper/20 bg-black/45 px-3 font-mono text-xs font-bold text-paper transition-colors cursor-pointer press hover:border-primary/55 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Target className="size-3.5" />
                  <span>Load {totd.trick.name} + Ghost Deck</span>
                </button>
              </section>

              {/* 3. Guided Interactive Phase Tutorials */}
              <section className="border-t border-paper/12 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-paper">
                    GUIDED TUTORIALS
                  </h3>
                  <span className="font-mono text-[11px] tabular-nums text-paper/55">
                    {completedTutorialIds.length}/{GUIDED_TUTORIALS.length} cleared
                  </span>
                </div>

                <div className="mt-2 divide-y divide-paper/10">
                  {GUIDED_TUTORIALS.map((tut) => {
                    const isCompleted = completedTutorialIds.includes(tut.id);
                    const isRunning = activeTutorial?.tutorialId === tut.id;
                    return (
                      <div key={tut.id} className="py-3 first:pt-1 last:pb-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="font-marker text-base text-paper">{tut.title}</h4>
                          <span
                            className={cn(
                              "font-mono text-[10px] tabular-nums whitespace-nowrap",
                              isCompleted ? "text-primary font-bold" : "text-paper/55",
                            )}
                          >
                            {isCompleted
                              ? "Cleared"
                              : `${tut.steps.length} phases · ~${tut.estimatedMin}m`}
                          </span>
                        </div>

                        <p className="mt-0.5 font-mono text-[11px] text-paper/70">{tut.subtitle}</p>

                        <ol className="mt-2 space-y-1 font-mono text-[10px] text-paper/60">
                          {tut.steps.map((s) => (
                            <li key={s.id}>{s.title}</li>
                          ))}
                        </ol>

                        <button
                          type="button"
                          onClick={() => {
                            onStartTutorial(tut);
                            onClose();
                          }}
                          className={cn(
                            "mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border px-3 font-mono text-xs font-bold transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            isRunning
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-paper/20 bg-black/45 text-paper hover:border-primary/50 hover:text-primary",
                          )}
                        >
                          <Play className="size-3.5" />
                          <span>
                            {isRunning
                              ? "Resume Phase Drill"
                              : isCompleted
                                ? "Run Drill Again"
                                : "Start Guided Drill"}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 4. Session History (logged drills & tricks with physics success rate) */}
              <section className="border-t border-paper/12 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-primary shrink-0" />
                    <h3 className="font-mono text-xs font-bold tracking-wider text-paper">
                      SESSION HISTORY
                    </h3>
                  </div>

                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      aria-label="Clear session history"
                      className="flex min-h-[36px] items-center gap-1 rounded px-2 font-mono text-[11px] text-paper/60 transition-colors cursor-pointer hover:bg-paper/10 hover:text-hazard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Trash2 className="size-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-paper/60">
                    No sessions logged yet. Land tricks on camera or complete a guided drill—every
                    attempt&apos;s physics success rate is recorded here with a timestamp.
                  </p>
                ) : (
                  (() => {
                    const filteredHistory = history.filter((item) => {
                      if (historyFilter === "drills") return item.kind !== "trick";
                      if (historyFilter === "tricks") return item.kind === "trick";
                      return true;
                    });
                    const totalAttempts = filteredHistory.reduce((acc, e) => acc + e.attempts, 0);
                    const totalLanded = filteredHistory.reduce((acc, e) => acc + e.landedCount, 0);
                    const overallPct = computeSuccessRatePct(totalLanded, totalAttempts);

                    return (
                      <div className="mt-2.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div
                            role="group"
                            aria-label="Filter session history"
                            className="flex items-center gap-1 rounded-md border border-paper/12 bg-black/40 p-0.5"
                          >
                            {(
                              [
                                { id: "all", label: "All" },
                                { id: "drills", label: "Drills" },
                                { id: "tricks", label: "Tricks" },
                              ] as const
                            ).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                aria-pressed={historyFilter === f.id}
                                onClick={() => setHistoryFilter(f.id)}
                                className={cn(
                                  "min-h-[32px] rounded px-2 font-mono text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                  historyFilter === f.id
                                    ? "bg-primary/20 font-bold text-primary"
                                    : "text-paper/65 hover:text-paper",
                                )}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          <span className="font-mono text-[11px] tabular-nums text-paper/75">
                            Avg <span className="font-bold text-primary">{overallPct}%</span>
                            <span className="text-paper/55">
                              {" "}
                              ({totalLanded}/{totalAttempts})
                            </span>
                          </span>
                        </div>

                        {filteredHistory.length === 0 ? (
                          <p className="py-2 font-mono text-[11px] text-paper/55">
                            No {historyFilter} logged in this filter yet.
                          </p>
                        ) : (
                          <ul className="divide-y divide-paper/10">
                            {filteredHistory.map((item) => {
                              const setupTag = item.setup
                                ? getDeckSetup(item.setup).shortTag
                                : null;
                              const kindLabel =
                                item.kind === "warmup"
                                  ? "Warmup"
                                  : item.kind === "drill"
                                    ? "Drill"
                                    : "Trick";

                              return (
                                <li key={item.id} className="py-2.5 first:pt-1 last:pb-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate font-mono text-xs font-bold text-paper">
                                      {item.title}
                                    </span>
                                    <span
                                      className={cn(
                                        "shrink-0 font-mono text-xs font-bold tabular-nums",
                                        item.successRatePct >= 70
                                          ? "text-primary"
                                          : item.successRatePct >= 40
                                            ? "text-hazard"
                                            : "text-[#FF6B6B]",
                                      )}
                                    >
                                      {item.successRatePct}% clean
                                    </span>
                                  </div>

                                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-paper/12">
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        item.successRatePct >= 70
                                          ? "bg-primary"
                                          : item.successRatePct >= 40
                                            ? "bg-hazard"
                                            : "bg-[#FF6B6B]",
                                      )}
                                      style={{ width: `${item.successRatePct}%` }}
                                    />
                                  </div>

                                  <p className="mt-1 font-mono text-[10px] tabular-nums text-paper/60">
                                    <span>{kindLabel}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span>{formatHistoryTimestamp(item.timestamp)}</span>
                                    {setupTag && (
                                      <>
                                        <span aria-hidden="true"> · </span>
                                        <span>{setupTag}</span>
                                      </>
                                    )}
                                    <span aria-hidden="true"> · </span>
                                    <span>
                                      {item.landedCount}/{item.attempts} landed
                                    </span>
                                    <span aria-hidden="true"> · </span>
                                    <span>Best {item.bestScore}</span>
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })()
                )}
              </section>
            </div>
          ) : (
            /* Tab 2: Weekly Clip Challenge */
            <div className="space-y-4 pt-1">
              <section className="pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="size-4 text-primary shrink-0" />
                    <h3 className="font-mono text-xs font-bold tracking-wider text-paper">
                      WEEKLY FEATURED TRICK
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-paper/60">
                    {challenge.dateRangeLabel}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="font-marker text-2xl text-primary hud-tag-glow">
                    {challenge.trick.name}
                  </p>
                  <span className="font-mono text-[11px] font-bold text-hazard whitespace-nowrap">
                    Min Score {challenge.minScore}
                  </span>
                </div>

                <p className="mt-1 font-mono text-[11px] font-bold text-paper/90">
                  Practice target: {challenge.rewardLabel}
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-paper/70">
                  {challenge.brief}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    onPracticeChallengeTrick(challenge.trickId);
                    onClose();
                  }}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-paper/20 bg-black/45 px-3 font-mono text-xs font-bold text-paper transition-colors cursor-pointer press hover:border-primary/55 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Target className="size-3.5" />
                  <span>Film {challenge.trick.name} Clip</span>
                </button>
              </section>

              {/* Submission Receipt or Entry Form */}
              {existingSubmission && !replacingEntry ? (
                <section className="border-t border-paper/12 pt-4">
                  <p className="font-mono text-[10px] font-bold tracking-wider text-primary">
                    LOCAL ENTRY DRAFT · NOT SENT
                  </p>
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3">
                    {existingSubmission.posterUrl && (
                      <img
                        src={existingSubmission.posterUrl}
                        alt={`${existingSubmission.trickName} challenge submission`}
                        className="h-14 w-22 shrink-0 rounded border border-paper/15 object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold text-paper truncate">
                        {existingSubmission.handle}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-primary tabular-nums">
                        {existingSubmission.trickName} · {existingSubmission.score} pts
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-paper/65 truncate">
                        {existingSubmission.setupLabel}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 border-l-2 border-hazard/70 pl-2 font-mono text-[10px] leading-relaxed text-paper/70">
                    Saved on this device only. This server-free build does not upload entries or
                    send emails, so this is not an official submission and cannot award Pro access.
                    Share or export your clip from the Clips drawer.
                  </p>
                  {qualifyingClips.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setReplacingEntry(true)}
                      className="mt-2.5 flex min-h-[44px] w-full items-center justify-center rounded-md border border-paper/20 bg-black/45 px-3 font-mono text-xs text-paper/85 transition-colors cursor-pointer hover:border-primary/50 hover:text-primary"
                    >
                      Replace With Higher-Scoring Clip
                    </button>
                  )}
                </section>
              ) : (
                <form
                  onSubmit={handleChallengeSubmit}
                  className="border-t border-paper/12 pt-4 space-y-3"
                >
                  <div>
                    <p className="font-mono text-xs font-bold tracking-wider text-paper">
                      SAVE CHALLENGE ENTRY DRAFT
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-paper/60">
                      Choose a qualifying slow-mo clip. This saves a local draft only; it does not send your clip anywhere.
                    </p>
                  </div>

                  {clips.length === 0 ? (
                    <div className="rounded-lg border border-paper/12 bg-black/35 p-3 font-mono text-[11px] leading-relaxed text-paper/70">
                      No session clips captured yet. Tap &ldquo;Film {challenge.trick.name}{" "}
                      Clip&rdquo; above and land an attempt—your clip will appear here
                      automatically.
                    </div>
                  ) : (
                    <div className="max-h-44 divide-y divide-paper/10 overflow-y-auto rounded-lg border border-paper/12 bg-black/35">
                      {clips.map((c) => {
                        const qualifies = isClipQualifiedForChallenge(c, challenge);
                        const selected = activeClip?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedClipId(c.id)}
                            className={cn(
                              "flex min-h-[56px] w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors cursor-pointer",
                              selected ? "bg-primary/12" : "hover:bg-paper/5",
                            )}
                          >
                            {c.posterUrl && (
                              <img
                                src={c.posterUrl}
                                alt={`${c.trickName} preview`}
                                className="h-10 w-16 shrink-0 rounded border border-paper/15 object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 font-mono text-xs">
                                <span
                                  className={cn(
                                    "truncate font-bold",
                                    selected ? "text-primary" : "text-paper",
                                  )}
                                >
                                  {c.trickName}
                                </span>
                                <span className="shrink-0 tabular-nums text-paper/80">
                                  {c.attempt.score} pts
                                </span>
                              </div>
                              <p
                                className={cn(
                                  "mt-0.5 truncate font-mono text-[10px]",
                                  qualifies ? "text-primary" : "text-paper/55",
                                )}
                              >
                                {qualifies
                                  ? "Meets local challenge target"
                                  : `Needs ${challenge.trick.name} (${challenge.minScore}+)`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <div>
                      <label
                        htmlFor="challenge-handle"
                        className="block font-mono text-[11px] text-paper/75"
                      >
                        Skater Handle
                      </label>
                      <input
                        id="challenge-handle"
                        type="text"
                        placeholder="@deckshredder"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value)}
                        className="mt-1 h-11 w-full rounded-md border border-paper/18 bg-black/55 px-3 font-mono text-xs text-paper placeholder:text-paper/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>
                  </div>

                  {formError && (
                    <p className="font-mono text-[11px] text-[#FF6B6B]" role="alert">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={qualifyingClips.length === 0}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-primary/60 bg-primary px-3 font-mono text-xs font-bold text-primary-foreground transition-colors cursor-pointer press hover:brightness-105 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Award className="size-4" />
                    <span>Save Entry Draft on This Device</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
