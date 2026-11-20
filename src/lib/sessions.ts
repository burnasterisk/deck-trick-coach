import type { SavedClip } from "./clips";
import type { DeckSetupId } from "./setup";
import type { Attempt } from "./trick-analyzer";
import { getTrick, TRICKS, type Trick, type TrickId } from "./tricks";

export interface WarmupTarget {
  trickId: TrickId;
  targetReps: number;
}

export interface WarmupProgress {
  active: boolean;
  stepIndex: number;
  repsCompleted: number;
  completed: boolean;
  lastFeedback: string | null;
}

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  cue: string;
  /** Pure physics verifier for this step against a completed attempt. */
  verify: (attempt: Attempt, boardScale: number) => { passed: boolean; feedback: string };
}

export interface GuidedTutorial {
  id: string;
  title: string;
  subtitle: string;
  trickId: TrickId;
  estimatedMin: number;
  steps: TutorialStep[];
}

export interface WeeklyChallenge {
  weekKey: string;
  dateRangeLabel: string;
  trickId: TrickId;
  trick: Trick;
  minScore: number;
  rewardLabel: string;
  brief: string;
}

export interface ChallengeSubmission {
  id: string;
  weekKey: string;
  trickId: TrickId;
  trickName: string;
  clipId: string;
  score: number;
  handle: string;
  email?: string;
  setupLabel: string;
  posterUrl: string;
  submittedAt: number;
}

export type SessionHistoryKind = "trick" | "drill" | "warmup";

export interface SessionHistoryEntry {
  id: string;
  kind: SessionHistoryKind;
  title: string;
  trickId?: TrickId;
  setup?: DeckSetupId;
  timestamp: number;
  attempts: number;
  landedCount: number;
  successRatePct: number;
  bestScore: number;
  lastScore: number;
  lastVerdict: string;
}

export const DAILY_WARMUP_PLAN: WarmupTarget[] = [
  { trickId: "ollie", targetReps: 2 },
  { trickId: "pop-shuvit", targetReps: 2 },
  { trickId: "kickflip", targetReps: 1 },
];

export const GUIDED_TUTORIALS: GuidedTutorial[] = [
  {
    id: "boned-ollie-tutorial",
    title: "Boned Ollie Tutorial",
    subtitle: "3-phase physics drill: Snap -> Bone Nose -> Clean Catch",
    trickId: "boned-ollie",
    estimatedMin: 3,
    steps: [
      {
        id: "snap-tail",
        title: "1. Crisp Tail Snap",
        instruction: "Pop sharply off the tail before your index starts sliding forward.",
        cue: "Aim for >10% vertical rise with Crisp Timing (no Early Slide).",
        verify: (attempt, scale) => {
          const minPop = 0.095 * scale;
          if (attempt.metrics.popTiming === "early-slide") {
            return {
              passed: false,
              feedback: "Slid before tail snap — click the tail down first.",
            };
          }
          if (attempt.metrics.peakPop < minPop) {
            return {
              passed: false,
              feedback: "Popped too low — snap harder into the tail.",
            };
          }
          return {
            passed: true,
            feedback: "Phase 1 locked — tail snap cleared launch height.",
          };
        },
      },
      {
        id: "bone-nose",
        title: "2. Bone the Nose Down",
        instruction: "Push your index forward past the bolts at apex to dip the nose flat.",
        cue: "Slide forward cleanly (+flick) and avoid a high rocket nose.",
        verify: (attempt, scale) => {
          const pitch = attempt.metrics.boardPitchDeg ?? 0;
          const flickedForward = Math.abs(attempt.metrics.flick) >= 0.02 * scale;
          if (attempt.metrics.landingKind === "rocket" || pitch > 12) {
            return {
              passed: false,
              feedback: "Stayed rocket nose-high — drive your index past the front bolts.",
            };
          }
          if (!flickedForward && attempt.metrics.levelness > 0.055 * scale) {
            return {
              passed: false,
              feedback: "Push forward more at apex so the tail rises above the nose.",
            };
          }
          return {
            passed: true,
            feedback: "Phase 2 locked — nose boned out cleanly at apex.",
          };
        },
      },
      {
        id: "clean-catch",
        title: "3. Level Four-Wheel Catch",
        instruction: "Land the full Boned Ollie flat on all four wheels with score >= 74.",
        cue: "Keep your wrist square and absorb landing with soft finger pads.",
        verify: (attempt) => {
          if (!attempt.trickMatched || attempt.score < 74) {
            return {
              passed: false,
              feedback: `${attempt.diagnosis.title} (${attempt.score}) — need matched form >= 74.`,
            };
          }
          if (attempt.metrics.landingKind && attempt.metrics.landingKind !== "clean") {
            return {
              passed: false,
              feedback: `Landed ${attempt.metrics.landingKind} — level both tips evenly on touchdown.`,
            };
          }
          return {
            passed: true,
            feedback: "Tutorial complete! Full Boned Ollie verified.",
          };
        },
      },
    ],
  },
  {
    id: "kickflip-flick-drill",
    title: "Kickflip Flick Drill",
    subtitle: "Snap vertical, whip heel-edge diagonal, catch bolts clean",
    trickId: "kickflip",
    estimatedMin: 4,
    steps: [
      {
        id: "kf-pop",
        title: "1. Vertical Tail Pop",
        instruction: "Snap straight down so the nose rises before flicking off the corner.",
        cue: "Clear >10% pop height without rushing Early Slide.",
        verify: (attempt, scale) => {
          if (attempt.metrics.popTiming === "early-slide") {
            return {
              passed: false,
              feedback: "Flicked before tail hit — wait for the crisp tail snap first.",
            };
          }
          if (attempt.metrics.peakPop < 0.095 * scale) {
            return { passed: false, feedback: "Low pop — snap the tail harder before flicking." };
          }
          return { passed: true, feedback: "Phase 1 locked — crisp vertical pop height." };
        },
      },
      {
        id: "kf-flick",
        title: "2. Heel-Edge Whip",
        instruction: "Whip index up & diagonally off the heel pocket right as the nose rises.",
        cue: "Generate full rotation without stalling past apex (no Late Flick).",
        verify: (attempt, scale) => {
          if (attempt.metrics.popTiming === "late-flick") {
            return {
              passed: false,
              feedback: "Late flick past apex — whip off the nose pocket immediately.",
            };
          }
          const flipDeg = attempt.metrics.flipRotationDeg ?? 0;
          const flickTravel = Math.abs(attempt.metrics.flick);
          if (flipDeg < 180 && flickTravel < 0.022 * scale) {
            return {
              passed: false,
              feedback: "Weak heel-edge flick — extend your index diagonally off the pocket.",
            };
          }
          return { passed: true, feedback: "Phase 2 locked — solid heel-edge flick impulse." };
        },
      },
      {
        id: "kf-catch",
        title: "3. Clean 360° Bolts Catch",
        instruction: "Hold tips above the spinning deck and stomp flat on bolts (score >= 74).",
        cue: "Avoid Primo landings by waiting for the full 360° grip reveal.",
        verify: (attempt) => {
          if (attempt.metrics.landingKind === "primo") {
            return {
              passed: false,
              feedback: "Caught primo — hold your catch one beat higher for full flip.",
            };
          }
          if (!attempt.trickMatched || attempt.score < 74) {
            return {
              passed: false,
              feedback: `${attempt.diagnosis.title} (${attempt.score}) — hit >= 74 to finish drill.`,
            };
          }
          return { passed: true, feedback: "Tutorial complete! Clean Kickflip locked." };
        },
      },
    ],
  },
  {
    id: "pop-shuvit-drill",
    title: "Pop Shuvit Scoop Drill",
    subtitle: "Back-pocket curl, clean tail scoop, square catch",
    trickId: "pop-shuvit",
    estimatedMin: 3,
    steps: [
      {
        id: "shuv-load",
        title: "1. Pocket Load & Curl",
        instruction: "Arch fingers cleanly (~25–55% curl) into the tail pocket and pop.",
        cue: "Avoid flat stiff fingers or over-pinching claw grip.",
        verify: (attempt, scale) => {
          if (attempt.metrics.peakPop < 0.08 * scale) {
            return { passed: false, feedback: "Snap down slightly deeper into the tail pocket." };
          }
          if (
            attempt.diagnosis.title === "STIFF FINGERS" ||
            attempt.diagnosis.title === "CLAW GRIP"
          ) {
            return { passed: false, feedback: attempt.diagnosis.advice };
          }
          return { passed: true, feedback: "Phase 1 locked — balanced finger arch on tail." };
        },
      },
      {
        id: "shuv-scoop",
        title: "2. Backside Tail Scoop",
        instruction: "Sweep middle finger backward while keeping index hovering over center.",
        cue: "Create clean separation so the board swings 180° under your palm.",
        verify: (attempt, scale) => {
          if (attempt.metrics.spread < 0.075 * scale) {
            return {
              passed: false,
              feedback: "Scoop sweep too narrow — pull middle pad farther back across pocket.",
            };
          }
          return { passed: true, feedback: "Phase 2 locked — full backside scoop travel." };
        },
      },
      {
        id: "shuv-catch",
        title: "3. Centered 180° Catch",
        instruction: "Catch cleanly once the nose sweeps around (score >= 74).",
        cue: "Keep your wrist quiet — let the tail scoop spin the deck below.",
        verify: (attempt) => {
          if (!attempt.trickMatched || attempt.score < 74) {
            return {
              passed: false,
              feedback: `${attempt.diagnosis.title} (${attempt.score}) — aim for score >= 74.`,
            };
          }
          return { passed: true, feedback: "Tutorial complete! Pop Shuvit dialed." };
        },
      },
    ],
  },
];

export function getTutorial(id: string): GuidedTutorial | undefined {
  return GUIDED_TUTORIALS.find((t) => t.id === id);
}

/** Deterministic daily featured trick rotating cleanly across the catalog. */
export function getTrickOfTheDay(now = new Date()): {
  dateKey: string;
  trick: Trick;
  bonusCue: (setup: DeckSetupId) => string;
} {
  const dayNum = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
  );
  const pool = TRICKS.filter((t) => t.difficulty >= 2 && t.difficulty <= 4);
  const chosen = pool[dayNum % pool.length] ?? TRICKS[0]!;
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return {
    dateKey,
    trick: chosen,
    bonusCue: (setup) => chosen.cues[setup],
  };
}

/** Deterministic Weekly Clip Challenge featuring an iconic skill-building trick. */
const WEEKLY_POOL: TrickId[] = [
  "tre-flip",
  "kickflip",
  "boned-ollie",
  "varial-kickflip",
  "hardflip",
  "boardslide",
  "50-50-grind",
];

export function getWeeklyChallenge(now = new Date()): WeeklyChallenge {
  const utcDay = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
  );
  const weekNum = Math.floor((utcDay + 3) / 7); // Align weeks on Monday
  const weekStartMs = (weekNum * 7 - 3) * 86_400_000;
  const weekEndMs = weekStartMs + 6 * 86_400_000;

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  const trickId = WEEKLY_POOL[weekNum % WEEKLY_POOL.length] ?? "tre-flip";
  const trick = getTrick(trickId);

  return {
    weekKey: `week-${weekNum}`,
    dateRangeLabel: `${fmt(weekStartMs)} – ${fmt(weekEndMs)}`,
    trickId,
    trick,
    minScore: 72,
    rewardLabel: "Local practice target · clean make at 72+",
    brief: `Film a clean slow-mo ${trick.name} and aim for 72+. Save a local draft here, then export or share the clip yourself. No online prize submission is connected in this server-free build.`,
  };
}

export function isClipQualifiedForChallenge(clip: SavedClip, challenge: WeeklyChallenge): boolean {
  return (
    clip.trickId === challenge.trickId &&
    clip.attempt.score >= challenge.minScore &&
    clip.attempt.trickMatched
  );
}

export function evaluateWarmupAttempt(state: WarmupProgress, attempt: Attempt): WarmupProgress {
  if (!state.active || state.completed) return state;
  const target = DAILY_WARMUP_PLAN[state.stepIndex];
  if (!target) return state;

  if (attempt.trickId !== target.trickId) {
    return {
      ...state,
      lastFeedback: `Switch to ${getTrick(target.trickId).name} for this warmup block.`,
    };
  }

  if (attempt.score < 62 || !attempt.trickMatched) {
    return {
      ...state,
      lastFeedback: `${attempt.diagnosis.title} (${attempt.score}) — hit >= 62 to count rep.`,
    };
  }

  const nextReps = state.repsCompleted + 1;
  if (nextReps < target.targetReps) {
    return {
      ...state,
      repsCompleted: nextReps,
      lastFeedback: `Rep ${nextReps}/${target.targetReps} banked on ${getTrick(target.trickId).name}!`,
    };
  }

  const nextStep = state.stepIndex + 1;
  if (nextStep >= DAILY_WARMUP_PLAN.length) {
    return {
      active: true,
      stepIndex: DAILY_WARMUP_PLAN.length - 1,
      repsCompleted: target.targetReps,
      completed: true,
      lastFeedback: "Daily Warmup complete — hands are dialed!",
    };
  }

  const nextTrickName = getTrick(DAILY_WARMUP_PLAN[nextStep]!.trickId).name;
  return {
    active: true,
    stepIndex: nextStep,
    repsCompleted: 0,
    completed: false,
    lastFeedback: `${getTrick(target.trickId).name} cleared! Next up: ${nextTrickName}.`,
  };
}

export function evaluateTutorialAttempt(
  tutorial: GuidedTutorial,
  stepIndex: number,
  attempt: Attempt,
  boardScale = 1,
): { passed: boolean; feedback: string; nextStepIndex: number; completed: boolean } {
  const step = tutorial.steps[stepIndex];
  if (!step) {
    return {
      passed: true,
      feedback: `${tutorial.title} complete!`,
      nextStepIndex: tutorial.steps.length - 1,
      completed: true,
    };
  }

  if (attempt.trickId !== tutorial.trickId) {
    return {
      passed: false,
      feedback: `Tutorial tracks ${getTrick(tutorial.trickId).name} — keep that trick selected.`,
      nextStepIndex: stepIndex,
      completed: false,
    };
  }

  const check = step.verify(attempt, boardScale);
  if (!check.passed) {
    return {
      passed: false,
      feedback: check.feedback,
      nextStepIndex: stepIndex,
      completed: false,
    };
  }

  const nextIdx = stepIndex + 1;
  if (nextIdx >= tutorial.steps.length) {
    return {
      passed: true,
      feedback: check.feedback,
      nextStepIndex: tutorial.steps.length - 1,
      completed: true,
    };
  }

  return {
    passed: true,
    feedback: check.feedback,
    nextStepIndex: nextIdx,
    completed: false,
  };
}

const STORAGE_KEYS = {
  completedTutorials: "deckcoach.completedTutorials.v1",
  warmupDoneDate: "deckcoach.warmupDoneDate.v1",
  totdDoneDate: "deckcoach.totdDoneDate.v1",
  challengeSubmissions: "deckcoach.challengeSubmissions.v1",
  sessionHistory: "deckcoach.sessionHistory.v1",
} as const;

export function loadCompletedTutorials(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.completedTutorials);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveCompletedTutorials(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.completedTutorials, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadDailyCompletions(todayKey: string): { warmupDone: boolean; totdDone: boolean } {
  if (typeof window === "undefined") return { warmupDone: false, totdDone: false };
  try {
    return {
      warmupDone: window.localStorage.getItem(STORAGE_KEYS.warmupDoneDate) === todayKey,
      totdDone: window.localStorage.getItem(STORAGE_KEYS.totdDoneDate) === todayKey,
    };
  } catch {
    return { warmupDone: false, totdDone: false };
  }
}

export function saveDailyCompletion(kind: "warmup" | "totd", todayKey: string) {
  if (typeof window === "undefined") return;
  try {
    const key = kind === "warmup" ? STORAGE_KEYS.warmupDoneDate : STORAGE_KEYS.totdDoneDate;
    window.localStorage.setItem(key, todayKey);
  } catch {
    // Ignore storage quota errors
  }
}

export function loadChallengeSubmissions(): ChallengeSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.challengeSubmissions);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChallengeSubmission[]) : [];
  } catch {
    return [];
  }
}

export function saveChallengeSubmission(entry: ChallengeSubmission): ChallengeSubmission[] {
  const prev = loadChallengeSubmissions();
  const next = [entry, ...prev.filter((e) => e.weekKey !== entry.weekKey)].slice(0, 10);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEYS.challengeSubmissions, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

const MAX_HISTORY_ENTRIES = 30;

/**
 * Evaluates whether a physics analyzer attempt counts as a landed success:
 * matched trick signature, solid score >= 70, and non-primo landing.
 */
export function isPhysicsAttemptSuccess(attempt: Attempt): boolean {
  return (
    attempt.trickMatched &&
    attempt.score >= 70 &&
    attempt.metrics.landingKind !== "primo" &&
    attempt.metrics.landingKind !== "rocket"
  );
}

export function computeSuccessRatePct(landedCount: number, attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((landedCount / attempts) * 100)));
}

export function recordCompletedDrillHistory(
  history: SessionHistoryEntry[],
  params: {
    id: string;
    kind: "drill" | "warmup";
    title: string;
    trickId?: TrickId;
    setup?: DeckSetupId;
    attempts: number;
    landedCount: number;
    bestScore: number;
    lastScore: number;
    lastVerdict: string;
    timestamp?: number;
  },
): SessionHistoryEntry[] {
  const attempts = Math.max(1, params.attempts);
  const landedCount = Math.min(attempts, Math.max(0, params.landedCount));
  const entry: SessionHistoryEntry = {
    id: params.id,
    kind: params.kind,
    title: params.title,
    ...(params.trickId ? { trickId: params.trickId } : {}),
    ...(params.setup ? { setup: params.setup } : {}),
    timestamp: params.timestamp ?? Date.now(),
    attempts,
    landedCount,
    successRatePct: computeSuccessRatePct(landedCount, attempts),
    bestScore: params.bestScore,
    lastScore: params.lastScore,
    lastVerdict: params.lastVerdict,
  };
  return [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES);
}

/**
 * Logs/updates an ongoing free-skate trick session entry using real physics analyzer results,
 * grouping sequential attempts in the same trick block and recording timestamp & success rate.
 */
export function upsertTrickHistoryEntry(
  history: SessionHistoryEntry[],
  attempt: Attempt,
  sessionBlockId: string,
  trickName: string,
  timestamp = Date.now(),
): SessionHistoryEntry[] {
  const landed = isPhysicsAttemptSuccess(attempt) ? 1 : 0;
  const existing = history.find((h) => h.id === sessionBlockId);

  if (!existing) {
    const entry: SessionHistoryEntry = {
      id: sessionBlockId,
      kind: "trick",
      title: trickName,
      trickId: attempt.trickId as TrickId,
      ...(attempt.setup ? { setup: attempt.setup } : {}),
      timestamp,
      attempts: 1,
      landedCount: landed,
      successRatePct: landed ? 100 : 0,
      bestScore: attempt.score,
      lastScore: attempt.score,
      lastVerdict: attempt.diagnosis.title,
    };
    return [entry, ...history].slice(0, MAX_HISTORY_ENTRIES);
  }

  const attempts = existing.attempts + 1;
  const landedCount = existing.landedCount + landed;
  const updated: SessionHistoryEntry = {
    ...existing,
    timestamp,
    attempts,
    landedCount,
    successRatePct: computeSuccessRatePct(landedCount, attempts),
    bestScore: Math.max(existing.bestScore, attempt.score),
    lastScore: attempt.score,
    lastVerdict: attempt.diagnosis.title,
  };

  return [updated, ...history.filter((h) => h.id !== sessionBlockId)].slice(0, MAX_HISTORY_ENTRIES);
}

export function loadSessionHistory(): SessionHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sessionHistory);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveSessionHistory(entries: SessionHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.sessionHistory,
      JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)),
    );
  } catch {
    // Ignore storage quota errors
  }
}
